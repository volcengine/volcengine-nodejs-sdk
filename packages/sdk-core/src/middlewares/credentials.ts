import type { Args, MiddlewareFunction, MiddlewareStackOptions } from "./types";
import { PRIORITY } from "./priority";
import type { CredentialValue, Provider } from "../credentials/types";
import { DefaultCredentialProvider } from "../credentials/DefaultCredentialProvider";
import { loadNodeConfig } from "../utils/env";
import { StsAssumeRoleProvider } from "../credentials/StsAssumeRoleProvider";

/**
 * 凭证中间件。
 *
 * 解析策略：
 *   1. 如果 `clientConfig.accessKeyId` 和 `clientConfig.secretAccessKey`
 *      已经设置（例如构造函数直接传入），则按静态凭证使用。
 *   2. 如果 clientConfig 设置了 `credentialProvider`，则调用
 *      `provider.resolveCredentials()` 并注入解析结果。
 *   3. 否则回退到 `DefaultCredentialProvider`，按标准凭证链
 *      解析环境变量 → OIDC → CLI config → ECS IMDS。
 */
export const credentialsMiddleware: {
  middleware: MiddlewareFunction;
  options: MiddlewareStackOptions;
} = {
  middleware: (next, _context) => async (args: Args) => {
    const { clientConfig } = _context;
    const { _jumpCredential } = clientConfig || {};

    if (!clientConfig) {
      return next(args);
    }

    // 不需要AK/SK，直接跳过凭证链
    if (_jumpCredential) {
      return next(args);
    }

    // 兼容旧版 AssumeRoleParams 配置项
    if (clientConfig?.assumeRoleParams && !clientConfig.credentialProvider) {
      const params = clientConfig.assumeRoleParams;
      clientConfig.credentialProvider = new StsAssumeRoleProvider({
        accessKeyId: params.accessKeyId,
        secretAccessKey: params.secretAccessKey,
        roleTrn: `trn:iam::${params.accountId}:role/${params.roleName}`,
        policy: params.policy,
        tags: params.tags,
        durationSeconds: params.durationSeconds,
        region: params.region,
        host: params.host,
        protocol: params.protocol,
      });
    }

    const hasProvider = Boolean(clientConfig?.credentialProvider);
    const hasProviderResolvedCredentials = Boolean(
      clientConfig?._resolvedCredentialsFromProvider,
    );

    // 快速路径：只有真正内联的静态 AK/SK 才能绕过 Provider 链。
    // Provider/默认凭证链解析出的凭证会回写到 clientConfig 以兼容下游签名器，
    // 但每次请求仍必须回到 Provider，由 Provider 内部决定缓存或刷新。
    if (
      clientConfig?.accessKeyId &&
      clientConfig?.secretAccessKey &&
      !hasProvider &&
      !hasProviderResolvedCredentials
    ) {
      return next(args);
    }

    // 确定要使用的凭证 Provider
    const provider: Provider =
      clientConfig?.credentialProvider ??
      (clientConfig._defaultCredentialProvider ??=
        new DefaultCredentialProvider());

    let credentials: CredentialValue;
    try {
      credentials = await provider.resolveCredentials();
    } catch (error) {
      if (hasProvider) {
        throw error;
      }

      const nodeConfig = await loadNodeConfig();
      if (nodeConfig?.accessKeyId && nodeConfig?.secretAccessKey) {
        clientConfig.accessKeyId = nodeConfig.accessKeyId;
        clientConfig.secretAccessKey = nodeConfig.secretAccessKey;
        delete clientConfig.sessionToken;
        return next(args);
      }

      throw error;
    }

    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      throw new Error(
        `${credentials.providerName || provider.providerName}: 未返回有效凭证`,
      );
    }

    // 将解析出的凭证注入 clientConfig，供下游中间件（如签名器）透明使用。
    clientConfig.accessKeyId = credentials.accessKeyId;
    clientConfig.secretAccessKey = credentials.secretAccessKey;
    clientConfig._resolvedCredentialsFromProvider = true;
    if (credentials?.sessionToken) {
      clientConfig.sessionToken = credentials.sessionToken;
    } else {
      delete clientConfig.sessionToken;
    }

    return next(args);
  },
  options: {
    step: PRIORITY.credentialsMiddleware.step,
    name: "credentialsMiddleware",
    priority: PRIORITY.credentialsMiddleware.priority,
  },
};
