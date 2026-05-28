import type { CredentialValue, Provider } from "./types";
import { loadEnv } from "../utils/env";

/**
 * 从环境变量读取 AK/SK(/Token)。
 *
 * 直接复用 loadEnvFromProcess() 获取 envConfig.credentials 中的
 * accessKeyId、secretAccessKey、sessionToken。
 *
 * AK + SK 齐全 → 返回凭证（Token 可选）。
 * 否则 → 抛异常，由链继续。
 */
export class EnvironmentVariableCredentialProvider implements Provider {
  readonly providerName = "EnvironmentVariableCredentialProvider";
  private readonly credentials: CredentialValue;

  constructor() {
    const envConfig = loadEnv();
    const { accessKeyId, secretAccessKey, sessionToken } =
      envConfig.credentials;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(`${this.providerName}: 环境变量中未找到有效凭证。`);
    }
    this.credentials = {
      accessKeyId,
      secretAccessKey,
      sessionToken,
      providerName: this.providerName,
    };
  }

  async resolveCredentials(): Promise<CredentialValue> {
    return this.credentials;
  }
}
