import type { Usage, HttpHeaders } from "./common";

export type EmbeddingEncodingFormat = "float" | "base64";

export interface EmbeddingRequest {
  input: string | string[] | number[][] ;
  model: string;
  user?: string;
  encoding_format?: EmbeddingEncodingFormat;
  dimensions?: number;
}

export interface Embedding {
  object: string;
  embedding: number[];
  index: number;
}

export interface EmbeddingResponse {
  id: string;
  created: number;
  object: string;
  data: Embedding[];
  model: string;
  usage: Usage;
  headers?: HttpHeaders;
}

// Base64 embedding support
export interface Base64Embedding {
  object: string;
  embedding: string; // base64 encoded
  index: number;
}

export interface EmbeddingResponseBase64 {
  object: string;
  data: Base64Embedding[];
  model: string;
  usage: Usage;
  headers?: HttpHeaders;
}

/**
 * Decode a base64-encoded embedding into a float32 array.
 */
export function decodeBase64Embedding(b64: string): number[] {
  const buf = Buffer.from(b64, "base64");
  const floats: number[] = [];
  for (let i = 0; i < buf.length; i += 4) {
    floats.push(buf.readFloatLE(i));
  }
  return floats;
}

/**
 * Convert a base64 embedding response to a standard embedding response.
 */
export function base64ToEmbeddingResponse(
  resp: EmbeddingResponseBase64,
): EmbeddingResponse {
  return {
    id: "",
    created: 0,
    object: resp.object,
    model: resp.model,
    usage: resp.usage,
    data: resp.data.map((item) => ({
      object: item.object,
      embedding: decodeBase64Embedding(item.embedding),
      index: item.index,
    })),
  };
}
