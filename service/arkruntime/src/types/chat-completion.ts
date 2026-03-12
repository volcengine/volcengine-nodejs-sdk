import type { Usage, HttpHeaders } from "./common";

// Role constants
export const ChatMessageRoleSystem = "system";
export const ChatMessageRoleUser = "user";
export const ChatMessageRoleAssistant = "assistant";
export const ChatMessageRoleTool = "tool";

// ImageURL detail
export type ImageURLDetail = "high" | "low" | "auto";

// Reasoning effort
export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export interface ChatMessageImageURL {
  url: string;
  detail?: ImageURLDetail;
}

export interface ChatMessageVideoURL {
  url: string;
  fps?: number;
}

// Content part type
export type ChatCompletionMessageContentPartType =
  | "text"
  | "image_url"
  | "video_url";

export interface ChatCompletionMessageContentPart {
  type?: ChatCompletionMessageContentPartType;
  text?: string;
  image_url?: ChatMessageImageURL;
  video_url?: ChatMessageVideoURL;
}

// In TS, the union type naturally handles Go's custom MarshalJSON
export type ChatCompletionMessageContent =
  | string
  | ChatCompletionMessageContentPart[];

export interface ChatCompletionMessage {
  role: string;
  content?: ChatCompletionMessageContent | null;
  reasoning_content?: string;
  name?: string;
  function_call?: FunctionCall;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: ToolType;
  function: FunctionCall;
  index?: number;
}

export interface FunctionCall {
  name?: string;
  arguments?: string;
}

// Thinking
export type ThinkingType = "enabled" | "disabled" | "auto";

export interface Thinking {
  type: ThinkingType;
}

// Stream options
export interface StreamOptions {
  include_usage?: boolean;
  chunk_include_usage?: boolean;
}

// Tool type
export type ToolType = "function";

export interface Tool {
  type: ToolType;
  function?: FunctionDefinition;
}

// Tool choice
export const ToolChoiceAuto = "auto";
export const ToolChoiceNone = "none";
export const ToolChoiceRequired = "required";

export interface ToolChoice {
  type: ToolType;
  function?: ToolChoiceFunction;
}

export interface ToolChoiceFunction {
  name: string;
}

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: unknown;
}

// LogProbs
export interface TopLogProbs {
  token: string;
  logprob: number;
  bytes?: number[];
}

export interface LogProb {
  token: string;
  logprob: number;
  bytes?: number[];
  top_logprobs: TopLogProbs[];
}

export interface LogProbs {
  content: LogProb[];
}

// Response format
export type ResponseFormatType = "json_schema" | "json_object" | "text";

export interface ResponseFormatJSONSchema {
  name: string;
  description: string;
  schema: unknown;
  strict: boolean;
}

export interface ResponseFormat {
  type: ResponseFormatType;
  json_schema?: ResponseFormatJSONSchema;
  /** @deprecated use json_schema instead */
  schema?: unknown;
}

// Finish reason
export type FinishReason =
  | "stop"
  | "length"
  | "function_call"
  | "tool_calls"
  | "content_filter"
  | null;

// Moderation hit type
export type ModerationHitType = "violence" | "severe_violation";

// Chat completion request
export interface ChatCompletionRequest {
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
  parallel_tool_calls?: boolean;
  service_tier?: string;
  thinking?: Thinking;
  max_completion_tokens?: number;
  reasoning_effort?: ReasoningEffort;
}

// Chat completion choice
export interface ChatCompletionChoice {
  index: number;
  message: ChatCompletionMessage;
  finish_reason: FinishReason;
  moderation_hit_type?: ModerationHitType;
  logprobs?: LogProbs;
}

// Chat completion response
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  service_tier?: string;
  choices: ChatCompletionChoice[];
  usage: Usage;
  headers?: HttpHeaders;
}

// Stream types
export interface ChatCompletionStreamChoiceDelta {
  content?: string;
  role?: string;
  reasoning_content?: string;
  function_call?: FunctionCall;
  tool_calls?: ToolCall[];
}

export interface ChatCompletionStreamChoice {
  index: number;
  delta: ChatCompletionStreamChoiceDelta;
  logprobs?: LogProbs;
  finish_reason: FinishReason;
  moderation_hit_type?: ModerationHitType;
}

export interface ChatCompletionStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  service_tier?: string;
  choices: ChatCompletionStreamChoice[];
  usage?: Usage;
}
