import { aesGcmEncryptBase64, aesGcmDecryptBase64 } from "./key-agreement";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamResponse,
  ChatCompletionMessage,
  ChatCompletionMessageContentPart,
} from "../types/chat-completion";

const AES_KEY_SIZE = 32;
const AES_NONCE_SIZE = 12;

type TextTransformer = (text: string) => string;

function encryptURL(urlString: string, fn: TextTransformer): string {
  try {
    const parsed = new URL(urlString);
    if (["https:", "http:", "file:", "ftp:"].includes(parsed.protocol)) {
      // URLs with these protocols are not encrypted
      return urlString;
    }
  } catch {
    // Not a valid URL with protocol — check for data: scheme
  }
  if (urlString.startsWith("data:")) {
    return fn(urlString);
  }
  return urlString;
}

function processMessageContent(
  content: string | ChatCompletionMessageContentPart[] | undefined | null,
  fn: TextTransformer,
): string | ChatCompletionMessageContentPart[] | undefined | null {
  if (content == null) return content;

  if (typeof content === "string") {
    return fn(content);
  }

  // Array of content parts
  for (const part of content) {
    if (part.type === "text" && part.text) {
      part.text = fn(part.text);
    }
    if (part.type === "image_url" && part.image_url?.url) {
      part.image_url.url = encryptURL(part.image_url.url, fn);
    }
  }
  return content;
}

/**
 * Deep-copy a chat completion request (JSON round-trip).
 */
export function deepCopyRequest(
  request: ChatCompletionRequest,
): ChatCompletionRequest {
  return JSON.parse(JSON.stringify(request));
}

/**
 * Encrypt all text content in a chat completion request.
 * Modifies the request in place.
 * Matches Go's `EncryptChatRequest`.
 */
export function encryptChatRequest(
  keyNonce: Buffer,
  request: ChatCompletionRequest,
): void {
  if (keyNonce.length !== AES_KEY_SIZE + AES_NONCE_SIZE) {
    throw new Error(
      `keyNonce must be ${AES_KEY_SIZE + AES_NONCE_SIZE} bytes, got ${keyNonce.length}`,
    );
  }
  const key = keyNonce.subarray(0, AES_KEY_SIZE);
  const nonce = keyNonce.subarray(AES_KEY_SIZE);
  const fn: TextTransformer = (text) =>
    aesGcmEncryptBase64(key, nonce, text);

  for (const msg of request.messages ?? []) {
    if (msg.content != null) {
      (msg as ChatCompletionMessage).content = processMessageContent(
        msg.content as string | ChatCompletionMessageContentPart[],
        fn,
      ) as typeof msg.content;
    }
  }
}

/**
 * Decrypt all text content in a chat completion response.
 * Modifies the response in place.
 * Matches Go's `DecryptChatResponse`.
 */
export function decryptChatResponse(
  keyNonce: Buffer,
  response: ChatCompletionResponse,
): void {
  if (keyNonce.length !== AES_KEY_SIZE + AES_NONCE_SIZE) {
    throw new Error(
      `keyNonce must be ${AES_KEY_SIZE + AES_NONCE_SIZE} bytes, got ${keyNonce.length}`,
    );
  }
  const key = keyNonce.subarray(0, AES_KEY_SIZE);
  const nonce = keyNonce.subarray(AES_KEY_SIZE);
  const fn: TextTransformer = (text) =>
    aesGcmDecryptBase64(key, nonce, text);

  for (const choice of response.choices ?? []) {
    if (choice.finish_reason === "content_filter") continue;
    if (choice.message?.content != null) {
      choice.message.content = processMessageContent(
        choice.message.content as string | ChatCompletionMessageContentPart[],
        fn,
      ) as typeof choice.message.content;
    }
  }
}

/**
 * Decrypt delta content in a streaming chat completion chunk.
 * Modifies the response in place.
 * Matches Go's `DecryptChatStreamResponse`.
 */
export function decryptChatStreamResponse(
  keyNonce: Buffer,
  response: ChatCompletionStreamResponse,
): void {
  if (keyNonce.length !== AES_KEY_SIZE + AES_NONCE_SIZE) {
    throw new Error(
      `keyNonce must be ${AES_KEY_SIZE + AES_NONCE_SIZE} bytes, got ${keyNonce.length}`,
    );
  }
  const key = keyNonce.subarray(0, AES_KEY_SIZE);
  const nonce = keyNonce.subarray(AES_KEY_SIZE);
  const fn: TextTransformer = (text) =>
    aesGcmDecryptBase64(key, nonce, text);

  for (const choice of response.choices ?? []) {
    if (choice.finish_reason === "content_filter") continue;
    if (choice.delta?.content && typeof choice.delta.content === "string") {
      choice.delta.content = fn(choice.delta.content);
    }
  }
}
