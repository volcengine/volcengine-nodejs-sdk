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
const LOGIN_CACHE_DIR = "login/cache";
const LOGIN_CACHE_DIRECTORY_ENV = "VOLCENGINE_LOGIN_CACHE_DIRECTORY";
const OAUTH_TOKEN_PATH = "/token";
const DEFAULT_CONSOLE_LOGIN_ENDPOINT = "https://signin.volcengine.com";
const CONSOLE_LOGIN_TOKEN_PATH = "/authorize/oauth/token";
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
  private readonly consoleLoginTokenCaches = new Map<string, any>();
  private readonly ssoTokenCaches = new Map<string, any>();

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
      throw new Error(
        `${this.providerName}: config file not found: ${configPath}`,
      );
    }

    let configData: any;
    try {
      configData = JSON.parse(
        fs.readFileSync(configPath, { encoding: "utf-8" }),
      );
    } catch (err: any) {
      throw new Error(
        `${this.providerName}: failed to parse config file (${configPath}): ${err.message}`,
      );
    }

    const profileName = this.resolveProfileName(configData);
    const profile = configData?.profiles?.[profileName];

    if (!profile) {
      throw new Error(
        `${this.providerName}: no valid profile found in config file`,
      );
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
        return this.resolveConsoleLogin(profile, configPath);
      case MODE_STS_TOKEN:
        return this.resolveCachedStsToken(profile, mode);
      default:
        throw new Error(
          `${this.providerName}: unsupported CLI profile mode: ${profile.mode}`,
        );
    }
  }

  private resolveAK(profile: any): CredentialValue {
    const accessKeyId: string | undefined = profile["access-key"];
    const secretAccessKey: string | undefined = profile["secret-key"];

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        `${this.providerName}: config file is missing access-key or secret-key`,
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
        `${this.providerName}: ramrolearn mode is missing access-key or secret-key`,
      );
    }
    if (!roleTrn) {
      throw new Error(
        `${this.providerName}: ramrolearn mode is missing role-trn, or account-id/role-name`,
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
      throw new Error(`${this.providerName}: oidc mode is missing role-trn`);
    }
    if (!oidcTokenFile) {
      throw new Error(
        `${this.providerName}: oidc mode is missing oidc-token-file`,
      );
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
      throw new Error(
        `${this.providerName}: ecsrole mode is missing role-name`,
      );
    }

    this.delegate = new EcsRoleCredentialProvider({ roleName });
    return this.delegate.resolveCredentials();
  }

  private resolveCachedStsToken(profile: any, mode: string): CredentialValue {
    const expiration = profile["sts-expiration"];
    if (expiration === undefined || expiration === null || expiration === "") {
      const credentials = this.resolveAK(profile);
      if (!credentials.sessionToken) {
        throw new Error(
          `${this.providerName}: ${mode} mode is missing session-token`,
        );
      }
      return credentials;
    }

    const cached = this.tryResolveCachedStsToken(profile);
    if (!cached) {
      throw new Error(
        `${this.providerName}: ${mode} mode STS temporary credentials have expired`,
      );
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
      throw new Error(`${this.providerName}: invalid sts-expiration`);
    }
    if (Date.now() > expiredTime.getTime()) {
      return undefined;
    }

    const credentials = this.resolveAK(profile);
    if (!credentials.sessionToken) {
      throw new Error(
        `${this.providerName}: STS temporary credentials are missing session-token`,
      );
    }
    return { credentials, expiresAtMs: expiredTime.getTime() };
  }

  private async resolveSSO(
    profile: any,
    configData: any,
    configPath: string,
  ): Promise<CredentialValue> {
    const cached = this.tryResolveSsoCachedStsToken(profile);
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
      throw new Error(
        `${this.providerName}: sso mode is missing sso-session-name`,
      );
    }

    const session = configData?.["sso-session"]?.[sessionName];
    if (!session) {
      throw new Error(
        `${this.providerName}: sso session not found: ${sessionName}`,
      );
    }

    const startUrl = this.trimToUndefined(session["start-url"]);
    if (!startUrl) {
      throw new Error(`${this.providerName}: sso session is missing start-url`);
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

    // 与 Python SDK 对齐：仅在内存缓存为空时从磁盘 bootstrap 一次，
    // 之后复用内存缓存（含轮换后的 refresh_token），SDK 永不写盘。
    let tokenCache = this.ssoTokenCaches.get(tokenCachePath);
    if (!tokenCache) {
      tokenCache = this.loadSsoTokenCache(tokenCachePath);
      this.ssoTokenCaches.set(tokenCachePath, tokenCache);
    }

    let accessToken = this.trimToUndefined(tokenCache.access_token);

    if (!accessToken) {
      throw new Error(
        `${this.providerName}: SSO token cache is missing access_token`,
      );
    }

    if (this.isSsoAccessTokenExpired(tokenCache.expires_at)) {
      accessToken = await this.refreshSsoAccessToken(tokenCache, region);
    }

    return this.getSsoRoleCredentials(accessToken, profile, region);
  }

  /**
   * SSO 模式下读取 profile 内联的 STS 临时凭证快路径。
   *
   * 与 Python `_try_cached_sts_credentials` 对齐：sts-expiration 缺失/无效/已过期，
   * 或 access-key/secret-key 缺失时，返回 undefined 以回退到完整 SSO 流程，而不是抛错。
   * session-token 在 SSO 模式下可选。
   */
  private tryResolveSsoCachedStsToken(
    profile: any,
  ): { credentials: CredentialValue; expiresAtMs: number } | undefined {
    const expiration = profile["sts-expiration"];
    if (expiration === undefined || expiration === null || expiration === "") {
      return undefined;
    }
    const expValue = Number(expiration);
    if (!expValue || expValue <= 0) {
      return undefined;
    }
    const expiredTime = this.parseUnixTimestamp(expValue);
    if (
      Number.isNaN(expiredTime.getTime()) ||
      Date.now() >= expiredTime.getTime()
    ) {
      return undefined;
    }

    const accessKeyId = this.trimToUndefined(profile["access-key"]);
    const secretAccessKey = this.trimToUndefined(profile["secret-key"]);
    if (!accessKeyId || !secretAccessKey) {
      return undefined;
    }

    return {
      credentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken: this.trimToUndefined(profile["session-token"]),
        providerName: this.providerName,
      },
      expiresAtMs: expiredTime.getTime(),
    };
  }

  private async resolveConsoleLogin(
    profile: any,
    configPath: string,
  ): Promise<CredentialValue> {
    const loginSession = this.trimToUndefined(profile["login-session"]);
    if (!loginSession) {
      throw new Error(
        `${this.providerName}: console-login mode is missing login-session; run ve login first`,
      );
    }

    const cacheDir =
      process.env[LOGIN_CACHE_DIRECTORY_ENV] ||
      path.join(path.dirname(configPath), LOGIN_CACHE_DIR);
    const cachePath = path.join(
      cacheDir,
      `${crypto.createHash("sha1").update(loginSession).digest("hex")}.json`,
    );
    let tokenCache = this.consoleLoginTokenCaches.get(cachePath);
    if (!tokenCache) {
      tokenCache = this.loadConsoleLoginCache(cachePath);
      this.consoleLoginTokenCaches.set(cachePath, tokenCache);
    }

    const cached = this.tryApplyConsoleLoginCache(tokenCache, cachePath);
    if (cached) {
      this.delegate = new ExpiringCredentialDelegate(
        cached.credentials,
        cached.expiresAtMs,
        this.providerName,
      );
      return cached.credentials;
    }

    try {
      return await this.refreshConsoleLoginWithOAuth(tokenCache, cachePath);
    } catch (err: any) {
      if (!this.isInvalidGrantError(err)) {
        throw err;
      }

      const diskCache = this.loadConsoleLoginCache(cachePath);
      if (diskCache.refresh_token === tokenCache.refresh_token) {
        throw new Error(
          `${this.providerName}: console-login refresh_token is invalid; run ve login again: ${err.message}`,
        );
      }

      tokenCache = diskCache;
      this.consoleLoginTokenCaches.set(cachePath, tokenCache);
      const diskCached = this.tryApplyConsoleLoginCache(tokenCache, cachePath);
      if (diskCached) {
        this.delegate = new ExpiringCredentialDelegate(
          diskCached.credentials,
          diskCached.expiresAtMs,
          this.providerName,
        );
        return diskCached.credentials;
      }
      return this.refreshConsoleLoginWithOAuth(tokenCache, cachePath);
    }
  }

  private loadConsoleLoginCache(cachePath: string): any {
    if (!fs.existsSync(cachePath)) {
      throw new Error(
        `${this.providerName}: console-login token cache file does not exist: ${cachePath}; run ve login first`,
      );
    }

    try {
      return JSON.parse(fs.readFileSync(cachePath, { encoding: "utf-8" }));
    } catch (err: any) {
      throw new Error(
        `${this.providerName}: failed to parse console-login token cache (${cachePath}): ${err.message}; run ve login again`,
      );
    }
  }

  private tryApplyConsoleLoginCache(
    tokenCache: any,
    cachePath: string,
  ): { credentials: CredentialValue; expiresAtMs: number } | undefined {
    const expiresAtMs = this.getConsoleLoginCacheExpiresAt(
      tokenCache,
      cachePath,
    );
    if (Date.now() >= expiresAtMs - EXPIRE_BUFFER_MS) {
      return undefined;
    }

    try {
      return {
        credentials: this.parseConsoleLoginAccessToken(
          tokenCache.access_token,
          cachePath,
        ),
        expiresAtMs,
      };
    } catch {
      return undefined;
    }
  }

  private async refreshConsoleLoginWithOAuth(
    tokenCache: any,
    cachePath: string,
  ): Promise<CredentialValue> {
    const refreshToken = this.trimToUndefined(tokenCache.refresh_token);
    const clientId = this.trimToUndefined(tokenCache.client_id);
    const endpoint =
      this.trimToUndefined(tokenCache.endpoint_url) ||
      DEFAULT_CONSOLE_LOGIN_ENDPOINT;
    const scope = this.trimToUndefined(tokenCache.scope);

    if (!refreshToken) {
      throw new Error(
        `${this.providerName}: console-login cache is missing refresh_token; run ve login again`,
      );
    }
    if (!clientId) {
      throw new Error(
        `${this.providerName}: console-login cache is missing client_id; run ve login again`,
      );
    }

    const requestBody: Record<string, string> = {
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    };
    if (scope) {
      requestBody.scope = scope;
    }

    const tokenResp = await this.requestFormUrlEncoded(
      `${endpoint.replace(/\/+$/, "")}${CONSOLE_LOGIN_TOKEN_PATH}`,
      requestBody,
    );
    const accessToken = tokenResp.access_token;
    const expiresIn = Number(tokenResp.expires_in);
    if (!accessToken || !expiresIn || expiresIn <= 0) {
      throw new Error(
        `${this.providerName}: console-login refresh response is missing access_token or expires_in`,
      );
    }

    // 与 Python SDK 对齐：只更新内存 cache，不写回 CLI cache/config。
    tokenCache.access_token = accessToken;
    if (this.trimToUndefined(tokenResp.refresh_token)) {
      tokenCache.refresh_token = tokenResp.refresh_token;
    }
    if (this.trimToUndefined(tokenResp.id_token)) {
      tokenCache.id_token = tokenResp.id_token;
    }
    if (this.trimToUndefined(tokenResp.token_type)) {
      tokenCache.token_type = tokenResp.token_type;
    }
    tokenCache.issued_at = new Date().toISOString();
    tokenCache.expires_in = expiresIn;

    const refreshed = this.tryApplyConsoleLoginCache(tokenCache, cachePath);
    if (!refreshed) {
      throw new Error(
        `${this.providerName}: console-login refresh succeeded, but access_token could not be parsed as STS credentials`,
      );
    }
    this.delegate = new ExpiringCredentialDelegate(
      refreshed.credentials,
      refreshed.expiresAtMs,
      this.providerName,
    );
    return refreshed.credentials;
  }

  private parseConsoleLoginAccessToken(
    accessToken: unknown,
    cachePath: string,
  ): CredentialValue {
    let stsCredentials: any;
    if (typeof accessToken === "string") {
      try {
        stsCredentials = JSON.parse(accessToken);
      } catch (err: any) {
        throw new Error(
          `${this.providerName}: failed to parse console-login access_token (${cachePath}): ${err.message}`,
        );
      }
    } else if (typeof accessToken === "object" && accessToken !== null) {
      stsCredentials = accessToken;
    } else {
      throw new Error(
        `${this.providerName}: invalid console-login access_token format (${cachePath})`,
      );
    }

    const accessKeyId = this.trimToUndefined(stsCredentials.access_key_id);
    const secretAccessKey = this.trimToUndefined(
      stsCredentials.secret_access_key,
    );
    const sessionToken = this.trimToUndefined(stsCredentials.session_token);
    if (!accessKeyId || !secretAccessKey || !sessionToken) {
      throw new Error(
        `${this.providerName}: console-login access_token is missing STS credential fields`,
      );
    }

    return {
      accessKeyId,
      secretAccessKey,
      sessionToken,
      providerName: this.providerName,
    };
  }

  private getConsoleLoginCacheExpiresAt(
    tokenCache: any,
    cachePath: string,
  ): number {
    const issuedAt = this.trimToUndefined(tokenCache.issued_at);
    const expiresIn = Number(tokenCache.expires_in);
    if (!issuedAt) {
      throw new Error(
        `${this.providerName}: console-login token cache is missing issued_at (${cachePath})`,
      );
    }
    if (!expiresIn || expiresIn <= 0) {
      throw new Error(
        `${this.providerName}: console-login token cache is missing a valid expires_in (${cachePath})`,
      );
    }

    const issuedAtMs = Date.parse(issuedAt);
    if (Number.isNaN(issuedAtMs)) {
      throw new Error(
        `${this.providerName}: invalid console-login token cache issued_at (${cachePath})`,
      );
    }
    return issuedAtMs + expiresIn * 1000;
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
        `${this.providerName}: SSO token cache file does not exist: ${tokenCachePath}`,
      );
    }

    try {
      return JSON.parse(fs.readFileSync(tokenCachePath, { encoding: "utf-8" }));
    } catch (err: any) {
      throw new Error(
        `${this.providerName}: failed to parse SSO token cache (${tokenCachePath}): ${err.message}`,
      );
    }
  }

  private isSsoAccessTokenExpired(expiresAt: unknown): boolean {
    const value = this.trimToUndefined(expiresAt);
    if (!value) {
      throw new Error(
        `${this.providerName}: SSO token cache is missing expires_at`,
      );
    }
    const expiresAtMs = Date.parse(value);
    if (Number.isNaN(expiresAtMs)) {
      throw new Error(
        `${this.providerName}: invalid SSO token cache expires_at`,
      );
    }
    return Date.now() > expiresAtMs;
  }

  private async refreshSsoAccessToken(
    tokenCache: any,
    region: string,
  ): Promise<string> {
    const refreshToken = this.trimToUndefined(tokenCache.refresh_token);
    const clientId = this.trimToUndefined(tokenCache.client_id);
    const clientSecret = this.trimToUndefined(tokenCache.client_secret);

    if (!refreshToken) {
      throw new Error(
        `${this.providerName}: SSO token cache is missing refresh_token`,
      );
    }
    if (!clientId || !clientSecret) {
      throw new Error(
        `${this.providerName}: SSO token cache is missing client_id/client_secret`,
      );
    }

    const clientSecretExpiresAt = Number(tokenCache.client_secret_expires_at);
    const secretExpiresAt = this.parseUnixTimestamp(clientSecretExpiresAt);
    if (
      !clientSecretExpiresAt ||
      Number.isNaN(secretExpiresAt.getTime()) ||
      Date.now() > secretExpiresAt.getTime()
    ) {
      throw new Error(`${this.providerName}: SSO refresh token has expired`);
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
      throw new Error(
        `${this.providerName}: SSO refresh token response is missing credentials`,
      );
    }

    // 与 Python SDK 对齐：只更新内存 cache（保留轮换后的 refresh_token 供后续刷新周期使用），
    // 永不写回磁盘，避免与 ve cli 的并发写冲突——ve cli 是唯一写入方。
    tokenCache.access_token = accessToken;
    if (this.trimToUndefined(tokenResp.refresh_token)) {
      tokenCache.refresh_token = tokenResp.refresh_token;
    }
    tokenCache.expires_at = new Date(
      Date.now() + Number(tokenResp.expires_in) * 1000,
    ).toISOString();

    return accessToken;
  }

  private async getSsoRoleCredentials(
    accessToken: string,
    profile: any,
    region: string,
  ): Promise<CredentialValue> {
    const accountId = this.trimToUndefined(profile["account-id"]);
    const roleName = this.trimToUndefined(profile["role-name"]);
    if (!accountId) {
      throw new Error(`${this.providerName}: sso mode is missing account-id`);
    }
    if (!roleName) {
      throw new Error(`${this.providerName}: sso mode is missing role-name`);
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
      throw new Error(
        `${this.providerName}: SSO Portal response is missing temporary credentials`,
      );
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
          `${this.providerName}: invalid Expiration in SSO Portal response`,
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
              reject(
                new Error(`failed to parse HTTP response: ${err.message}`),
              );
            }
          });
        },
      );

      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("HTTP request timed out")));
      if (data) {
        req.write(data);
      }
      req.end();
    });
  }

  private requestFormUrlEncoded(
    url: string,
    body: Record<string, string>,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const data = new URLSearchParams(body).toString();
      const client = parsedUrl.protocol === "http:" ? http : https;

      const req = client.request(
        {
          method: "POST",
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          timeout: 30_000,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
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
              const error = new Error(`HTTP ${res.statusCode}: ${raw}`) as any;
              error.statusCode = res.statusCode;
              error.rawBody = raw;
              reject(error);
              return;
            }
            try {
              resolve(raw ? JSON.parse(raw) : {});
            } catch (err: any) {
              reject(
                new Error(`failed to parse HTTP response: ${err.message}`),
              );
            }
          });
        },
      );

      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("HTTP request timed out")));
      req.write(data);
      req.end();
    });
  }

  private isInvalidGrantError(err: any): boolean {
    if (err?.statusCode !== 400 || !err?.rawBody) {
      return false;
    }
    try {
      const parsed = JSON.parse(err.rawBody);
      return parsed?.error === "invalid_grant";
    } catch {
      return false;
    }
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
        `${this.providerName}: HOME / USERPROFILE environment variable is not set; unable to locate config file`,
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
