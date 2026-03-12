// All enums are TS string literal unions (replacing Go protobuf int32 enums).
// The wire format is JSON strings, so string literals are the natural TS representation.

export type ResponsesServiceTier = "auto" | "default";
export type ResponsesTruncation = "auto" | "disabled";
export type AnnotationType = "url_citation" | "doc_citation";
export type ResponseImageProcessType = "point" | "grounding" | "rotate" | "zoom";
export type ResponseDoubaoAppFeatureType = "enabled" | "disabled";

export type ItemType =
  | "message"
  | "function_call"
  | "function_call_output"
  | "reasoning"
  | "item_reference"
  | "transcription"
  | "web_search_call"
  | "image_process"
  | "mcp_approval_request"
  | "mcp_approval_response"
  | "mcp_list_tools"
  | "mcp_call"
  | "knowledge_search_call"
  | "doubao_app_call";

export type DoubaoAppBlockType =
  | "output_text"
  | "reasoning_text"
  | "search"
  | "reasoning_search";

export type MessageRole = "user" | "system" | "developer" | "assistant";

export type ContentItemImageDetail = "auto" | "high" | "low";

export type ContentItemType =
  | "input_text"
  | "input_image"
  | "input_video"
  | "output_text"
  | "summary_text"
  | "transcription_text"
  | "input_audio"
  | "input_file";

export type ItemStatus =
  | "in_progress"
  | "completed"
  | "incomplete"
  | "searching"
  | "failed";

export type ResponseStatus =
  | "in_progress"
  | "completed"
  | "incomplete"
  | "failed";

export type ThinkingType = "auto" | "disabled" | "enabled";

export type TextType = "text" | "json_object" | "json_schema";

export type ToolChoiceMode = "auto" | "none" | "required";

export type ToolType =
  | "function"
  | "web_search_preview"
  | "web_search"
  | "image_process"
  | "mcp"
  | "knowledge_search"
  | "doubao_app";

export type UserLocationType = "approximate";

export type ObjectType = "response" | "list";

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export type IncludeType = "image_url";

export type CacheType = "disabled" | "enabled";

export type ChunkingStrategyType = "server_vad";

export type ActionType = "search";

export type SourceType = "toutiao" | "douyin" | "moji" | "search_engine";

export type ApprovalMode = "always" | "never";

export type EventType =
  | "response.created"
  | "response.in_progress"
  | "response.completed"
  | "response.failed"
  | "response.incomplete"
  | "response.output_item.added"
  | "response.output_item.done"
  | "response.content_part.added"
  | "response.content_part.done"
  | "response.output_text.delta"
  | "response.output_text.done"
  | "response.reasoning_summary_text.delta"
  | "response.reasoning_summary_text.done"
  | "response.reasoning_summary_part.added"
  | "response.reasoning_summary_part.done"
  | "response.function_call_arguments.delta"
  | "response.function_call_arguments.done"
  | "error"
  | "response.transcription_part.added"
  | "response.transcription_part.done"
  | "response.transcription_text.delta"
  | "response.transcription_text.done"
  | "response.web_search_call.in_progress"
  | "response.web_search_call.searching"
  | "response.web_search_call.completed"
  | "response.output_text.annotation.added"
  | "response.image_process_call.in_progress"
  | "response.image_process_call.progressing"
  | "response.image_process_call.completed"
  | "response.image_process_call.failed"
  | "response.mcp_list_tools.in_progress"
  | "response.mcp_list_tools.completed"
  | "response.mcp_call.in_progress"
  | "response.mcp_call.arguments_delta"
  | "response.mcp_call.arguments_done"
  | "response.mcp_call.completed"
  | "response.mcp_call.failed"
  | "response.mcp_approval_request"
  | "response.knowledge_search_call.in_progress"
  | "response.knowledge_search_call.searching"
  | "response.knowledge_search_call.completed"
  | "response.knowledge_search_call.failed"
  | "response.doubao_app_call.in_progress"
  | "response.doubao_app_call.failed"
  | "response.doubao_app_call.completed"
  | "response.doubao_app_call.block.added"
  | "response.doubao_app_call.block.done"
  | "response.doubao_app_call.reasoning_text.delta"
  | "response.doubao_app_call.reasoning_text.done"
  | "response.doubao_app_call.output_text.delta"
  | "response.doubao_app_call.output_text.done"
  | "response.doubao_app_call.search.in_progress"
  | "response.doubao_app_call.search.searching"
  | "response.doubao_app_call.search.completed"
  | "response.doubao_app_call.reasoning_search.in_progress"
  | "response.doubao_app_call.reasoning_search.searching"
  | "response.doubao_app_call.reasoning_search.completed";

// Constants for convenience (matching Go's MessageRole_user etc.)
export const MessageRole_user: MessageRole = "user";
export const MessageRole_system: MessageRole = "system";
export const MessageRole_developer: MessageRole = "developer";
export const MessageRole_assistant: MessageRole = "assistant";

export const ContentItemType_input_text: ContentItemType = "input_text";
export const ContentItemType_input_image: ContentItemType = "input_image";
export const ContentItemType_input_video: ContentItemType = "input_video";
export const ContentItemType_input_audio: ContentItemType = "input_audio";
export const ContentItemType_input_file: ContentItemType = "input_file";
export const ContentItemType_output_text: ContentItemType = "output_text";
export const ContentItemType_summary_text: ContentItemType = "summary_text";
