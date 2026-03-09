import type {
  EventType,
  ItemType,
  MessageRole,
  ContentItemType,
  ContentItemImageDetail,
  ItemStatus,
  ResponseStatus,
  ThinkingType,
  TextType,
  ToolChoiceMode,
  ToolType,
  UserLocationType,
  ObjectType,
  ReasoningEffort,
  IncludeType,
  CacheType,
  ChunkingStrategyType,
  ActionType,
  SourceType,
  ApprovalMode,
  AnnotationType,
  ResponseImageProcessType,
  ResponsesServiceTier,
  ResponsesTruncation,
  DoubaoAppBlockType,
  ResponseDoubaoAppFeatureType,
} from "./enums";

// Re-export enums for convenience
export type {
  EventType,
  ItemType,
  MessageRole,
  ContentItemType,
  ContentItemImageDetail,
  ItemStatus,
  ResponseStatus,
  ThinkingType,
  TextType,
  ToolChoiceMode,
  ToolType,
  UserLocationType,
  ObjectType,
  ReasoningEffort,
  IncludeType,
  CacheType,
  ChunkingStrategyType,
  ActionType,
  SourceType,
  ApprovalMode,
  AnnotationType,
  ResponseImageProcessType,
  ResponsesServiceTier,
  ResponsesTruncation,
  DoubaoAppBlockType,
  ResponseDoubaoAppFeatureType,
};

// ---------------------------------------------------------------------------
// Common / Shared types
// ---------------------------------------------------------------------------

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: PromptTokensDetail;
  completion_tokens_details?: CompletionTokensDetail;
}

export interface PromptTokensDetail {
  cached_tokens?: number;
}

export interface CompletionTokensDetail {
  reasoning_tokens?: number;
}

export interface Error {
  code?: string;
  message: string;
}

export interface IncompleteDetails {
  reason?: string;
}

// ---------------------------------------------------------------------------
// Annotation / CoverImage
// ---------------------------------------------------------------------------

export interface CoverImage {
  url?: string;
  width?: number;
  height?: number;
}

export interface Annotation {
  type: AnnotationType;
  title: string;
  url: string;
  logo_url?: string;
  mobile_url?: string;
  site_name?: string;
  publish_time?: string;
  cover_image?: CoverImage;
  summary?: string;
  freshness_info?: string;
  doc_id?: string;
  doc_name?: string;
  chunk_id?: number;
  chunk_attachment?: Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Content Items
// ---------------------------------------------------------------------------

export interface TextTranslationOptions {
  source_language: string;
  target_language: string;
}

export interface ImagePixelLimit {
  max_pixels?: number;
  min_pixels?: number;
}

export interface ContentItemText {
  type: ContentItemType;
  text: string;
  translation_options?: TextTranslationOptions;
}

export interface ContentItemImage {
  type: ContentItemType;
  detail?: ContentItemImageDetail;
  image_url?: string;
  file_id?: string;
  image_pixel_limit?: ImagePixelLimit;
}

export interface ContentItemVideo {
  type: ContentItemType;
  video_url: string;
  file_id?: string;
  fps?: number;
}

export interface AudioChunkingStrategy {
  type: ChunkingStrategyType;
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  threshold?: number;
}

export interface ContentItemAudio {
  type: ContentItemType;
  chunking_strategy?: AudioChunkingStrategy;
  audio_url: string;
  file_id?: string;
}

export interface ContentItemFile {
  type: ContentItemType;
  file_data?: string;
  file_id?: string;
  file_url?: string;
  filename?: string;
}

export interface AudioChunk {
  start_time?: number;
  end_time?: number;
  text?: string;
}

/** Discriminated union: `type` field selects variant */
export type ContentItem =
  | ContentItemText
  | ContentItemImage
  | ContentItemVideo
  | ContentItemAudio
  | ContentItemFile;

/** MessageContent can be a simple string or an array of ContentItem */
export type MessageContent = string | ContentItem[];

// ---------------------------------------------------------------------------
// Output Content Items
// ---------------------------------------------------------------------------

export interface OutputContentItemText {
  type: ContentItemType;
  text: string;
  annotations?: Annotation[];
}

export type OutputContentItem = OutputContentItemText;

// ---------------------------------------------------------------------------
// Reasoning Summary
// ---------------------------------------------------------------------------

export interface ReasoningSummaryPart {
  type: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------

export interface TranscriptionPart {
  type: ContentItemType;
  text: string;
  chunks?: AudioChunk[];
}

// ---------------------------------------------------------------------------
// Input Items (what the user sends)
// ---------------------------------------------------------------------------

export interface ItemEasyMessage {
  type?: ItemType;
  role: MessageRole;
  content: MessageContent;
  id?: string;
  partial?: boolean;
}

export interface ItemInputMessage {
  type?: ItemType;
  role: MessageRole;
  content: ContentItem[];
  status?: ItemStatus;
  id?: string;
  partial?: boolean;
}

export interface ItemOutputMessage {
  type?: ItemType;
  role: MessageRole;
  content: OutputContentItem[];
  status?: ItemStatus;
  id?: string;
}

export interface ItemFunctionToolCall {
  arguments: string;
  call_id: string;
  name: string;
  type: ItemType;
  id?: string;
  status?: ItemStatus;
}

export interface ItemFunctionToolCallOutput {
  output: string;
  call_id: string;
  type: ItemType;
  id?: string;
  status?: ItemStatus;
}

export interface ItemReasoning {
  id?: string;
  type: ItemType;
  summary?: ReasoningSummaryPart[];
  status: ItemStatus;
}

export interface ItemTranscription {
  id?: string;
  type: ItemType;
  transcription?: TranscriptionPart[];
  status: ItemStatus;
}

export interface ItemReference {
  id: string;
  type?: ItemType;
}

// ---------------------------------------------------------------------------
// Web Search
// ---------------------------------------------------------------------------

export interface Action {
  query: string;
  type: ActionType;
}

export interface ItemFunctionWebSearch {
  type: ItemType;
  action?: Action;
  status: ItemStatus;
  id: string;
}

// ---------------------------------------------------------------------------
// Image Process
// ---------------------------------------------------------------------------

export interface ResponseImageProcessAction {
  type: string;
  result_image_url?: string;
}

export interface ResponseImageProcessError {
  message: string;
}

export interface ResponseImageProcessPointArgs {
  image_index: number;
  points: string;
  draw_line: boolean;
}

export interface ResponseImageProcessGroundingArgs {
  image_index: number;
  bbox_str: string;
  crop: boolean;
}

export interface ResponseImageProcessRotateArgs {
  image_index: number;
  degree: number;
}

export interface ResponseImageProcessZoomArgs {
  image_index: number;
  bbox_str: string;
}

export type ResponseImageProcessArgs =
  | ResponseImageProcessPointArgs
  | ResponseImageProcessGroundingArgs
  | ResponseImageProcessRotateArgs
  | ResponseImageProcessZoomArgs;

export interface ItemFunctionImageProcess {
  type: ItemType;
  action?: ResponseImageProcessAction;
  arguments?: ResponseImageProcessArgs;
  status: ItemStatus;
  id: string;
  error?: ResponseImageProcessError;
}

// ---------------------------------------------------------------------------
// Image Process Options (for tool config)
// ---------------------------------------------------------------------------

export interface ImageProcessPointOptions {
  enabled?: boolean;
}

export interface ImageProcessGroundingOptions {
  enabled?: boolean;
}

export interface ImageProcessZoomOptions {
  enabled?: boolean;
}

export interface ImageProcessRotateOptions {
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// MCP
// ---------------------------------------------------------------------------

export interface McpTool {
  name: string;
  description: string;
  input_schema?: Record<string, unknown>;
}

export interface ItemFunctionMcpApprovalRequest {
  type: ItemType;
  server_label: string;
  arguments: string;
  name: string;
  id?: string;
}

export interface ItemFunctionMcpApprovalResponse {
  type: ItemType;
  id?: string;
  approve: boolean;
  approval_request_id: string;
  reason?: string;
}

export interface ItemFunctionMcpListTools {
  type: ItemType;
  server_label: string;
  tools?: McpTool[];
  id?: string;
  error?: string;
}

export interface ItemFunctionMcpCall {
  type: ItemType;
  server_label: string;
  approval_request_id?: string;
  arguments: string;
  error?: string;
  name: string;
  output?: string;
  id?: string;
}

// ---------------------------------------------------------------------------
// Knowledge Search
// ---------------------------------------------------------------------------

export interface ItemFunctionKnowledgeSearch {
  type: ItemType;
  queries?: string[];
  knowledge_resource_id: string;
  status: ItemStatus;
  id?: string;
}

// ---------------------------------------------------------------------------
// Doubao App
// ---------------------------------------------------------------------------

export interface DoubaoAppCallBlockOutputText {
  id?: string;
  type: DoubaoAppBlockType;
  text: string;
  status: ItemStatus;
  parent_id?: string;
}

export interface DoubaoAppCallBlockReasoningText {
  id?: string;
  type: DoubaoAppBlockType;
  text: string;
  status: ItemStatus;
  parent_id?: string;
}

export interface DoubaoAppSearchTextItem {
  index?: number;
  title?: string;
  site_name?: string;
  url?: string;
  mobile_url?: string;
  logo_url?: string;
  cover_image?: CoverImage;
  publish_time?: string;
  freshness_info?: string;
  summary?: string;
  doc_id?: string;
  doc_name?: string;
  chunk_id?: number;
  chunk_attachment?: Record<string, unknown>[];
}

export interface DoubaoAppSearchResult {
  type?: string;
  search_result?: DoubaoAppSearchTextItem[];
}

export interface DoubaoAppCallBlockSearch {
  id?: string;
  type: DoubaoAppBlockType;
  status: ItemStatus;
  parent_id?: string;
  result?: DoubaoAppSearchResult;
}

export interface DoubaoAppCallBlockReasoningSearch {
  id?: string;
  type: DoubaoAppBlockType;
  status: ItemStatus;
  parent_id?: string;
  result?: DoubaoAppSearchResult;
}

export type DoubaoAppCallBlock =
  | DoubaoAppCallBlockOutputText
  | DoubaoAppCallBlockReasoningText
  | DoubaoAppCallBlockSearch
  | DoubaoAppCallBlockReasoningSearch;

export interface ItemDoubaoAppCall {
  id?: string;
  type: ItemType;
  feature?: string;
  blocks?: DoubaoAppCallBlock[];
  status: ItemStatus;
}

export interface DoubaoAppFeature {
  search?: ResponseDoubaoAppFeatureType;
  summary?: ResponseDoubaoAppFeatureType;
}

// ---------------------------------------------------------------------------
// InputItem — discriminated union over `type`
// ---------------------------------------------------------------------------

export type InputItem =
  | ItemEasyMessage
  | ItemInputMessage
  | ItemOutputMessage
  | ItemFunctionToolCall
  | ItemFunctionToolCallOutput
  | ItemReasoning
  | ItemReference
  | ItemFunctionImageProcess
  | ItemFunctionMcpApprovalRequest
  | ItemFunctionMcpApprovalResponse
  | ItemFunctionMcpListTools
  | ItemFunctionMcpCall
  | ItemFunctionWebSearch
  | ItemFunctionKnowledgeSearch
  | ItemDoubaoAppCall;

/** ResponsesInput can be a simple string or array of InputItem */
export type ResponsesInput = string | InputItem[];

// ---------------------------------------------------------------------------
// Output Items (what the model returns)
// ---------------------------------------------------------------------------

export type OutputItem =
  | ItemOutputMessage
  | ItemFunctionToolCall
  | ItemReasoning
  | ItemTranscription
  | ItemFunctionWebSearch
  | ItemFunctionImageProcess
  | ItemFunctionMcpApprovalRequest
  | ItemFunctionMcpListTools
  | ItemFunctionMcpCall
  | ItemFunctionKnowledgeSearch
  | ItemDoubaoAppCall;

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export interface ToolFunction {
  name: string;
  strict?: boolean;
  type: ToolType;
  description?: string;
  /** JSON schema describing the function parameters */
  parameters?: Record<string, unknown>;
}

export interface UserLocation {
  type: UserLocationType;
  city?: string;
  country?: string;
  region?: string;
  timezone?: string;
}

export interface ToolWebSearch {
  type: ToolType;
  limit?: number;
  user_location?: UserLocation;
  sources?: SourceType[];
  max_keyword?: number;
}

export interface ToolImageProcess {
  type: ToolType;
  point?: ImageProcessPointOptions;
  grounding?: ImageProcessGroundingOptions;
  zoom?: ImageProcessZoomOptions;
  rotate?: ImageProcessRotateOptions;
}

export interface McpAllowedToolsFilter {
  tool_names: string[];
}

/** allowed_tools can be string[] (list) or {tool_names: string[]} (filter) */
export type McpAllowedTools = string[] | McpAllowedToolsFilter;

export interface McpToolApprovalFilterAlways {
  tool_names?: string[];
}

export interface McpToolApprovalFilterNever {
  tool_names?: string[];
}

export interface McpToolApprovalFilter {
  always?: McpToolApprovalFilterAlways;
  never?: McpToolApprovalFilterNever;
}

/** require_approval can be a mode string ("always"|"never") or a filter object */
export type McpRequireApproval = ApprovalMode | McpToolApprovalFilter;

export interface ToolMcp {
  type: ToolType;
  server_label: string;
  server_url: string;
  allowed_tools?: McpAllowedTools;
  headers?: Record<string, string>;
  require_approval?: McpRequireApproval;
  server_description?: string;
}

export interface ToolKnowledgeSearch {
  type: ToolType;
  knowledge_resource_id: string;
  description?: string;
  limit?: number;
  dense_weight?: number;
  doc_filter?: Record<string, unknown>;
  ranking_options?: Record<string, unknown>;
  max_keyword?: number;
}

export interface ToolDoubaoApp {
  type: ToolType;
  feature?: DoubaoAppFeature;
  user_location?: UserLocation;
}

export type ResponsesTool =
  | ToolFunction
  | ToolWebSearch
  | ToolImageProcess
  | ToolMcp
  | ToolKnowledgeSearch
  | ToolDoubaoApp;

// ---------------------------------------------------------------------------
// Tool Choice
// ---------------------------------------------------------------------------

export interface FunctionToolChoice {
  type: ToolType;
  name: string;
}

export interface McpToolChoice {
  type: ToolType;
  server_label: string;
  name?: string;
}

export interface WebSearchToolChoice {
  type: ToolType;
}

export interface KnowledgeSearchToolChoice {
  type: ToolType;
}

/** tool_choice can be a mode string or a specific tool choice object */
export type ResponsesToolChoice =
  | ToolChoiceMode
  | FunctionToolChoice
  | McpToolChoice
  | WebSearchToolChoice
  | KnowledgeSearchToolChoice;

// ---------------------------------------------------------------------------
// Thinking / Reasoning / Caching / Text
// ---------------------------------------------------------------------------

export interface ResponsesThinking {
  type?: ThinkingType;
}

export interface ResponsesReasoning {
  effort: ReasoningEffort;
}

export interface ResponsesCaching {
  type?: CacheType;
  prefix?: boolean;
}

export interface TextFormat {
  type: TextType;
  schema?: Record<string, unknown>;
  name?: string;
  description?: string;
  strict?: boolean;
}

export interface ResponsesText {
  format?: TextFormat;
}

// ---------------------------------------------------------------------------
// Context Management (matches Go contextmanagement package)
// ---------------------------------------------------------------------------

export interface ContextManagement {
  truncation?: ResponsesTruncation;
}

export interface ContextManagementResponse {
  truncation?: ResponsesTruncation;
}

// ---------------------------------------------------------------------------
// ResponsesRequest — the main request body
// ---------------------------------------------------------------------------

export interface ResponsesRequest {
  input?: ResponsesInput;
  model: string;
  max_output_tokens?: number;
  previous_response_id?: string;
  thinking?: ResponsesThinking;
  service_tier?: ResponsesServiceTier;
  store?: boolean;
  stream?: boolean;
  temperature?: number;
  tools?: ResponsesTool[];
  top_p?: number;
  instructions?: string;
  include?: IncludeType[];
  caching?: ResponsesCaching;
  text?: ResponsesText;
  expire_at?: number;
  tool_choice?: ResponsesToolChoice;
  parallel_tool_calls?: boolean;
  max_tool_calls?: number;
  reasoning?: ResponsesReasoning;
  context_management?: ContextManagement;
}

// ---------------------------------------------------------------------------
// ResponseObject — the main response
// ---------------------------------------------------------------------------

export interface ResponseObject {
  created_at: number;
  error?: Error;
  id: string;
  incomplete_details?: IncompleteDetails;
  max_output_tokens?: number;
  model: string;
  object: ObjectType;
  output: OutputItem[];
  previous_response_id?: string;
  thinking?: ResponsesThinking;
  service_tier?: ResponsesServiceTier;
  status: ResponseStatus;
  temperature?: number;
  tools?: ResponsesTool[];
  top_p?: number;
  usage?: Usage;
  caching?: ResponsesCaching;
  text?: ResponsesText;
  instructions?: string;
  store?: boolean;
  expire_at?: number;
  tool_choice?: ResponsesToolChoice;
  parallel_tool_calls?: boolean;
  max_tool_calls?: number;
  reasoning?: ResponsesReasoning;
  context_management?: ContextManagementResponse;
}

// ---------------------------------------------------------------------------
// Get / Delete / List requests
// ---------------------------------------------------------------------------

export interface GetResponseRequest {
  include?: IncludeType[];
}

export interface ListInputItemsRequest {
  include?: IncludeType[];
  limit?: number;
  order?: "asc" | "desc";
  after?: string;
  before?: string;
}

export interface ListInputItemsResponse {
  object: ObjectType;
  data: InputItem[];
  first_id?: string;
  last_id?: string;
  has_more: boolean;
}

// ---------------------------------------------------------------------------
// Streaming Event types
// ---------------------------------------------------------------------------

export interface ResponseEvent {
  type: EventType;
  response: ResponseObject;
  sequence_number: number;
}

export interface ResponseInProgressEvent {
  type: EventType;
  response: ResponseObject;
  sequence_number: number;
}

export interface ResponseCompletedEvent {
  type: EventType;
  response: ResponseObject;
  sequence_number: number;
}

export interface ResponseFailedEvent {
  type: EventType;
  response: ResponseObject;
  sequence_number: number;
}

export interface ResponseIncompleteEvent {
  type: EventType;
  response: ResponseObject;
  sequence_number: number;
}

export interface ItemEvent {
  type: EventType;
  item: OutputItem;
  output_index: number;
  sequence_number: number;
}

export interface ItemDoneEvent {
  type: EventType;
  item: OutputItem;
  output_index: number;
  sequence_number: number;
}

export interface ContentPartEvent {
  type: EventType;
  part: OutputContentItem;
  item_id: string;
  output_index: number;
  content_index: number;
  sequence_number: number;
}

export interface ContentPartDoneEvent {
  type: EventType;
  part: OutputContentItem;
  item_id: string;
  output_index: number;
  content_index: number;
  sequence_number: number;
}

export interface OutputTextEvent {
  type: EventType;
  delta: string;
  item_id: string;
  output_index: number;
  content_index: number;
  sequence_number: number;
  annotations?: Annotation[];
}

export interface OutputTextDoneEvent {
  type: EventType;
  text: string;
  item_id: string;
  output_index: number;
  content_index: number;
  sequence_number: number;
  annotations?: Annotation[];
}

export interface ResponseAnnotationAddedEvent {
  type: EventType;
  annotation: Annotation;
  item_id: string;
  output_index: number;
  content_index: number;
  annotation_index: number;
  sequence_number: number;
}

export interface ReasoningSummaryPartEvent {
  type: EventType;
  part: ReasoningSummaryPart;
  item_id: string;
  output_index: number;
  summary_index: number;
  sequence_number: number;
}

export interface ReasoningSummaryPartDoneEvent {
  type: EventType;
  part: ReasoningSummaryPart;
  item_id: string;
  output_index: number;
  summary_index: number;
  sequence_number: number;
}

export interface ReasoningSummaryTextEvent {
  type: EventType;
  delta: string;
  item_id: string;
  output_index: number;
  summary_index: number;
  sequence_number: number;
}

export interface ReasoningSummaryTextDoneEvent {
  type: EventType;
  text: string;
  item_id: string;
  output_index: number;
  summary_index: number;
  sequence_number: number;
}

export interface FunctionCallArgumentsEvent {
  type: EventType;
  delta: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
  call_id?: string;
}

export interface FunctionCallArgumentsDoneEvent {
  type: EventType;
  arguments: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
  call_id?: string;
}

export interface TranscriptionPartEvent {
  type: EventType;
  part: TranscriptionPart;
  item_id: string;
  output_index: number;
  content_index: number;
  sequence_number: number;
}

export interface TranscriptionPartDoneEvent {
  type: EventType;
  part: TranscriptionPart;
  item_id: string;
  output_index: number;
  content_index: number;
  sequence_number: number;
}

export interface TranscriptionTextEvent {
  type: EventType;
  delta: string;
  item_id: string;
  output_index: number;
  content_index: number;
  sequence_number: number;
  chunks?: AudioChunk[];
}

export interface TranscriptionTextDoneEvent {
  type: EventType;
  text: string;
  item_id: string;
  output_index: number;
  content_index: number;
  sequence_number: number;
  chunks?: AudioChunk[];
}

export interface ErrorEvent {
  type: EventType;
  message: string;
  code?: string;
  sequence_number: number;
}

// ---------------------------------------------------------------------------
// Web Search Events
// ---------------------------------------------------------------------------

export interface ResponseWebSearchCallInProgressEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseWebSearchCallSearchingEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseWebSearchCallCompletedEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

// ---------------------------------------------------------------------------
// Image Process Events
// ---------------------------------------------------------------------------

export interface ResponseImageProcessCallInProgressEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseImageProcessCallProcessingEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseImageProcessCallCompletedEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseImageProcessCallFailedEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

// ---------------------------------------------------------------------------
// MCP Events
// ---------------------------------------------------------------------------

export interface ResponseMcpListToolsInProgressEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseMcpListToolsCompletedEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseMcpCallInProgressEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseMcpCallArgumentsDeltaEvent {
  type: EventType;
  delta: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseMcpCallArgumentsDoneEvent {
  type: EventType;
  arguments: string;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseMcpCallCompletedEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseMcpCallFailedEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseMcpApprovalRequestEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

// ---------------------------------------------------------------------------
// Knowledge Search Events
// ---------------------------------------------------------------------------

export interface ResponseKnowledgeSearchCallInProgressEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseKnowledgeSearchCallSearchingEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseKnowledgeSearchCallCompletedEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseKnowledgeSearchCallFailedEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

// ---------------------------------------------------------------------------
// Doubao App Events
// ---------------------------------------------------------------------------

export interface ResponseDoubaoAppCallInProgressEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseDoubaoAppCallFailedEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseDoubaoAppCallCompletedEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseDoubaoAppCallBlockAddedEvent {
  type: EventType;
  block: DoubaoAppCallBlock;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseDoubaoAppCallBlockDoneEvent {
  type: EventType;
  block: DoubaoAppCallBlock;
  item_id: string;
  output_index: number;
  sequence_number: number;
}

export interface ResponseDoubaoAppCallReasoningTextDeltaEvent {
  type: EventType;
  delta: string;
  item_id: string;
  output_index: number;
  block_index: number;
  sequence_number: number;
}

export interface ResponseDoubaoAppCallReasoningTextDoneEvent {
  type: EventType;
  text: string;
  item_id: string;
  output_index: number;
  block_index: number;
  sequence_number: number;
}

export interface ResponseDoubaoAppCallOutputTextDeltaEvent {
  type: EventType;
  delta: string;
  item_id: string;
  output_index: number;
  block_index: number;
  sequence_number: number;
}

export interface ResponseDoubaoAppCallOutputTextDoneEvent {
  type: EventType;
  text: string;
  item_id: string;
  output_index: number;
  block_index: number;
  sequence_number: number;
}

export interface ResponseDoubaoAppCallReasoningSearchInProgressEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  block_index: number;
  sequence_number: number;
}

export interface ResponseDoubaoAppCallReasoningSearchSearchingEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  block_index: number;
  sequence_number: number;
  search_result?: DoubaoAppSearchTextItem[];
}

export interface ResponseDoubaoAppCallReasoningSearchCompletedEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  block_index: number;
  sequence_number: number;
  search_result?: DoubaoAppSearchTextItem[];
}

export interface ResponseDoubaoAppCallSearchInProgressEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  block_index: number;
  sequence_number: number;
}

export interface ResponseDoubaoAppCallSearchSearchingEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  block_index: number;
  sequence_number: number;
  search_result?: DoubaoAppSearchTextItem[];
}

export interface ResponseDoubaoAppCallSearchCompletedEvent {
  type: EventType;
  item_id: string;
  output_index: number;
  block_index: number;
  sequence_number: number;
  search_result?: DoubaoAppSearchTextItem[];
}

// ---------------------------------------------------------------------------
// Event — the top-level streaming event (discriminated by `type`)
// ---------------------------------------------------------------------------

export type Event =
  | ResponseEvent
  | ResponseInProgressEvent
  | ResponseCompletedEvent
  | ResponseFailedEvent
  | ResponseIncompleteEvent
  | ItemEvent
  | ItemDoneEvent
  | ContentPartEvent
  | ContentPartDoneEvent
  | OutputTextEvent
  | OutputTextDoneEvent
  | ResponseAnnotationAddedEvent
  | ReasoningSummaryPartEvent
  | ReasoningSummaryPartDoneEvent
  | ReasoningSummaryTextEvent
  | ReasoningSummaryTextDoneEvent
  | FunctionCallArgumentsEvent
  | FunctionCallArgumentsDoneEvent
  | TranscriptionPartEvent
  | TranscriptionPartDoneEvent
  | TranscriptionTextEvent
  | TranscriptionTextDoneEvent
  | ErrorEvent
  | ResponseWebSearchCallInProgressEvent
  | ResponseWebSearchCallSearchingEvent
  | ResponseWebSearchCallCompletedEvent
  | ResponseImageProcessCallInProgressEvent
  | ResponseImageProcessCallProcessingEvent
  | ResponseImageProcessCallCompletedEvent
  | ResponseImageProcessCallFailedEvent
  | ResponseMcpListToolsInProgressEvent
  | ResponseMcpListToolsCompletedEvent
  | ResponseMcpCallInProgressEvent
  | ResponseMcpCallArgumentsDeltaEvent
  | ResponseMcpCallArgumentsDoneEvent
  | ResponseMcpCallCompletedEvent
  | ResponseMcpCallFailedEvent
  | ResponseMcpApprovalRequestEvent
  | ResponseKnowledgeSearchCallInProgressEvent
  | ResponseKnowledgeSearchCallSearchingEvent
  | ResponseKnowledgeSearchCallCompletedEvent
  | ResponseKnowledgeSearchCallFailedEvent
  | ResponseDoubaoAppCallInProgressEvent
  | ResponseDoubaoAppCallFailedEvent
  | ResponseDoubaoAppCallCompletedEvent
  | ResponseDoubaoAppCallBlockAddedEvent
  | ResponseDoubaoAppCallBlockDoneEvent
  | ResponseDoubaoAppCallReasoningTextDeltaEvent
  | ResponseDoubaoAppCallReasoningTextDoneEvent
  | ResponseDoubaoAppCallOutputTextDeltaEvent
  | ResponseDoubaoAppCallOutputTextDoneEvent
  | ResponseDoubaoAppCallSearchInProgressEvent
  | ResponseDoubaoAppCallSearchSearchingEvent
  | ResponseDoubaoAppCallSearchCompletedEvent
  | ResponseDoubaoAppCallReasoningSearchInProgressEvent
  | ResponseDoubaoAppCallReasoningSearchSearchingEvent
  | ResponseDoubaoAppCallReasoningSearchCompletedEvent;
