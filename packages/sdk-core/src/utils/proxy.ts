import fs from "fs";
import { ClientConfig, HttpOptions } from "../types/types";
import { loadEnv } from "./env";

export interface ParsedProxyConfig {
  protocol: "http" | "https";
  host: string;
  port: number;
  auth?: {
    username: string;
    password: string;
  };
}

export function parseProxyUrl(proxyUrl: string): ParsedProxyConfig | undefined {
  if (!proxyUrl) {
    return undefined;
  }

  try {
    const url = new URL(proxyUrl);
    const protocol = url.protocol.replace(/:$/, "");

    if (protocol !== "http" && protocol !== "https") {
      return undefined;
    }

    const parsed: ParsedProxyConfig = {
      protocol,
      host: url.hostname.replace(/^\[|\]$/g, ""),
      port: url.port ? Number(url.port) : protocol === "https" ? 443 : 80,
    };

    if (url.username || url.password) {
      parsed.auth = {
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
      };
    }

    return parsed;
  } catch {
    return undefined;
  }
}

export function resolveHttpOptions(
  config: ClientConfig,
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

export function buildStsHttpOptions(params: {
  proxyUrl?: string;
  caFile?: string;
  insecureSkipVerify?: boolean;
}): HttpOptions | undefined {
  const { proxyUrl, caFile, insecureSkipVerify } = params;

  if (!proxyUrl && !caFile && !insecureSkipVerify) {
    return undefined;
  }

  const httpOptions: HttpOptions = {};

  if (proxyUrl) {
    httpOptions.proxyUrl = proxyUrl;
  }

  if (caFile) {
    httpOptions.caFile = caFile;
  }

  if (insecureSkipVerify) {
    httpOptions.ignoreSSL = true;
  }

  return httpOptions;
}

export function assertCaFileReadable(
  caFile?: string,
  errorPrefix?: string,
): void {
  if (!caFile) {
    return;
  }

  try {
    fs.readFileSync(caFile, "utf8");
  } catch (err: any) {
    const prefix = errorPrefix ? `${errorPrefix}: ` : "";
    throw new Error(
      `${prefix}caFile is not readable: ${err?.message || String(err)}`,
    );
  }
}
