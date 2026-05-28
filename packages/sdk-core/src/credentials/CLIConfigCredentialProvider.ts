import fs from "fs";
import path from "path";
import type { CredentialValue, Provider } from "./types";
import { loadEnv } from "../utils/env";

/**
 * 从 CLI 配置文件 ~/.volcengine/config.json 读取凭证。
 *
 * 配置文件路径优先级：
 *   1. 环境变量 VOLCENGINE_CLI_CONFIG_FILE（如果设置）
 *   2. ${HOME || USERPROFILE}/.volcengine/config.json
 *
 * Profile 选择：
 *   - configData.profiles[configData.current]
 *
 * 配置文件中字段：access-key、secret-key、session-token（可选）
 */
export class CLIConfigCredentialProvider implements Provider {
  readonly providerName = "CLIConfigCredentialProvider";

  async resolveCredentials(): Promise<CredentialValue> {
    const configPath = this.resolveConfigPath();

    if (!fs.existsSync(configPath)) {
      throw new Error(`${this.providerName}: 配置文件不存在: ${configPath}`);
    }

    let configData: any;
    try {
      configData = JSON.parse(
        fs.readFileSync(configPath, { encoding: "utf-8" }),
      );
    } catch (err: any) {
      throw new Error(
        `${this.providerName}: 解析配置文件失败 (${configPath}): ${err.message}`,
      );
    }

    // 取当前 Profile
    const profile =
      configData?.profiles && configData?.current
        ? configData?.profiles?.[configData.current]
        : undefined;

    if (!profile) {
      throw new Error(`${this.providerName}: 配置文件中未找到有效的 profile`);
    }

    const accessKeyId: string | undefined = profile["access-key"];
    const secretAccessKey: string | undefined = profile["secret-key"];

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        `${this.providerName}: 配置文件中缺少 access-key 或 secret-key`,
      );
    }

    return {
      accessKeyId,
      secretAccessKey,
      sessionToken: profile["session-token"] || undefined,
      providerName: this.providerName,
    };
  }

  /**
   * 解析配置文件路径。
   * 优先级：VOLCENGINE_CLI_CONFIG_FILE 环境变量 > 默认路径 (~/.volcengine/config.json)
   */
  private resolveConfigPath(): string {
    // 兼容 Windows（USERPROFILE）和 Unix（HOME）
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      throw new Error(
        `${this.providerName}: HOME / USERPROFILE 环境变量未设置，无法定位配置文件`,
      );
    }
    // 优先使用环境变量指定的配置文件路径
    const envConfig = loadEnv();
    const configFilePath = envConfig?.credentials?.configFilePath;
    if (configFilePath) {
      return path.resolve(homeDir, configFilePath);
    }

    return path.resolve(homeDir, ".volcengine/config.json");
  }
}
