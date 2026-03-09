import type { HttpHeaders } from "./common";

// Constants
export const PurposeUserData = "user_data";
export const FileStatusActive = "active";
export const FileStatusProcessing = "processing";
export const FileStatusFailed = "failed";
export const ObjectTypeList = "list";
export const ObjectTypeFile = "file";
export const OrderAsc = "asc";
export const OrderDesc = "desc";

export type FilePurpose = string;
export type FileStatus = string;
export type FileObjectType = string;
export type FileOrder = "asc" | "desc";

export interface FileError {
  code: string;
  message: string;
  param: string;
  type: string;
}

export interface Video {
  fps?: number;
}

export interface PreprocessConfigs {
  video?: Video;
}

export interface FileMeta {
  object: FileObjectType;
  id: string;
  purpose: FilePurpose;
  filename: string;
  bytes?: number;
  mime_type?: string;
  created_at: number;
  expire_at: number;
  status: FileStatus;
  error?: FileError;
  preprocess_configs?: PreprocessConfigs;
  headers?: HttpHeaders;
}

export interface UploadFileRequest {
  file: Blob | Buffer | ReadableStream;
  purpose: FilePurpose;
  preprocess_configs?: PreprocessConfigs;
  expire_at?: number;
}

export interface ListFilesRequest {
  purpose?: FilePurpose;
  after?: string;
  limit?: number;
  order?: FileOrder;
}

export interface ListFilesResponse {
  object: FileObjectType;
  data: FileMeta[];
  first_id: string;
  last_id: string;
  has_more: boolean;
  headers?: HttpHeaders;
}

export interface DeleteFileResponse {
  object: FileObjectType;
  id: string;
  deleted: boolean;
  headers?: HttpHeaders;
}
