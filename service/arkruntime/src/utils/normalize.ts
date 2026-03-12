/**
 * Response normalization utilities.
 *
 * The Go SDK serializes responses through Go structs, which means:
 *   - Fields WITHOUT `omitempty` are always present (even when zero/null)
 *   - Fields WITH `omitempty` are omitted when zero/null/empty
 *
 * The Node.js SDK receives raw JSON from the server (via Axios / JSON.parse),
 * so fields may or may not be present depending on what the server returns.
 *
 * These functions align Node.js responses to match Go SDK serialization behavior.
 */

import type {
  ChatCompletionResponse,
  ChatCompletionStreamResponse,
  ChatCompletionChoice,
  ChatCompletionStreamChoice,
} from "../types/chat-completion";
import type { EmbeddingResponse } from "../types/embeddings";
import type { Usage } from "../types/common";

// ─── Chat Completion (non-stream) ────────────────────────────

/**
 * Normalize a ChatCompletionResponse to match Go SDK output.
 *
 * Go struct tags:
 *   ChatCompletionMessage.Name      *string  `json:"name"`            → always present
 *   ChatCompletionChoice.LogProbs   *LogProbs `json:"logprobs,omitempty"` → omitted when nil
 *   ChatCompletionChoice.FinishReason FinishReason `json:"finish_reason"` → always present (custom MarshalJSON: empty → null)
 */
export function normalizeChatCompletionResponse(
  resp: ChatCompletionResponse,
): ChatCompletionResponse {
  if (resp.choices) {
    for (const choice of resp.choices) {
      normalizeChatCompletionChoice(choice);
    }
  }
  return resp;
}

function normalizeChatCompletionChoice(choice: ChatCompletionChoice): void {
  // Go: Name *string `json:"name"` — no omitempty, always serialized
  if (choice.message && !("name" in choice.message)) {
    (choice.message as any).name = null;
  }

  // Go: LogProbs *LogProbs `json:"logprobs,omitempty"` — omitted when nil
  if ("logprobs" in choice && (choice.logprobs === null || choice.logprobs === undefined)) {
    delete (choice as any).logprobs;
  }

  // Go: FinishReason `json:"finish_reason"` — always present, custom MarshalJSON
  // (already present in server response, but ensure it exists)
  if (!("finish_reason" in choice)) {
    (choice as any).finish_reason = null;
  }
}

// ─── Chat Completion Stream ──────────────────────────────────

/**
 * Normalize a ChatCompletionStreamResponse chunk to match Go SDK output.
 *
 * Go struct tags:
 *   ChatCompletionStreamChoiceDelta.Content  string   `json:"content,omitempty"`  → omitted when ""
 *   ChatCompletionStreamChoiceDelta.Role     string   `json:"role,omitempty"`     → omitted when ""
 *   ChatCompletionStreamChoice.FinishReason  FinishReason `json:"finish_reason"`  → always present (null when empty)
 *   ChatCompletionStreamChoice.LogProbs      *LogProbs `json:"logprobs,omitempty"` → omitted when nil
 *   ChatCompletionStreamResponse.Usage       *Usage   `json:"usage,omitempty"`    → omitted when nil
 */
export function normalizeChatCompletionStreamChunk(
  chunk: ChatCompletionStreamResponse,
): ChatCompletionStreamResponse {
  if (chunk.choices) {
    for (const choice of chunk.choices) {
      normalizeStreamChoice(choice);
    }
  }

  // Go: Usage *Usage `json:"usage,omitempty"` — omitted when nil
  if ("usage" in chunk && (chunk.usage === null || chunk.usage === undefined)) {
    delete (chunk as any).usage;
  }

  return chunk;
}

function normalizeStreamChoice(choice: ChatCompletionStreamChoice): void {
  // Go: FinishReason `json:"finish_reason"` — no omitempty, custom MarshalJSON outputs null for empty
  if (!("finish_reason" in choice)) {
    (choice as any).finish_reason = null;
  }

  // Go: LogProbs *LogProbs `json:"logprobs,omitempty"` — omitted when nil
  if ("logprobs" in choice && (choice.logprobs === null || choice.logprobs === undefined)) {
    delete (choice as any).logprobs;
  }

  if (choice.delta) {
    // Go: Content string `json:"content,omitempty"` — omitted when empty string
    if ("content" in choice.delta && choice.delta.content === "") {
      delete (choice.delta as any).content;
    }

    // Go: Role string `json:"role,omitempty"` — omitted when empty string
    if ("role" in choice.delta && choice.delta.role === "") {
      delete (choice.delta as any).role;
    }
  }
}

// ─── Embeddings ──────────────────────────────────────────────

/**
 * Normalize an EmbeddingResponse to match Go SDK output.
 *
 * Go struct tags (Usage):
 *   PromptTokens            int                    `json:"prompt_tokens"`              → always present
 *   CompletionTokens        int                    `json:"completion_tokens"`          → always present (even 0)
 *   TotalTokens             int                    `json:"total_tokens"`               → always present
 *   PromptTokensDetails     PromptTokensDetail     `json:"prompt_tokens_details"`      → always present (even zero struct)
 *   CompletionTokensDetails CompletionTokensDetails `json:"completion_tokens_details"` → always present (even zero struct)
 */
export function normalizeEmbeddingResponse(
  resp: EmbeddingResponse,
): EmbeddingResponse {
  if (resp.usage) {
    normalizeUsage(resp.usage);
  }
  return resp;
}

/**
 * Ensure Usage has all fields that Go always serializes (no omitempty).
 */
export function normalizeUsage(usage: Usage): void {
  // Go: CompletionTokens int `json:"completion_tokens"` — no omitempty
  if (usage.completion_tokens === undefined || usage.completion_tokens === null) {
    usage.completion_tokens = 0;
  }

  // Go: PromptTokensDetails PromptTokensDetail `json:"prompt_tokens_details"` — no omitempty
  if (!usage.prompt_tokens_details) {
    usage.prompt_tokens_details = { cached_tokens: 0 };
  }

  // Go: CompletionTokensDetails CompletionTokensDetails `json:"completion_tokens_details"` — no omitempty
  if (!usage.completion_tokens_details) {
    usage.completion_tokens_details = { reasoning_tokens: 0 };
  }
}
