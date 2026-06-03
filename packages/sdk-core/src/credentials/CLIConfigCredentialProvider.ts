import crypto from "crypto";
import fs from "fs";
import http from "http";
import https from "https";
import path from "path";
import { URL } from "url";
import type { CredentialValue, Provider } from "./types";
import { EcsRoleCredentialProvider } from "./EcsRoleCredentialProvider";
import { OidcCredentialProvider } from "./OidcCredentialProvider";
import { StsAssumeRoleProvider } from "./StsAssumeRoleProvider";
import { loadEnv } from "../utils/env";

const DEFAULT_REGION = "cn-beijing";
const MODE_AK = "ak";
const MODE_RAM_ROLE_ARN = "ramrolearn";
const MODE_OIDC = "oidc";
const MODE_ECS_ROLE = "ecsrole";
const MODE_SSO = "sso";
const MODE_CONSOLE_LOGIN = "console-login";
const MODE_STS_TOKEN = "ststoken";
const SSO_CACHE_DIR = "sso/cache";
const OAUTH_TOKEN_PATH = "/token";
const PORTAL_ROLE_CREDENTIALS_PATH = "/federation/credentials";
const PORTAL_TOKEN_HEADER = "x-bd-cloudidentity-bearer-token";
const EXPIRE_BUFFER_MS = 60_000;

/**
 * 内部 Provider：将一份带过期时间的 STS 临时凭证缓存为 Provider，
 * 用于 SSO / console-login / StsToken 模式，避免每次重新走完整流程。
 *
 * 调用方应在每次使用前检查 isExpired()，已过期则清空 delegate 重新走流程。
 */
class ExpiringCredentialDelegate implements Provider {
  readonly providerName: string;
  private readonly credentials: CredentialValue;
  private readonly expiresAtMs: number;

  constructor(
    credentials: CredentialValue,
    expiresAtMs: number,
    providerName: string,
  ) {
    this.credentials = credentials;
    this.expiresAtMs = expiresAtMs;
    this.providerName = providerName;
  }

  isExpired(): boolean {
    return Date.now() >= this.expiresAtMs - EXPIRE_BUFFER_MS;
  }

  async resolveCredentials(): Promise<CredentialValue> {
    return this.credentials;
  }
}

/**
 * 从 CLI 配置文件 ~/.volcengine/config.json 读取凭证。
 *
 * 配置文件路径优先级：
 *   1. 环境变量 VOLCENGINE_CLI_CONFIG_FILE（如果设置）
 *   2. ${HOME || USERPROFILE}/.volcengine/config.json
 *
 * Profile 选择：
 *   - VOLCENGINE_PROFILE / VOLCSTACK_PROFILE > configData.current > default
 *
 * 按 profile.mode（大小写不敏感）分发，空 mode 等价于 ak。
 */
export class CLIConfigCredentialProvider implements Provider {
  readonly providerName = "CLIConfigCredentialProvider";

  private delegate?: Provider;

  async resolveCredentials(): Promise<CredentialValue> {
    if (this.delegate) {
      // 对于带过期时间的 delegate（SSO/console-login/StsToken），过期后清空重走流程
      if (
        this.delegate instanceof ExpiringCredentialDelegate &&
        this.delegate.isExpired()
      ) {
        this.delegate = undefined;
      } else {
        return this.delegate.resolveCredentials();
      }
    }

    const configPath = this.resolveConfigPath();

    if (!fs.existsSync(configPath)) {
      throw new Error(`${this.providerName}: 配置文件不存在: ${configPath}`);
    }

    let configData: any;
    try {
      configData = JSON.parse(
        fs.readFileSync(configPath, { encoding: "utf-8" }),
      );
    } catch (err: any) {
      throw new Error(
        `${this.providerName}: 解析配置文件失败 (${configPath}): ${err.message}`,
      );
    }

    const profileName = this.resolveProfileName(configData);
    const profile = configData?.profiles?.[profileName];

    if (!profile) {
      throw new Error(`${this.providerName}: 配置文件中未找到有效的 profile`);
    }

    const mode = String(profile.mode || "")
      .trim()
      .toLowerCase();

    switch (mode) {
      case "":
      case MODE_AK:
        return this.resolveAK(profile);
      case MODE_RAM_ROLE_ARN:
        return this.resolveRamRoleArn(profile);
      case MODE_OIDC:
        return this.resolveOIDC(profile);
      case MODE_ECS_ROLE:
        return this.resolveEcsRole(profile);
      case MODE_SSO:
        return this.resolveSSO(profile, configData, configPath);
      case MODE_CONSOLE_LOGIN:
      case MODE_STS_TOKEN:
        return this.resolveCachedStsToken(profile, mode);
      default:
        throw new Error(
          `${this.providerName}: 不支持的 CLI profile mode: ${profile.mode}`,
        );
    }
  }

  private resolveAK(profile: any): CredentialValue {
    const accessKeyId: string | undefined = profile["access-key"];
    const secretAccessKey: string | undefined = profile["secret-key"];

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        `${this.providerName}: 配置文件中缺少 access-key 或 secret-key`,
      );
    }

    return {
      accessKeyId,
      secretAccessKey,
      sessionToken: profile["session-token"] || undefined,
      providerName: this.providerName,
    };
  }

  private resolveRamRoleArn(profile: any): Promise<CredentialValue> {
    const accessKeyId: string | undefined = profile["access-key"];
    const secretAccessKey: string | undefined = profile["secret-key"];
    const accountId: string | undefined = this.trimToUndefined(
      profile["account-id"],
    );
    const roleName: string | undefined = this.trimToUndefined(
      profile["role-name"],
    );
    const roleTrn: string | undefined =
      this.trimToUndefined(profile["role-trn"]) ||
      (accountId && roleName
        ? `trn:iam::${accountId}:role/${roleName}`
        : undefined);

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        `${this.providerName}: ramrolearn 模式缺少 access-key 或 secret-key`,
      );
    }
    if (!roleTrn) {
      throw new Error(
        `${this.providerName}: ramrolearn 模式缺少 role-trn，或 account-id/role-name`,
      );
    }

    this.delegate = new StsAssumeRoleProvider({
      accessKeyId,
      secretAccessKey,
      roleTrn,
      region: this.trimToUndefined(profile.region) || DEFAULT_REGION,
      protocol: profile["disable-ssl"] ? "http" : "https",
      durationSeconds: 3600,
    });
    return this.delegate.resolveCredentials();
  }

  private resolveOIDC(profile: any): Promise<CredentialValue> {
    const roleTrn = this.trimToUndefined(profile["role-trn"]);
    const oidcTokenFile = this.trimToUndefined(profile["oidc-token-file"]);

    if (!roleTrn) {
      throw new Error(`${this.providerName}: oidc 模式缺少 role-trn`);
    }
    if (!oidcTokenFile) {
      throw new Error(`${this.providerName}: oidc 模式缺少 oidc-token-file`);
    }

    this.delegate = new OidcCredentialProvider({
      roleTrn,
      oidcTokenFile,
      region: this.trimToUndefined(profile.region) || DEFAULT_REGION,
      protocol: profile["disable-ssl"] ? "http" : "https",
      durationSeconds: 3600,
    });
    return this.delegate.resolveCredentials();
  }

  private resolveEcsRole(profile: any): Promise<CredentialValue> {
    const roleName = this.trimToUndefined(profile["role-name"]);
    if (!roleName) {
      throw new Error(`${this.providerName}: ecsrole 模式缺少 role-name`);
    }

    this.delegate = new EcsRoleCredentialProvider({ roleName });
    return this.delegate.resolveCredentials();
  }

  private resolveCachedStsToken(profile: any, mode: string): CredentialValue {
    const expiration = profile["sts-expiration"];
    if (expiration === undefined || expiration === null || expiration === "") {
      const credentials = this.resolveAK(profile);
      if (!credentials.sessionToken) {
        throw new Error(`${this.providerName}: ${mode} 模式缺少 session-token`);
      }
      return credentials;
    }

    const cached = this.tryResolveCachedStsToken(profile);
    if (!cached) {
      throw new Error(`${this.providerName}: ${mode} 模式 STS 临时凭证已过期`);
    }
    this.delegate = new ExpiringCredentialDelegate(
      cached.credentials,
      cached.expiresAtMs,
      this.providerName,
    );
    return cached.credentials;
  }

  private tryResolveCachedStsToken(
    profile: any,
  ): { credentials: CredentialValue; expiresAtMs: number } | undefined {
    const expiration = profile["sts-expiration"];
    if (expiration === undefined || expiration === null || expiration === "") {
      return undefined;
    }
    const expiredTime = this.parseUnixTimestamp(Number(expiration));
    if (Number.isNaN(expiredTime.getTime())) {
      throw new Error(`${this.providerName}: sts-expiration 非法`);
    }
    if (Date.now() > expiredTime.getTime()) {
      return undefined;
    }

    const credentials = this.resolveAK(profile);
    if (!credentials.sessionToken) {
      throw new Error(`${this.providerName}: STS 临时凭证缺少 session-token`);
    }
    return { credentials, expiresAtMs: expiredTime.getTime() };
  }

  private async resolveSSO(
    profile: any,
    configData: any,
    configPath: string,
  ): Promise<CredentialValue> {
    const cached = this.tryResolveCachedStsToken(profile);
    if (cached) {
      this.delegate = new ExpiringCredentialDelegate(
        cached.credentials,
        cached.expiresAtMs,
        this.providerName,
      );
      return cached.credentials;
    }

    const sessionName = this.trimToUndefined(profile["sso-session-name"]);
    if (!sessionName) {
      throw new Error(`${this.providerName}: sso 模式缺少 sso-session-name`);
    }

    const session = configData?.["sso-session"]?.[sessionName];
    if (!session) {
      throw new Error(
        `${this.providerName}: 未找到 sso session: ${sessionName}`,
      );
    }

    const startUrl = this.trimToUndefined(session["start-url"]);
    if (!startUrl) {
      throw new Error(`${this.providerName}: sso session 缺少 start-url`);
    }

    const region =
      this.trimToUndefined(session.region) ||
      this.trimToUndefined(profile.region) ||
      DEFAULT_REGION;
    const tokenCachePath = this.resolveSsoTokenCachePath(
      configPath,
      startUrl,
      sessionName,
    );
    const tokenCache = this.loadSsoTokenCache(tokenCachePath);
    let accessToken = this.trimToUndefined(tokenCache.access_token);

    if (!accessToken) {
      throw new Error(
        `${this.providerName}: SSO token cache 缺少 access_token`,
      );
    }

    if (this.isSsoAccessTokenExpired(tokenCache.expires_at)) {
      accessToken = await this.refreshSsoAccessToken(
        tokenCache,
        tokenCachePath,
        region,
      );
    }

    return this.getSsoRoleCredentials(accessToken, profile, region);
  }

  private resolveSsoTokenCachePath(
    configPath: string,
    startUrl: string,
    sessionName: string,
  ): string {
    const payload = JSON.stringify({
      start_url: startUrl,
      session_name: sessionName,
    });
    const fileName = `${crypto
      .createHash("sha1")
      .update(payload)
      .digest("hex")}.json`;
    return path.join(path.dirname(configPath), SSO_CACHE_DIR, fileName);
  }

  private loadSsoTokenCache(tokenCachePath: string): any {
    if (!fs.existsSync(tokenCachePath)) {
      throw new Error(
        `${this.providerName}: SSO token cache 文件不存在: ${tokenCachePath}`,
      );
    }

    try {
      return JSON.parse(fs.readFileSync(tokenCachePath, { encoding: "utf-8" }));
    } catch (err: any) {
      throw new Error(
        `${this.providerName}: 解析 SSO token cache 失败 (${tokenCachePath}): ${err.message}`,
      );
    }
  }

  private isSsoAccessTokenExpired(expiresAt: unknown): boolean {
    const value = this.trimToUndefined(expiresAt);
    if (!value) {
      throw new Error(`${this.providerName}: SSO token cache 缺少 expires_at`);
    }
    const expiresAtMs = Date.parse(value);
    if (Number.isNaN(expiresAtMs)) {
      throw new Error(`${this.providerName}: SSO token cache expires_at 非法`);
    }
    return Date.now() > expiresAtMs;
  }

  private async refreshSsoAccessToken(
    tokenCache: any,
    tokenCachePath: string,
    region: string,
  ): Promise<string> {
    const refreshToken = this.trimToUndefined(tokenCache.refresh_token);
    const clientId = this.trimToUndefined(tokenCache.client_id);
    const clientSecret = this.trimToUndefined(tokenCache.client_secret);

    if (!refreshToken) {
      throw new Error(
        `${this.providerName}: SSO token cache 缺少 refresh_token`,
      );
    }
    if (!clientId || !clientSecret) {
      throw new Error(
        `${this.providerName}: SSO token cache 缺少 client_id/client_secret`,
      );
    }

    const clientSecretExpiresAt = Number(tokenCache.client_secret_expires_at);
    const secretExpiresAt = this.parseUnixTimestamp(clientSecretExpiresAt);
    if (
      !clientSecretExpiresAt ||
      Number.isNaN(secretExpiresAt.getTime()) ||
      Date.now() > secretExpiresAt.getTime()
    ) {
      throw new Error(`${this.providerName}: SSO refresh token 已过期`);
    }

    const tokenUrl = `https://cloudidentity-oauth.${region}.volces.com${OAUTH_TOKEN_PATH}`;
    const tokenResp = await this.requestJson("POST", tokenUrl, {
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const accessToken = this.trimToUndefined(tokenResp.access_token);
    if (!accessToken || !tokenResp.expires_in) {
      throw new Error(`${this.providerName}: SSO refresh token 响应缺少凭证`);
    }

    tokenCache.access_token = accessToken;
    if (this.trimToUndefined(tokenResp.refresh_token)) {
      tokenCache.refresh_token = tokenResp.refresh_token;
    }
    tokenCache.expires_at = new Date(
      Date.now() + Number(tokenResp.expires_in) * 1000,
    ).toISOString();
    this.saveSsoTokenCache(tokenCachePath, tokenCache);

    return accessToken;
  }

  private saveSsoTokenCache(tokenCachePath: string, tokenCache: any): void {
    const tmpPath = `${tokenCachePath}.tmp-${process.pid}-${Date.now()}`;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(tokenCache, null, 2), {
        encoding: "utf-8",
        mode: 0o600,
      });
      fs.renameSync(tmpPath, tokenCachePath);
    } catch (err: any) {
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      } catch {
        // 忽略清理失败，保留原始写入错误。
      }
      throw new Error(
        `${this.providerName}: 写入 SSO token cache 失败 (${tokenCachePath}): ${err.message}`,
      );
    }
  }

  private async getSsoRoleCredentials(
    accessToken: string,
    profile: any,
    region: string,
  ): Promise<CredentialValue> {
    const accountId = this.trimToUndefined(profile["account-id"]);
    const roleName = this.trimToUndefined(profile["role-name"]);
    if (!accountId) {
      throw new Error(`${this.providerName}: sso 模式缺少 account-id`);
    }
    if (!roleName) {
      throw new Error(`${this.providerName}: sso 模式缺少 role-name`);
    }

    const endpoint = new URL(
      `https://cloudidentity-portal.${region}.volces.com${PORTAL_ROLE_CREDENTIALS_PATH}`,
    );
    endpoint.searchParams.set("account_id", accountId);
    endpoint.searchParams.set("role_name", roleName);

    const resp = await this.requestJson("GET", endpoint.toString(), undefined, {
      Accept: "application/json",
      [PORTAL_TOKEN_HEADER]: accessToken,
    });
    const credentials = resp?.Result?.RoleCredentials;

    if (!credentials?.AccessKeyId || !credentials?.SecretAccessKey) {
      throw new Error(`${this.providerName}: SSO Portal 响应缺少临时凭证`);
    }

    const value: CredentialValue = {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken || undefined,
      providerName: this.providerName,
    };

    // 基于 Portal 响应的 Expiration 建立 delegate 缓存；未提供时按默认 1 小时
    const rawExpiration = credentials.Expiration;
    let expiresAtMs: number;
    if (
      rawExpiration !== undefined &&
      rawExpiration !== null &&
      rawExpiration !== ""
    ) {
      const expiredTime = this.parseUnixTimestamp(Number(rawExpiration));
      if (Number.isNaN(expiredTime.getTime())) {
        throw new Error(
          `${this.providerName}: SSO Portal 响应中的 Expiration 非法`,
        );
      }
      expiresAtMs = expiredTime.getTime();
    } else {
      expiresAtMs = Date.now() + 3600 * 1000;
    }
    this.delegate = new ExpiringCredentialDelegate(
      value,
      expiresAtMs,
      this.providerName,
    );

    return value;
  }

  private requestJson(
    method: "GET" | "POST",
    url: string,
    body?: any,
    headers: Record<string, string> = {},
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const data = body === undefined ? undefined : JSON.stringify(body);
      const client = parsedUrl.protocol === "http:" ? http : https;

      const req = client.request(
        {
          method,
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          timeout: 10_000,
          headers: {
            ...(data ? { "Content-Type": "application/json" } : {}),
            ...headers,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: any) =>
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
          );
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf-8");
            if (
              !res.statusCode ||
              res.statusCode < 200 ||
              res.statusCode >= 300
            ) {
              reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
              return;
            }
            try {
              resolve(raw ? JSON.parse(raw) : {});
            } catch (err: any) {
              reject(new Error(`解析 HTTP 响应失败: ${err.message}`));
            }
          });
        },
      );

      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("HTTP 请求超时")));
      if (data) {
        req.write(data);
      }
      req.end();
    });
  }

  /**
   * 解析配置文件路径。
   * 优先级：VOLCENGINE_CLI_CONFIG_FILE 环境变量 > 默认路径 (~/.volcengine/config.json)
   */
  private resolveConfigPath(): string {
    // 兼容 Windows（USERPROFILE）和 Unix（HOME）
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      throw new Error(
        `${this.providerName}: HOME / USERPROFILE 环境变量未设置，无法定位配置文件`,
      );
    }
    // 优先使用环境变量指定的配置文件路径
    const envConfig = loadEnv();
    const configFilePath = envConfig?.credentials?.configFilePath;
    if (configFilePath) {
      return path.resolve(homeDir, configFilePath);
    }

    return path.resolve(homeDir, ".volcengine/config.json");
  }

  private resolveProfileName(configData: any): string {
    return (
      process.env.VOLCENGINE_PROFILE ||
      process.env.VOLCSTACK_PROFILE ||
      configData?.current ||
      "default"
    );
  }

  private trimToUndefined(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private parseUnixTimestamp(timestamp: number): Date {
    if (timestamp >= 1e18) {
      return new Date(timestamp / 1e6);
    }
    if (timestamp >= 1e15) {
      return new Date(timestamp / 1e3);
    }
    if (timestamp >= 1e12) {
      return new Date(timestamp);
    }
    return new Date(timestamp * 1000);
  }
}
