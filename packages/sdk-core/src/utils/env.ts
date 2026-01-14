import path from "path";
import fs from "fs";

type VolcstackCredentials = {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
};

export type EnvConfig = {
  credentials: VolcstackCredentials;
  enableDualstack?: boolean;
  bootstrapRegionListConf?: string;
  proxy?: {
    protocol: "http" | "https";
    host: string;
    port: number;
  };
};

/**
 * 从当前 Node.js 进程的环境变量读取火山引擎配置信息。
 *
 * 支持的环境变量：
 * - 凭据相关：
 *   - VOLCSTACK_ACCESS_KEY_ID 或 VOLCSTACK_ACCESS_KEY
 *   - VOLCSTACK_SECRET_ACCESS_KEY 或 VOLCSTACK_SECRET_KEY
 *   - VOLCSTACK_SESSION_TOKEN（可选）
 * - 网络相关：
 *   - VOLC_ENABLE_DUALSTACK（可选，布尔值） // 是否启用双栈支持
 *   - VOLC_BOOTSTRAP_REGION_LIST_CONF（可选）  // 自定义引导区域列表配置文件路径
 *   - VOLC_PROXY_PORT（可选） // 代理端口
 *   - VOLC_PROXY_PROTOCOL（可选，默认为http） // 代理协议
 *   - VOLC_PROXY_HOST（可选，默认为127.0.0.1） // 代理地址
 */
export function loadEnvFromProcess(): EnvConfig {
  const env = process.env;
  // 读取凭据信息
  const accessKeyId = env.VOLCSTACK_ACCESS_KEY_ID ?? env.VOLCSTACK_ACCESS_KEY;
  const secretAccessKey =
    env.VOLCSTACK_SECRET_ACCESS_KEY ?? env.VOLCSTACK_SECRET_KEY;
  const sessionToken = env.VOLCSTACK_SESSION_TOKEN;

  // 读取双栈支持配置
  const enableDualstack = env.VOLC_ENABLE_DUALSTACK === "true";

  // 读取引导区域列表配置
  const bootstrapRegionListConf = env.VOLC_BOOTSTRAP_REGION_LIST_CONF;

  // 读取代理配置
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
    },
    enableDualstack,
    bootstrapRegionListConf,
    proxy,
  };
}

// 从环境变量加载配置，若缺失必要凭据则从 ~/.volc/config 读取。(兼容旧版环境变量)
export function loadEnv(): EnvConfig {
  const envConfig = loadEnvFromProcess();

  if (
    process.env.HOME &&
    !(
      envConfig.credentials.accessKeyId && envConfig.credentials.secretAccessKey
    )
  ) {
    const homeConfigPath = path.resolve(process.env.HOME, ".volc/config");
    if (fs.existsSync(homeConfigPath)) {
      const configData = JSON.parse(
        fs.readFileSync(homeConfigPath, { encoding: "utf-8" })
      );
      if (!envConfig.credentials.accessKeyId && configData.VOLC_ACCESSKEY) {
        envConfig.credentials.accessKeyId = configData.VOLC_ACCESSKEY;
      }
      if (!envConfig.credentials.secretAccessKey && configData.VOLC_SECRETKEY) {
        envConfig.credentials.secretAccessKey = configData.VOLC_SECRETKEY;
      }
    }
  }

  return envConfig;
}
