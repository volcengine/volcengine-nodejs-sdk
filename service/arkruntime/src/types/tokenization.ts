import type { HttpHeaders } from "./common";

export interface TokenizationRequest {
  text: string | string[];
  model: string;
  user?: string;
}

export interface Tokenization {
  index: number;
  object: string;
  total_tokens: number;
  token_ids: number[];
  offset_mapping: number[][];
}

export interface TokenizationResponse {
  id: string;
  created: number;
  model: string;
  object: string;
  data: Tokenization[];
  headers?: HttpHeaders;
}
