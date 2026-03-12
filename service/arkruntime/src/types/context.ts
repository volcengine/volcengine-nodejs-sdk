import type { Usage, HttpHeaders } from "./common";
import type {
  ChatCompletionMessage,
  Tool,
  ToolChoice,
  StreamOptions,
} from "./chat-completion";

export type TruncationStrategyType = "last_history_tokens" | "rolling_tokens";

export type ContextMode = "session" | "common_prefix";

export interface TruncationStrategy {
  type: TruncationStrategyType;
  last_history_tokens?: number;
  rolling_tokens?: boolean;
  max_window_tokens?: number;
  rolling_window_tokens?: number;
}

export interface CreateContextRequest {
  model: string;
  mode: ContextMode;
  messages: ChatCompletionMessage[];
  ttl?: number;
  truncation_strategy?: TruncationStrategy;
}

export interface CreateContextResponse {
  id: string;
  mode: ContextMode;
  model: string;
  ttl?: number;
  truncation_strategy?: TruncationStrategy;
  usage: Usage;
  headers?: HttpHeaders;
}

export interface ContextChatCompletionRequest {
  context_id: string;
  mode: ContextMode;
  model: string;
  messages: ChatCompletionMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string[];
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  logprobs?: boolean;
  top_logprobs?: number;
  user?: string;
  function_call?: unknown;
  tools?: Tool[];
  tool_choice?: string | ToolChoice;
  stream_options?: StreamOptions;
  metadata?: Record<string, unknown>;
}
