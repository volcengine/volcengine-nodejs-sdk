import type { HttpHeaders } from "./common";
import type { EmbeddingEncodingFormat } from "./embeddings";

export type MultiModalEmbeddingInputType = "text" | "image_url" | "video_url";

export type SparseEmbeddingInputType = "enabled" | "disabled";

export interface MultimodalEmbeddingImageURL {
  url: string;
}

export interface MultimodalEmbeddingVideoURL {
  url: string;
  fps?: number;
}

export interface MultimodalEmbeddingInput {
  type: MultiModalEmbeddingInputType;
  text?: string;
  image_url?: MultimodalEmbeddingImageURL;
  video_url?: MultimodalEmbeddingVideoURL;
}

export interface SparseEmbeddingInput {
  type: SparseEmbeddingInputType;
}

export interface SparseEmbedding {
  index: number;
  value: number;
}

export interface MultiModalEmbeddingRequest {
  input: MultimodalEmbeddingInput[];
  model: string;
  encoding_format?: EmbeddingEncodingFormat;
  dimensions?: number;
  sparse_embedding?: SparseEmbeddingInput;
  instructions?: string;
}

export interface MultimodalEmbedding {
  embedding: number[];
  sparse_embedding?: SparseEmbedding[];
  object: string;
}

export interface MultimodalEmbeddingPromptTokensDetail {
  text_tokens: number;
  image_tokens: number;
}

export interface MultimodalEmbeddingUsage {
  prompt_tokens: number;
  total_tokens: number;
  prompt_tokens_details: MultimodalEmbeddingPromptTokensDetail;
}

export interface MultimodalEmbeddingResponse {
  id: string;
  model: string;
  created: number;
  object: string;
  data: MultimodalEmbedding;
  usage: MultimodalEmbeddingUsage;
  headers?: HttpHeaders;
}
