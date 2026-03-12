/**
 * SSE event parsed from a text/event-stream.
 */
export interface SSEEvent {
  event: string;
  data: string;
}

/**
 * EventStreamDecoder parses a text/event-stream from a Node readable stream.
 * Yields SSEEvent objects via the async iterator protocol.
 */
export class EventStreamDecoder {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private decoder = new TextDecoder();
  private buffer = "";

  constructor(
    private stream:
      | ReadableStream<Uint8Array>
      | NodeJS.ReadableStream,
  ) {}

  async *[Symbol.asyncIterator](): AsyncIterator<SSEEvent> {
    const lines = this.readLines();
    let event = "";
    let dataLines: string[] = [];

    for await (const line of lines) {
      // Empty line → dispatch event
      if (line === "") {
        if (dataLines.length > 0) {
          yield {
            event,
            data: dataLines.join("\n"),
          };
        }
        event = "";
        dataLines = [];
        continue;
      }

      // Comment line
      if (line.startsWith(":")) {
        continue;
      }

      const colonIdx = line.indexOf(":");
      let field: string;
      let value: string;

      if (colonIdx === -1) {
        field = line;
        value = "";
      } else {
        field = line.slice(0, colonIdx);
        value = line.slice(colonIdx + 1);
        // Remove optional leading space after colon
        if (value.startsWith(" ")) {
          value = value.slice(1);
        }
      }

      switch (field) {
        case "event":
          event = value;
          break;
        case "data":
          dataLines.push(value);
          break;
        // id, retry etc. — ignored for our use case
      }
    }

    // Flush remaining
    if (dataLines.length > 0) {
      yield { event, data: dataLines.join("\n") };
    }
  }

  private async *readLines(): AsyncGenerator<string> {
    // Handle both Web ReadableStream and Node ReadableStream
    const chunks = this.iterateStream();

    for await (const chunk of chunks) {
      this.buffer += typeof chunk === "string"
        ? chunk
        : this.decoder.decode(chunk, { stream: true });

      const lines = this.buffer.split("\n");
      // Keep the last partial line in the buffer
      this.buffer = lines.pop() ?? "";

      for (const line of lines) {
        // Remove trailing \r if present
        yield line.endsWith("\r") ? line.slice(0, -1) : line;
      }
    }

    // Flush remaining buffer
    if (this.buffer.length > 0) {
      yield this.buffer;
      this.buffer = "";
    }
  }

  private async *iterateStream(): AsyncGenerator<Uint8Array | string> {
    const stream = this.stream as any;

    // Web ReadableStream
    if (typeof stream.getReader === "function") {
      this.reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await this.reader!.read();
          if (done) break;
          if (value) yield value;
        }
      } finally {
        this.reader!.releaseLock();
        this.reader = null;
      }
      return;
    }

    // Node ReadableStream (async iterable)
    if (Symbol.asyncIterator in stream) {
      for await (const chunk of stream) {
        yield chunk;
      }
      return;
    }

    throw new Error("Unsupported stream type");
  }

  cancel(): void {
    this.reader?.cancel();
  }
}
