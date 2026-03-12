import { EventStreamDecoder } from "./sse-decoder";
import type { SSEEvent } from "./sse-decoder";
import type { ChatCompletionStreamResponse } from "../types/chat-completion";
import type { BotChatCompletionStreamResponse } from "../types/bot";
import type { ImagesStreamResponse } from "../types/images";
import type { ErrorResponse } from "../types/error";
import { ArkAPIError, ErrTooManyEmptyStreamMessages } from "../types/error";
import { decryptChatStreamResponse } from "../encryption/encrypt-chat";
import { normalizeChatCompletionStreamChunk } from "./normalize";

const ERROR_PREFIX = '{"error":';

/**
 * Base SSE stream that parses `data:` lines from an HTTP response body.
 * Subclassed for each response type.
 */
abstract class BaseStreamReader<T> implements AsyncIterable<T> {
  protected isFinished = false;
  protected emptyMessagesCount = 0;
  protected cleanup?: () => void;

  constructor(
    protected stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
    protected emptyMessagesLimit: number,
    protected headers?: Record<string, string>,
    cleanup?: () => void,
  ) {
    this.cleanup = cleanup;
  }

  abstract [Symbol.asyncIterator](): AsyncIterator<T>;

  close(): void {
    this.isFinished = true;
    this.cleanup?.();
    this.cleanup = undefined;
  }
}

/**
 * Reads `data: <json>` lines from SSE (chat completion, bot, images).
 * Handles `data: [DONE]` termination and error prefixes.
 */
class DataLineStreamReader<T> extends BaseStreamReader<T> {
  private decoder = new TextDecoder();
  private buffer = "";

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    const chunks = this.iterateChunks();
    let errBuffer = "";
    let hasError = false;

    for await (const rawLine of this.readLines(chunks)) {
      if (this.isFinished) return;

      const trimmed = rawLine.trim();
      if (trimmed === "") {
        continue;
      }

      // Extract data after "data:" prefix
      let dataContent: string | null = null;
      if (trimmed.startsWith("data:")) {
        dataContent = trimmed.slice(5).trim();
      }

      // Check for error prefix in the data content
      if (dataContent && dataContent.startsWith(ERROR_PREFIX)) {
        hasError = true;
        errBuffer += dataContent;
        continue;
      }

      if (hasError) {
        errBuffer += trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
        continue;
      }

      // Non-data lines
      if (dataContent === null) {
        this.emptyMessagesCount++;
        if (this.emptyMessagesCount > this.emptyMessagesLimit) {
          throw ErrTooManyEmptyStreamMessages;
        }
        continue;
      }

      // Check for [DONE]
      if (dataContent === "[DONE]") {
        this.close();
        return;
      }

      // Parse JSON
      const parsed = JSON.parse(dataContent) as T;
      this.emptyMessagesCount = 0;
      yield parsed;
    }

    // Handle accumulated error
    if (hasError && errBuffer) {
      const errResp = JSON.parse(errBuffer) as ErrorResponse;
      if (errResp.error) {
        throw new ArkAPIError({
          message: errResp.error.message,
          code: errResp.error.code,
          param: errResp.error.param,
          type: errResp.error.type,
          httpStatusCode: 0,
          requestId:
            errResp.error.request_id ??
            this.headers?.["x-client-request-id"] ??
            "",
        });
      }
    }
  }

  private async *readLines(
    chunks: AsyncIterable<string>,
  ): AsyncGenerator<string> {
    for await (const chunk of chunks) {
      this.buffer += chunk;
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        yield line;
      }
    }
    if (this.buffer) {
      yield this.buffer;
      this.buffer = "";
    }
  }

  private async *iterateChunks(): AsyncGenerator<string> {
    const stream = this.stream as any;
    if (typeof stream.getReader === "function") {
      const reader = stream.getReader() as ReadableStreamDefaultReader<Uint8Array>;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield typeof value === "string" ? value : this.decoder.decode(value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }
    } else if (Symbol.asyncIterator in stream) {
      for await (const chunk of stream) {
        yield typeof chunk === "string" ? chunk : this.decoder.decode(chunk, { stream: true });
      }
    }
  }
}

/**
 * Chat completion stream reader.
 * Yields ChatCompletionStreamResponse chunks.
 * Supports automatic E2EE decryption when keyNonce is provided.
 */
export class ChatCompletionStreamReader extends DataLineStreamReader<ChatCompletionStreamResponse> {
  private keyNonce: Buffer;

  constructor(
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
    emptyMessagesLimit: number,
    headers?: Record<string, string>,
    keyNonce?: Buffer,
    cleanup?: () => void,
  ) {
    super(stream, emptyMessagesLimit, headers, cleanup);
    this.keyNonce = keyNonce ?? Buffer.alloc(0);
  }

  override async *[Symbol.asyncIterator](): AsyncIterator<ChatCompletionStreamResponse> {
    for await (const chunk of this.iterateBase()) {
      if (this.keyNonce.length > 0) {
        decryptChatStreamResponse(this.keyNonce, chunk);
      }
      yield normalizeChatCompletionStreamChunk(chunk);
    }
  }

  /** Iterate base class to get raw parsed chunks before decryption */
  private async *iterateBase(): AsyncGenerator<ChatCompletionStreamResponse> {
    yield* super[Symbol.asyncIterator]() as any;
  }
}

/**
 * Bot chat completion stream reader.
 * Yields BotChatCompletionStreamResponse chunks.
 */
export class BotChatCompletionStreamReader extends DataLineStreamReader<BotChatCompletionStreamResponse> {
  override async *[Symbol.asyncIterator](): AsyncIterator<BotChatCompletionStreamResponse> {
    for await (const chunk of this.iterateBase()) {
      yield normalizeChatCompletionStreamChunk(chunk as any) as any;
    }
  }

  private async *iterateBase(): AsyncGenerator<BotChatCompletionStreamResponse> {
    yield* super[Symbol.asyncIterator]() as any;
  }
}

/**
 * Image generation stream reader.
 * Yields ImagesStreamResponse chunks.
 */
export class ImageGenerationStreamReader extends DataLineStreamReader<ImagesStreamResponse> {}

/**
 * Responses API stream reader.
 * Uses full SSE event parsing (event: + data:).
 */
export class ResponsesStreamReader<T = unknown> extends BaseStreamReader<T> {
  private decoder: EventStreamDecoder;

  constructor(
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
    emptyMessagesLimit: number,
    headers?: Record<string, string>,
    cleanup?: () => void,
  ) {
    super(stream, emptyMessagesLimit, headers, cleanup);
    this.decoder = new EventStreamDecoder(stream);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    for await (const sseEvent of this.decoder) {
      if (this.isFinished) return;

      const data = sseEvent.data.trim();

      // Error check
      if (data.startsWith(ERROR_PREFIX)) {
        const errResp = JSON.parse(data) as ErrorResponse;
        if (errResp.error) {
          throw new ArkAPIError({
            message: errResp.error.message,
            code: errResp.error.code,
            param: errResp.error.param,
            type: errResp.error.type,
            httpStatusCode: 0,
            requestId:
              errResp.error.request_id ??
              this.headers?.["x-client-request-id"] ??
              "",
          });
        }
        continue;
      }

      // [DONE]
      if (data.startsWith("[DONE]")) {
        this.close();
        return;
      }

      const parsed = JSON.parse(data) as T;
      yield parsed;
    }
  }

  override close(): void {
    super.close();
    this.decoder.cancel();
  }
}
