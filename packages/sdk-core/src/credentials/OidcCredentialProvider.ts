import { promises as fsPromises } from "fs";
import { v4 as uuidv4 } from "uuid";
import type { CredentialValue, Provider } from "./types";
import type { AssumeRoleWithOIDCParams } from "../types/types";
import { loadEnv } from "../utils/env";

// 缓存类型定义
interface CredentialsCache {
  [key: string]: {
    credentials: CredentialValue;
    expiresAt: number;
  };
}

// 单例缓存
const credentialsCache: CredentialsCache = {};

// 正在进行的请求缓存（用于并发控制）
const pendingRequests: { [key: string]: Promise<CredentialValue> | undefined } =
  {};

// 过期时间缓冲（提前 60 秒刷新，避免使用即将过期的凭证）
const DEFAULT_EXPIRE_BUFFER_MS = 60_000;

// 生成缓存键的函数
function generateCacheKey(params: AssumeRoleWithOIDCParams): string {
  const { roleTrn, oidcTokenFile, policy } = params || {};
  return `${roleTrn}-${oidcTokenFile}-${policy ?? ""}`;
}

/**
 * 通过 STS AssumeRoleWithOIDC 获取临时凭证的 Provider。
 *
 * 参数来源（二选一）：
 *   - 构造函数显式传入 AssumeRoleWithOIDCParams
 *   - 未传参数时，自动从环境变量读取（envConfig.credentials.assumeRoleWithOIDC）
 *
 * 特性：
 *   - 模块级单例缓存，相同 accountId/roleName/oidcToken 共享缓存
 *   - 并发请求合并，同一缓存键只会有一个 in-flight 请求
 *   - 过期前预留 60 秒缓冲时间自动刷新
 *   - 懒加载 STSClient 避免循环依赖
 */
export class OidcCredentialProvider implements Provider {
  readonly providerName = "OidcCredentialProvider";
  private readonly params: AssumeRoleWithOIDCParams;

  constructor(params?: AssumeRoleWithOIDCParams) {
    if (params) {
      // 显式传入参数
      if (!params.roleTrn || !params.oidcTokenFile) {
        throw new Error(
          "OidcCredentialProvider: RoleTrn 和 oidcTokenFile 为必填项",
        );
      }
      this.params = params;
    } else {
      // 未传参数，从环境变量获取
      this.params = OidcCredentialProvider.resolveParamsFromEnv();
    }
  }

  /**
   * 从环境变量读取 OIDC 参数。
   *
   * 读取 envConfig.credentials.assumeRoleWithOIDC：
   *   - roleName:       角色名称
   *   - accountId:      账号 ID
   *   - oidcTokenFile:  OIDC Token 文件路径，读取文件内容作为 oidcToken
   *   - host:           可选，STS 服务地址
   *   - Policy:         可选，权限策略
   *   - roleSessionName: 可选，角色会话名称，用于区分不同的会话
   */
  private static resolveParamsFromEnv(): AssumeRoleWithOIDCParams {
    const envConfig = loadEnv();
    const oidcEnv = envConfig.credentials.assumeRoleWithOIDC;

    if (!oidcEnv || !oidcEnv.roleTrn || !oidcEnv.oidcTokenFile) {
      throw new Error(
        "OidcCredentialProvider: 未传入参数，且环境变量 VOLCENGINE_OIDC_ROLE_TRN 和 VOLCENGINE_OIDC_TOKEN_FILE 未设置",
      );
    }

    return {
      roleTrn: oidcEnv.roleTrn,
      oidcTokenFile: oidcEnv.oidcTokenFile,
      host: oidcEnv?.host,
      policy: oidcEnv?.policy,
      roleSessionName: oidcEnv.roleSessionName,
    };
  }

  async resolveCredentials(): Promise<CredentialValue> {
    // 生成缓存键
    const cacheKey = generateCacheKey(this.params);
    const now = Date.now();

    // 检查缓存是否存在且未过期
    if (
      credentialsCache[cacheKey] &&
      credentialsCache[cacheKey].expiresAt > now
    ) {
      return credentialsCache[cacheKey].credentials;
    }

    // 如果已经有正在进行的请求，直接返回该 promise
    if (pendingRequests[cacheKey]) {
      return pendingRequests[cacheKey]!;
    }

    // 创建新的请求 promise
    const requestPromise = (async () => {
      try {
        // 懒加载 STSClient 避免循环依赖
        // Client -> credentialsMiddleware -> OidcCredentialProvider -> STSClient -> Client
        const { STSClient, AssumeRoleWithOIDCCommand } = await import(
          "../client/stsClient"
        );

        const client = new STSClient({
          region: this.params.region || "cn-beijing",
          host: this.params.host || "sts.volcengineapi.com",
          protocol: this.params.protocol || "https",
          _jumpCredential: true,
        });

        // 读取 OIDC Token 文件内容（异步读取，避免阻塞事件循环）
        const OIDCToken = (
          await fsPromises.readFile(this.params.oidcTokenFile, "utf-8")
        ).trim();

        // 调用 AssumeRoleWithOIDC 接口
        const command = new AssumeRoleWithOIDCCommand({
          DurationSeconds: this.params.durationSeconds || 3600,
          RoleTrn: this.params.roleTrn,
          // 唯一值，建议使用 UUID
          RoleSessionName: this.params.roleSessionName || uuidv4(),
          OIDCToken,
          Policy: this.params.policy,
        });
        const res = await client.send(command);
        const Credentials = res.Result?.Credentials;

        if (!Credentials?.AccessKeyId || !Credentials.SecretAccessKey) {
          throw new Error(
            `${this.providerName}: STS AssumeRoleWithOIDC 响应缺少临时凭证`,
          );
        }

        // 计算过期时间（预留1分钟缓冲时间）
        let expiresAt;
        if (Credentials?.ExpiredTime) {
          expiresAt =
            new Date(Credentials.ExpiredTime).getTime() -
            DEFAULT_EXPIRE_BUFFER_MS;
        } else {
          const durationSeconds = this.params.durationSeconds || 3600;
          expiresAt = now + durationSeconds * 1000 - DEFAULT_EXPIRE_BUFFER_MS;
        }

        // 创建返回的凭据对象
        const newCredentials: CredentialValue = {
          accessKeyId: Credentials.AccessKeyId,
          secretAccessKey: Credentials.SecretAccessKey,
          sessionToken: Credentials?.SessionToken,
          providerName: this.providerName,
        };

        // 缓存结果
        credentialsCache[cacheKey] = {
          credentials: newCredentials,
          expiresAt,
        };

        return newCredentials;
      } finally {
        // 无论成功还是失败，请求结束后都要清理 pending 状态
        delete pendingRequests[cacheKey];
      }
    })();

    // 存储 promise
    pendingRequests[cacheKey] = requestPromise;

    return requestPromise;
  }
}
