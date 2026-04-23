import type { Usage, HttpHeaders } from "./common";
import type { ContentGenerationTool } from "./images";

export type ContentGenerationContentItemType =
  | "text"
  | "image_url"
  | "audio_url"
  | "video_url"
  | "draft_task";

export const StatusSucceeded = "succeeded";
export const StatusCancelled = "cancelled";
export const StatusFailed = "failed";
export const StatusRunning = "running";
export const StatusQueued = "queued";

export interface ImageURL {
  url: string;
}

export interface AudioURL {
  url: string;
}

export interface VideoURL {
  url: string;
}

export interface DraftTask {
  id: string;
}

export interface CreateContentGenerationContentItem {
  type: ContentGenerationContentItemType;
  text?: string;
  image_url?: ImageURL;
  audio_url?: AudioURL;
  video_url?: VideoURL;
  role?: string;
  draft_task?: DraftTask;
}

export interface CreateContentGenerationTaskRequest {
  model: string;
  content: CreateContentGenerationContentItem[];
  safety_identifier?: string;
  callback_url?: string;
  return_last_frame?: boolean;
  service_tier?: string;
  execution_expires_after?: number;
  generate_audio?: boolean;
  draft?: boolean;
  camera_fixed?: boolean;
  watermark?: boolean;
  seed?: number;
  resolution?: string;
  ratio?: string;
  duration?: number;
  frames?: number;
  tools?: ContentGenerationTool[];
  /** Extra fields merged into request body */
  [key: string]: unknown;
}

export interface CreateContentGenerationTaskResponse {
  id: string;
  safety_identifier?: string;
  headers?: HttpHeaders;
}

export interface ContentGenerationError {
  code: string;
  message: string;
}

export interface Content {
  video_url: string;
  last_frame_url: string;
  file_url: string;
}

export interface GetContentGenerationTaskResponse {
  id: string;
  model: string;
  safety_identifier?: string;
  status: string;
  error?: ContentGenerationError;
  content: Content;
  usage: Usage;
  subdivisionlevel?: string;
  fileformat?: string;
  frames?: number;
  framespersecond?: number;
  resolution?: string;
  ratio?: string;
  duration?: number;
  created_at: number;
  updated_at: number;
  seed?: number;
  revised_prompt?: string;
  service_tier?: string;
  execution_expires_after?: number;
  generate_audio?: boolean;
  draft?: boolean;
  draft_task_id?: string;
  tools?: ContentGenerationTool[];
  headers?: HttpHeaders;
}

export interface ListContentGenerationTasksFilter {
  status?: string;
  task_ids?: string[];
  model?: string;
  service_tier?: string;
}

export interface ListContentGenerationTasksRequest {
  page_num?: number;
  page_size?: number;
  filter?: ListContentGenerationTasksFilter;
}

export interface ListContentGenerationTaskItem {
  id: string;
  model: string;
  safety_identifier?: string;
  status: string;
  failure_reason?: ContentGenerationError;
  content: Content;
  usage: Usage;
  subdivisionlevel?: string;
  fileformat?: string;
  frames?: number;
  framespersecond?: number;
  created_at: number;
  updated_at: number;
  seed?: number;
  revised_prompt?: string;
  service_tier?: string;
  execution_expires_after?: number;
  generate_audio?: boolean;
  draft?: boolean;
  draft_task_id?: string;
  tools?: ContentGenerationTool[];
}

export interface ListContentGenerationTasksResponse {
  total: number;
  items: ListContentGenerationTaskItem[];
  headers?: HttpHeaders;
}

export interface DeleteContentGenerationTaskRequest {
  id: string;
}
