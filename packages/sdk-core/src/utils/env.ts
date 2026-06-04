import path from "path";
import fs from "fs";

/** 火山引擎凭据信息 */
type VolcstackCredentials = {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  /** OIDC 角色扮演相关配置（从环境变量读取） */
  assumeRoleWithOIDC?: {
    roleTrn: string;
    roleSessionName?: string;
    oidcTokenFile: string;
    host?: string;
    policy?: string;
  };
  /** SAML 角色扮演相关配置（从环境变量读取） */
  assumeRoleWithSAML?: {
    roleTrn: string;
    accountId: string;
    samlProviderTrn: string;
    samlAssertion: string;
    host?: string;
    policy?: string;
  };
  /** ECS 实例角色相关配置（从环境变量读取） */
  ecsRole?: {
    roleName: string;
    disabled?: boolean;
  };
  /** CLI 配置文件路径（VOLCENGINE_CLI_CONFIG_FILE） */
  configFilePath?: string;
};

/** 环境变量配置结构 */
export type EnvConfig = {
  /** 凭据信息 */
  credentials: VolcstackCredentials;
  /** 是否启用双栈（IPv4/IPv6）支持 */
  enableDualstack?: boolean;
  /** 自定义引导区域列表配置文件路径 */
  bootstrapRegionListConf?: string;
  /** 代理配置 */
  proxy?: {
    protocol: "http" | "https";
    host: string;
    port: number;
  };
};

/**
 * 从当前 Node.js 进程的环境变量中读取火山引擎 SDK 配置。
 *
 * 凭据优先级：VOLCENGINE_* > VOLCSTACK_*_ID > VOLCSTACK_*
 *
 * 支持的环境变量：
 * - 凭据：
 *   - VOLCENGINE_ACCESS_KEY / VOLCSTACK_ACCESS_KEY_ID / VOLCSTACK_ACCESS_KEY
 *   - VOLCENGINE_SECRET_KEY / VOLCSTACK_SECRET_ACCESS_KEY / VOLCSTACK_SECRET_KEY
 *   - VOLCENGINE_SESSION_TOKEN / VOLCSTACK_SESSION_TOKEN（可选）
 * - OIDC：
 *   - VOLCENGINE_OIDC_ROLE_TRN、VOLCENGINE_OIDC_TOKEN_FILE（必选）
 *   - VOLCENGINE_OIDC_ROLE_SESSION_NAME、VOLCENGINE_OIDC_HOST、VOLCENGINE_OIDC_ROLE_POLICY（可选）
 * - SAML：
 *   - VOLCENGINE_SAML_ROLE_TRN、VOLCENGINE_SAML_ACCOUNT_ID、VOLCENGINE_SAML_PROVIDER_TRN、VOLCENGINE_SAML_ASSERTION（必选）
 *   - VOLCENGINE_SAML_HOST、VOLCENGINE_SAML_POLICY（可选）
 * - ECS 实例角色：
 *   - VOLCENGINE_ECS_METADATA（角色名）
 *   - VOLCENGINE_ECS_METADATA_DISABLED（"true" 时禁用）
 * - CLI 配置文件：
 *   - VOLCENGINE_CLI_CONFIG_FILE
 * - 网络：
 *   - VOLC_ENABLE_DUALSTACK（布尔值，是否启用双栈）
 *   - VOLC_BOOTSTRAP_REGION_LIST_CONF（自定义引导区域列表路径）
 *   - VOLC_PROXY_HOST、VOLC_PROXY_PORT、VOLC_PROXY_PROTOCOL（代理配置）
 */
export function loadEnvFromProcess(): EnvConfig {
  const env = process.env;

  // ---- 凭据（优先级：VOLCENGINE > VOLCSTACK_ID > VOLCSTACK）----
  const accessKeyId =
    env.VOLCENGINE_ACCESS_KEY ??
    env.VOLCSTACK_ACCESS_KEY_ID ??
    env.VOLCSTACK_ACCESS_KEY;
  const secretAccessKey =
    env.VOLCENGINE_SECRET_KEY ??
    env.VOLCSTACK_SECRET_ACCESS_KEY ??
    env.VOLCSTACK_SECRET_KEY;
  const sessionToken =
    env.VOLCENGINE_SESSION_TOKEN ?? env.VOLCSTACK_SESSION_TOKEN;

  // ---- OIDC 角色扮演 ----
  const oidcRoleTrn = env.VOLCENGINE_OIDC_ROLE_TRN;
  const oidcRoleSessionName = env.VOLCENGINE_OIDC_ROLE_SESSION_NAME;
  const oidcTokenFile = env.VOLCENGINE_OIDC_TOKEN_FILE;
  const oidcPolicy = env.VOLCENGINE_OIDC_ROLE_POLICY;
  const oidcStsEndpoint = env.VOLCENGINE_OIDC_STS_ENDPOINT;

  const assumeRoleWithOIDC =
    oidcTokenFile && oidcRoleTrn
      ? {
          roleTrn: oidcRoleTrn,
          roleSessionName: oidcRoleSessionName,
          oidcTokenFile: oidcTokenFile,
          host: oidcStsEndpoint,
          policy: oidcPolicy,
        }
      : undefined;

  // ---- SAML 角色扮演 ----
  const samlRoleTrn = env.VOLCENGINE_SAML_ROLE_TRN;
  const samlAccountId = env.VOLCENGINE_SAML_ACCOUNT_ID;
  const samlProviderTrn = env.VOLCENGINE_SAML_PROVIDER_TRN;
  const samlAssertion = env.VOLCENGINE_SAML_ASSERTION;
  const samlStsEndpoint = env.VOLCENGINE_SAML_ENDPOINT;
  const samlPolicy = env.VOLCENGINE_SAML_POLICY;

  const assumeRoleWithSAML =
    samlRoleTrn && samlAccountId && samlProviderTrn && samlAssertion
      ? {
          roleTrn: samlRoleTrn,
          accountId: samlAccountId,
          samlProviderTrn: samlProviderTrn,
          samlAssertion: samlAssertion,
          host: samlStsEndpoint,
          policy: samlPolicy,
        }
      : undefined;

  // ---- ECS 实例角色 ----
  const ecsMetadataRoleName = env.VOLCENGINE_ECS_METADATA;
  const ecsMetadataDisabledRaw = env.VOLCENGINE_ECS_METADATA_DISABLED;
  const ecsRole = ecsMetadataRoleName
    ? {
        roleName: ecsMetadataRoleName,
        disabled: ecsMetadataDisabledRaw === "true",
      }
    : undefined;

  // ---- CLI 配置文件路径 ----
  const configFilePath = env.VOLCENGINE_CLI_CONFIG_FILE;

  // ---- 双栈支持 ----
  const enableDualstack = env.VOLC_ENABLE_DUALSTACK === "true";

  // ---- 引导区域列表 ----
  const bootstrapRegionListConf = env.VOLC_BOOTSTRAP_REGION_LIST_CONF;

  // ---- 代理配置 ----
  const proxyProtocol = (env.VOLC_PROXY_PROTOCOL || "http") as "http" | "https";
  const proxyHost = env.VOLC_PROXY_HOST;
  const proxyPort = env.VOLC_PROXY_PORT;

  const proxy =
    proxyHost || proxyPort
      ? {
          protocol: proxyProtocol,
          host: proxyHost || "127.0.0.1",
          port: proxyPort ? +proxyPort : proxyProtocol === "https" ? 443 : 80,
        }
      : undefined;

  return {
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken,
      assumeRoleWithOIDC,
      assumeRoleWithSAML,
      ecsRole,
      configFilePath,
    },
    enableDualstack,
    bootstrapRegionListConf,
    proxy,
  };
}

/**
 * 从环境变量加载配置（loadEnvFromProcess 的便捷别名）。
 */
export function loadEnv(): EnvConfig {
  const envConfig = loadEnvFromProcess();
  return envConfig;
}

/**
 * 从旧版本 CLI 配置文件 ~/.volc/config 读取凭据，用于兜底兼容。
 *
 * 配置文件格式：{ VOLC_ACCESSKEY: "...", VOLC_SECRETKEY: "..." }
 *
 * @returns 包含 accessKeyId / secretAccessKey 的对象，若文件不存在则返回空对象；HOME 未设置时返回 undefined
 */
export function loadNodeConfig() {
  const config: any = {};

  if (process.env.HOME) {
    const homeConfigPath = path.resolve(process.env.HOME, ".volc/config");
    if (fs.existsSync(homeConfigPath)) {
      const configData = JSON.parse(
        fs.readFileSync(homeConfigPath, { encoding: "utf-8" }),
      );
      if (configData.VOLC_ACCESSKEY) {
        config.accessKeyId = configData.VOLC_ACCESSKEY;
      }
      if (configData.VOLC_SECRETKEY) {
        config.secretAccessKey = configData.VOLC_SECRETKEY;
      }
    }
    return config;
  }
}
