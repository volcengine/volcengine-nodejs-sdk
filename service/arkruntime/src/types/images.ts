import type { HttpHeaders, ToolUsage } from "./common";

// Constants
export const GenerateImagesResponseFormatBase64 = "b64_json";
export const GenerateImagesResponseFormatURL = "url";
export const GenerateImagesSizeAdaptive = "adaptive";

// Optimize prompt
export type OptimizePromptThinking = "auto" | "enabled" | "disabled";
export type OptimizePromptMode = "standard" | "fast";

// Sequential image generation
export type SequentialImageGeneration = "auto" | "disabled";

// Image stream event types
export const ImageGenerationStreamEventPartialSucceeded =
  "image_generation.partial_succeeded";
export const ImageGenerationStreamEventPartialFailed =
  "image_generation.partial_failed";
export const ImageGenerationStreamEventCompleted =
  "image_generation.completed";

// Output format
export type OutputFormat = "jpeg" | "png";

// Content generation tool
export type ContentGenerationToolType = "web_search";

export interface ContentGenerationTool {
  type: ContentGenerationToolType;
}

export interface OptimizePromptOptions {
  thinking?: OptimizePromptThinking;
  mode?: OptimizePromptMode;
}

export interface SequentialImageGenerationOptions {
  max_images?: number;
}

export interface Image {
  url?: string;
  b64_json?: string;
  size: string;
}

export interface GenerateImagesUsage {
  generated_images: number;
  output_tokens: number;
  total_tokens: number;
  tool_usage?: ToolUsage;
}

export interface GenerateImagesError {
  code: string;
  message: string;
}

export interface GenerateImagesRequest {
  model: string;
  prompt: string;
  image?: string | string[];
  response_format?: string;
  seed?: number;
  guidance_scale?: number;
  size?: string;
  watermark?: boolean;
  optimize_prompt?: boolean;
  optimize_prompt_options?: OptimizePromptOptions;
  sequential_image_generation?: SequentialImageGeneration;
  sequential_image_generation_options?: SequentialImageGenerationOptions;
  tools?: ContentGenerationTool[];
  output_format?: OutputFormat;
}

export interface ImagesResponse {
  model: string;
  created: number;
  data: Image[];
  usage?: GenerateImagesUsage;
  error?: GenerateImagesError;
  tools?: ContentGenerationTool[];
  headers?: HttpHeaders;
}

export interface ImagesStreamResponse {
  type: string;
  model: string;
  created: number;
  image_index: number;
  url?: string;
  b64_json?: string;
  size: string;
  usage?: GenerateImagesUsage;
  error?: GenerateImagesError;
  tools?: ContentGenerationTool[];
}
