// 凭证类型
export type { CredentialValue, Provider } from "./types";

// 凭证 Provider
export { StaticCredentialProvider } from "./StaticCredentialProvider";

export { EnvironmentVariableCredentialProvider } from "./EnvironmentVariableCredentialProvider";

export { StsAssumeRoleProvider } from "./StsAssumeRoleProvider";

export { SamlCredentialProvider } from "./SamlCredentialProvider";

export { OidcCredentialProvider } from "./OidcCredentialProvider";

export { CLIConfigCredentialProvider } from "./CLIConfigCredentialProvider";

export { EcsRoleCredentialProvider } from "./EcsRoleCredentialProvider";
export type { EcsRoleCredentialProviderOptions } from "./EcsRoleCredentialProvider";

export { DefaultCredentialProvider } from "./DefaultCredentialProvider";
export type { DefaultCredentialProviderOptions } from "./DefaultCredentialProvider";
