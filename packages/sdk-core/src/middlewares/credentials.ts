import type { Args, MiddlewareFunction, MiddlewareStackOptions } from "./types";
import { PRIORITY } from "./priority";
import type { Provider } from "../credentials/types";
import { DefaultCredentialProvider } from "../credentials/DefaultCredentialProvider";
import { loadNodeConfig } from "../utils/env";
import { StsAssumeRoleProvider } from "../credentials/StsAssumeRoleProvider";

/**
 * Credentials middleware.
 *
 * Resolution strategy:
 *   1. If `clientConfig.accessKeyId` and `clientConfig.secretAccessKey` are
 *      already set (e.g. passed directly in constructor) → use them as-is.
 *   2. If a `credentialProvider` (Provider) is set on clientConfig
 *      → call `provider.resolveCredentials()` and inject the result.
 *   3. Otherwise fall back to `DefaultCredentialProvider` which walks the
 *      standard credential chain (env → OIDC → CLI config → ECS IMDS).
 */
export const credentialsMiddleware: {
  middleware: MiddlewareFunction;
  options: MiddlewareStackOptions;
} = {
  middleware: (next, _context) => async (args: Args) => {
    const { clientConfig } = _context;
    const { _jumpCredential } = clientConfig || {};

    // 不需要AK/SK，直接跳过凭证链
    if (_jumpCredential) {
      return next(args);
    }

    // Fast path: credentials already on config (static inline AK/SK)
    if (clientConfig?.accessKeyId && clientConfig?.secretAccessKey) {
      return next(args);
    }

    // 兼容旧版 AssumeRoleParams 配置项
    if (clientConfig?.assumeRoleParams) {
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

    // Determine which provider to use
    const provider: Provider =
      clientConfig?.credentialProvider ?? new DefaultCredentialProvider();

    const credentials = await provider.resolveCredentials();
    // Inject resolved credentials into clientConfig so downstream
    // middleware (signer, etc.) can use them transparently.
    clientConfig.accessKeyId = credentials?.accessKeyId;
    clientConfig.secretAccessKey = credentials?.secretAccessKey;
    if (credentials?.sessionToken) {
      clientConfig.sessionToken = credentials.sessionToken;
    }

    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
      const nodeConfig = await loadNodeConfig();
      clientConfig.accessKeyId = nodeConfig?.accessKeyId;
      clientConfig.secretAccessKey = nodeConfig?.secretAccessKey;
    }

    return next(args);
  },
  options: {
    step: PRIORITY.credentialsMiddleware.step,
    name: "credentialsMiddleware",
    priority: PRIORITY.credentialsMiddleware.priority,
  },
};
