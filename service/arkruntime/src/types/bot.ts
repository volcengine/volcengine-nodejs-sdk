import type { Usage, HttpHeaders } from "./common";
import type {
  ChatCompletionMessage,
  ChatCompletionChoice,
  ChatCompletionStreamChoice,
  Tool,
  ToolChoice,
  StreamOptions,
  ResponseFormat,
  Thinking,
} from "./chat-completion";

export interface BotChatCompletionRequest {
  bot_id?: string;
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
  presence_penalty?: number;
  repetition_penalty?: number;
  n?: number;
  response_format?: ResponseFormat;
  thinking?: Thinking;
  metadata?: Record<string, unknown>;
}

export interface BotActionUsage {
  name: string;
  prompt_tokens?: string;
  completion_tokens?: number;
  total_tokens?: number;
  search_count?: number;
  action_name?: string;
  count?: number;
}

export interface BotModelUsage extends Usage {
  name: string;
}

export interface BotToolDetail {
  name: string;
  input: unknown;
  output: unknown;
  created_at: number;
  completed_at: number;
}

export interface BotActionDetail {
  name: string;
  count: number;
  tool_details?: BotToolDetail[];
}

export interface BotUsage {
  model_usage?: BotModelUsage[];
  action_usage?: BotActionUsage[];
  action_details?: BotActionDetail[];
}

export interface BotCoverImage {
  url?: string;
  width?: number;
  height?: number;
}

export interface BotChatResultReference {
  url?: string;
  logo_url?: string;
  mobile_url?: string;
  site_name?: string;
  title?: string;
  cover_image?: BotCoverImage;
  summary?: string;
  publish_time?: string;
  collection_name?: string;
  project?: string;
  doc_id?: string;
  doc_name?: string;
  doc_type?: string;
  doc_title?: string;
  chunk_id?: string;
  chunk_title?: string;
  page_nums?: string;
  origin_text_token_len?: number;
  file_name?: string;
  extra?: Record<string, unknown>;
}

export interface BotChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  service_tier?: string;
  choices: ChatCompletionChoice[];
  usage: Usage;
  metadata?: Record<string, unknown>;
  bot_usage?: BotUsage;
  references?: BotChatResultReference[];
  headers?: HttpHeaders;
}

export interface BotChatCompletionStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  service_tier?: string;
  choices: ChatCompletionStreamChoice[];
  usage?: Usage;
  metadata?: Record<string, unknown>;
  bot_usage?: BotUsage;
  references?: BotChatResultReference[];
}
