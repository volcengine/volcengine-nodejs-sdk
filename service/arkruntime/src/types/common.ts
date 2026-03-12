// Header constants
export const ClientRequestHeader = "X-Client-Request-Id";
export const RetryAfterHeader = "Retry-After";
export const ClientSessionTokenHeader = "X-Session-Token";
export const ClientEncryptInfoHeader = "X-Encrypt-Info";
export const ClientIsEncryptedHeader = "x-is-encrypted";

// Timeout defaults (seconds)
export const DefaultMandatoryRefreshTimeout = 10 * 60; // 10 min
export const DefaultAdvisoryRefreshTimeout = 30 * 60; // 30 min
export const DefaultStsTimeout = 7 * 24 * 60 * 60; // 7 days

// Retry defaults
export const InitialRetryDelay = 0.5;
export const MaxRetryDelay = 8.0;
export const ErrorRetryBaseDelayMs = 500;
export const ErrorRetryMaxDelayMs = 8000;

export interface PromptTokensDetail {
  cached_tokens: number;
  provisioned_tokens?: number;
}

export interface CompletionTokensDetails {
  reasoning_tokens: number;
  provisioned_tokens?: number;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details: PromptTokensDetail;
  completion_tokens_details: CompletionTokensDetails;
}

export type HttpHeaders = Record<string, string>;
