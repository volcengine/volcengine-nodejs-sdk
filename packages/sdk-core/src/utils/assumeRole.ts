import { v4 as uuidv4 } from "uuid";
import { ClientConfig, AssumeRoleParams } from "../types/types";

// 缓存类型定义
interface CredentialsCache {
  [key: string]: {
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken: string;
    };
    expiresAt: number;
  };
}

// 单例缓存
const credentialsCache: CredentialsCache = {};

// 正在进行的请求缓存（用于并发控制）
const pendingRequests: { [key: string]: Promise<any> | undefined } = {};
// 生成缓存键的函数
function generateCacheKey(clientConfig: ClientConfig): string {
  const { assumeRoleParams } = clientConfig || {};
  const { accessKeyId, secretAccessKey, accountId, roleName } =
    assumeRoleParams || {};
  return `${accessKeyId}-${secretAccessKey}-${accountId}-${roleName}`;
}
export async function getAssumeRole(clientConfig: ClientConfig) {
  // 生成缓存键
  const cacheKey = generateCacheKey(clientConfig);
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
    return pendingRequests[cacheKey];
  }

  // 创建新的请求 promise
  const requestPromise = (async () => {
    try {
      // 懒加载 STSClient 避免循环依赖
      // Client -> credentialsMiddleware -> assumeRole -> STSClient -> Client
      const { STSClient, AssumeRoleCommand } = await import(
        "../client/stsClient"
      );

      const assumeRoleParams =
        clientConfig.assumeRoleParams as AssumeRoleParams;

      const client = new STSClient({
        region: assumeRoleParams?.region || "cn-beijing",
        accessKeyId: assumeRoleParams.accessKeyId,
        secretAccessKey: assumeRoleParams.secretAccessKey,
        host: assumeRoleParams?.host || "sts.volcengineapi.com",
        protocol: assumeRoleParams?.protocol || "https",
      });

      // call assume role api
      const command = new AssumeRoleCommand({
        DurationSeconds: assumeRoleParams?.durationSeconds || 3600,
        RoleTrn: `trn:iam::${assumeRoleParams.accountId}:role/${assumeRoleParams.roleName}`,
        // 唯一值，建议使用 UUID
        RoleSessionName: uuidv4(),
        Policy: assumeRoleParams?.policy,
        Tags: assumeRoleParams?.tags,
      });
      const res = await client.send(command);
      const Credentials = res.Result?.Credentials;

      // 计算过期时间（预留1分钟缓冲时间）
      let expiresAt;
      if (Credentials?.ExpiredTime) {
        expiresAt = new Date(Credentials.ExpiredTime).getTime() - 60 * 1000;
      } else {
        const durationSeconds = assumeRoleParams?.durationSeconds || 3600;
        expiresAt = now + (durationSeconds - 60) * 1000;
      }

      // 创建返回的凭据对象
      const newCredentials = {
        accessKeyId: Credentials?.AccessKeyId || "",
        secretAccessKey: Credentials?.SecretAccessKey || "",
        sessionToken: Credentials?.SessionToken || "",
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
