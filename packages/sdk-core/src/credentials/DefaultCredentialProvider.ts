import type { CredentialValue, Provider } from "./types";
import { EnvironmentVariableCredentialProvider } from "./EnvironmentVariableCredentialProvider";
import { OidcCredentialProvider } from "./OidcCredentialProvider";
import { CLIConfigCredentialProvider } from "./CLIConfigCredentialProvider";
import { EcsRoleCredentialProvider } from "./EcsRoleCredentialProvider";

export interface DefaultCredentialProviderOptions {
  roleName?: string;
  reuseLastProviderEnabled?: boolean;
}

/**
 * 默认凭证链 Provider。
 *
 * 按顺序尝试以下 Provider，第一个成功即返回：
 *   ① EnvironmentVariableCredentialProvider — 环境变量 AK/SK(/Token)
 *   ② OidcCredentialProvider（无参模式）  — 环境变量 OIDC 配置 → STS AssumeRoleWithOIDC
 *   ③ CLIConfigCredentialProvider          — ~/.volcengine/config.json
 *   ④ EcsRoleCredentialProvider            — ECS IMDS（VOLCENGINE_ECS_METADATA_DISABLED=true 时跳过）
 *
 * 全部失败则抛出包含每个 Provider 失败原因的聚合异常。
 */

export class DefaultCredentialProvider implements Provider {
  readonly providerName = "DefaultCredentialProvider";
  private readonly roleName?: string;
  private readonly reuseLastProviderEnabled: boolean;
  private lastSuccessProvider?: Provider;

  constructor(optionsOrReuse?: DefaultCredentialProviderOptions | boolean) {
    if (typeof optionsOrReuse === "boolean") {
      this.reuseLastProviderEnabled = optionsOrReuse;
    } else {
      this.roleName = optionsOrReuse?.roleName;
      this.reuseLastProviderEnabled =
        optionsOrReuse?.reuseLastProviderEnabled ?? true;
    }
  }

  private getProviderFactories(): Array<{
    name: string;
    create: () => Provider;
  }> {
    const factories: Array<{ name: string; create: () => Provider }> = [
      {
        name: "EnvironmentVariableCredentialProvider",
        create: () => new EnvironmentVariableCredentialProvider(),
      },
      {
        name: "OidcCredentialProvider",
        create: () => new OidcCredentialProvider(),
      },
      {
        name: "CLIConfigCredentialProvider",
        create: () => new CLIConfigCredentialProvider(),
      },
    ];

    const disabled = (
      process.env.VOLCENGINE_ECS_METADATA_DISABLED || ""
    ).toLowerCase();
    if (disabled !== "true") {
      factories.push({
        name: "EcsRoleCredentialProvider",
        create: () =>
          new EcsRoleCredentialProvider({ roleName: this.roleName }),
      });
    }

    return factories;
  }

  async resolveCredentials(): Promise<CredentialValue> {
    if (this.reuseLastProviderEnabled && this.lastSuccessProvider) {
      try {
        const credentials = await this.lastSuccessProvider.resolveCredentials();
        return credentials;
      } catch (e: any) {
        this.lastSuccessProvider = undefined;
      }
    }

    const factories = this.getProviderFactories();
    const errors: { providerName: string; message: string }[] = [];

    for (const { name, create } of factories) {
      try {
        const provider = create();
        const credentials = await provider.resolveCredentials();
        if (this.reuseLastProviderEnabled) {
          this.lastSuccessProvider = provider;
        }
        return credentials;
      } catch (e: any) {
        errors.push({
          providerName: name,
          message: e?.message ?? String(e),
        });
      }
    }

    const details = errors
      .map((e) => `  - ${e.providerName}: ${e.message}`)
      .join("\n");
    throw new Error(
      `${this.providerName}: 所有凭证 Provider 均未能获取到有效凭证。\n${details}`,
    );
  }
}
