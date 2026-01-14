import { ClientConfig } from "../types/types";
import { loadEnv } from "./env";

export function resolveHttpOptions(
  config: ClientConfig
): ClientConfig["httpOptions"] {
  // 读取环境变量中的代理配置（如果配置中未提供）
  const envProxy = loadEnv().proxy;

  const proxyConfig =
    config.httpOptions?.proxy !== undefined
      ? config.httpOptions.proxy
      : envProxy;

  // 合并代理配置到 httpOptions
  const httpOptions = config.httpOptions
    ? {
        ...config.httpOptions,
        ...(proxyConfig ? { proxy: proxyConfig } : {}),
      }
    : proxyConfig
    ? { proxy: proxyConfig }
    : undefined;

  return httpOptions;
}
