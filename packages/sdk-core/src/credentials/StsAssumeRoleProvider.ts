import { v4 as uuidv4 } from "uuid";
import type { CredentialValue, Provider } from "./types";
import type { StsAssumeRoleParams } from "../types/types";

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

// 生成缓存键的函数
function generateCacheKey(params: StsAssumeRoleParams) {
  const { accessKeyId, secretAccessKey, roleTrn } = params || {};
  return `${accessKeyId}-${secretAccessKey}-${roleTrn}`;
}

/**
 * 通过 STS AssumeRole 获取临时凭证的 Provider。
 *
 * 仅支持通过构造函数显式传入 AssumeRoleParams，不支持从环境变量读取。
 *
 * 特性：
 *   - 模块级单例缓存，相同 AK/SK/roleTrn 共享缓存
 *   - 并发请求合并，同一缓存键只会有一个 in-flight 请求
 *   - 过期前预留 60 秒缓冲时间自动刷新
 *   - 懒加载 STSClient 避免循环依赖
 */
export class StsAssumeRoleProvider implements Provider {
  readonly providerName = "StsAssumeRoleProvider";
  private readonly params: StsAssumeRoleParams;

  constructor(params: StsAssumeRoleParams) {
    if (!params.accessKeyId || !params.secretAccessKey || !params.roleTrn) {
      throw new Error(
        "StsAssumeRoleProvider: accessKeyId, secretAccessKey, roleTrn 为必填项",
      );
    }
    this.params = params;
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
        // Client -> credentialsMiddleware -> StsAssumeRoleProvider -> STSClient -> Client
        const { STSClient, AssumeRoleCommand } = await import(
          "../client/stsClient"
        );

        const client = new STSClient({
          region: this.params.region || "cn-beijing",
          accessKeyId: this.params.accessKeyId,
          secretAccessKey: this.params.secretAccessKey,
          host: this.params.host || "sts.volcengineapi.com",
          protocol: this.params.protocol || "https",
        });

        // 调用 AssumeRole 接口
        const command = new AssumeRoleCommand({
          DurationSeconds: this.params.durationSeconds || 3600,
          RoleTrn: this.params.roleTrn,
          // 唯一值，建议使用 UUID
          RoleSessionName: this.params.roleSessionName || uuidv4(),
          Policy: this.params.policy,
          Tags: this.params.tags,
        });
        const res = await client.send(command);
        const Credentials = res.Result?.Credentials;

        // 计算过期时间（预留1分钟缓冲时间）
        let expiresAt;
        if (Credentials?.ExpiredTime) {
          expiresAt = new Date(Credentials.ExpiredTime).getTime() - 60 * 1000;
        } else {
          const durationSeconds = this.params.durationSeconds || 3600;
          expiresAt = now + (durationSeconds - 60) * 1000;
        }

        // 创建返回的凭据对象
        const newCredentials: CredentialValue = {
          accessKeyId: Credentials?.AccessKeyId || "",
          secretAccessKey: Credentials?.SecretAccessKey || "",
          sessionToken: Credentials?.SessionToken || "",
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
