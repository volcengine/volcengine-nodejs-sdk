export { Client } from "./client/Client";
export { HttpRequestError, LogLevel, StrategyName } from "./types/types";
export type {
  ClientConfig,
  CommandOutput,
  DebugLogger,
  DebugOptions,
} from "./types/types";
export { Command } from "./command/Command";
export { buildRequestConfigFromMetaPath } from "./utils/meta";

// Credential providers
export type { CredentialValue, Provider } from "./credentials/types";
export { StaticCredentialProvider } from "./credentials/StaticCredentialProvider";
export { EnvironmentVariableCredentialProvider } from "./credentials/EnvironmentVariableCredentialProvider";
export { StsAssumeRoleProvider } from "./credentials/StsAssumeRoleProvider";
export { SamlCredentialProvider } from "./credentials/SamlCredentialProvider";
export { OidcCredentialProvider } from "./credentials/OidcCredentialProvider";
export { CLIConfigCredentialProvider } from "./credentials/CLIConfigCredentialProvider";
export { EcsRoleCredentialProvider } from "./credentials/EcsRoleCredentialProvider";
export { DefaultCredentialProvider } from "./credentials/DefaultCredentialProvider";
export { presignUrl } from "./utils/signer";
export { buildAuthToken } from "./feature/rds/connect";
