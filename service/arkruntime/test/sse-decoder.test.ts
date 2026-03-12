import { Readable } from "stream";
import { EventStreamDecoder } from "../src/utils/sse-decoder";

function createNodeStream(data: string): NodeJS.ReadableStream {
  return Readable.from([Buffer.from(data)]);
}

describe("EventStreamDecoder", () => {
  it("should parse basic SSE events", async () => {
    const sseData = [
      "event: message",
      "data: hello world",
      "",
      "event: done",
      "data: goodbye",
      "",
      "",
    ].join("\n");

    const decoder = new EventStreamDecoder(createNodeStream(sseData));
    const events = [];
    for await (const event of decoder) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ event: "message", data: "hello world" });
    expect(events[1]).toEqual({ event: "done", data: "goodbye" });
  });

  it("should handle events without event field", async () => {
    const sseData = "data: just data\n\n";

    const decoder = new EventStreamDecoder(createNodeStream(sseData));
    const events = [];
    for await (const event of decoder) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ event: "", data: "just data" });
  });

  it("should handle multi-line data", async () => {
    const sseData = "data: line1\ndata: line2\ndata: line3\n\n";

    const decoder = new EventStreamDecoder(createNodeStream(sseData));
    const events = [];
    for await (const event of decoder) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe("line1\nline2\nline3");
  });

  it("should ignore comment lines", async () => {
    const sseData = ": this is a comment\ndata: actual data\n\n";

    const decoder = new EventStreamDecoder(createNodeStream(sseData));
    const events = [];
    for await (const event of decoder) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe("actual data");
  });

  it("should handle \\r\\n line endings", async () => {
    const sseData = "event: msg\r\ndata: hello\r\n\r\n";

    const decoder = new EventStreamDecoder(createNodeStream(sseData));
    const events = [];
    for await (const event of decoder) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ event: "msg", data: "hello" });
  });

  it("should handle data with JSON content", async () => {
    const json = JSON.stringify({ id: "123", choices: [{ delta: { content: "Hi" } }] });
    const sseData = `data: ${json}\n\n`;

    const decoder = new EventStreamDecoder(createNodeStream(sseData));
    const events = [];
    for await (const event of decoder) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    const parsed = JSON.parse(events[0].data);
    expect(parsed.id).toBe("123");
  });

  it("should handle chunked delivery", async () => {
    // Simulate chunks arriving in pieces
    const chunks = [
      Buffer.from("event: msg\nda"),
      Buffer.from("ta: he"),
      Buffer.from("llo\n\n"),
    ];

    const stream = Readable.from(chunks);
    const decoder = new EventStreamDecoder(stream);
    const events = [];
    for await (const event of decoder) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ event: "msg", data: "hello" });
  });

  it("should handle [DONE] as data", async () => {
    const sseData = "data: [DONE]\n\n";

    const decoder = new EventStreamDecoder(createNodeStream(sseData));
    const events = [];
    for await (const event of decoder) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe("[DONE]");
  });

  it("should flush remaining data at end of stream", async () => {
    // Data without trailing newlines
    const sseData = "data: final";

    const decoder = new EventStreamDecoder(createNodeStream(sseData));
    const events = [];
    for await (const event of decoder) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].data).toBe("final");
  });

  it("should handle empty stream", async () => {
    const decoder = new EventStreamDecoder(createNodeStream(""));
    const events = [];
    for await (const event of decoder) {
      events.push(event);
    }
    expect(events).toHaveLength(0);
  });

  it("should handle data with leading space after colon", async () => {
    const sseData = "data: spaced\n\n";
    const decoder = new EventStreamDecoder(createNodeStream(sseData));
    const events = [];
    for await (const event of decoder) {
      events.push(event);
    }
    expect(events[0].data).toBe("spaced");
  });

  it("should handle data without space after colon", async () => {
    const sseData = "data:nospace\n\n";
    const decoder = new EventStreamDecoder(createNodeStream(sseData));
    const events = [];
    for await (const event of decoder) {
      events.push(event);
    }
    expect(events[0].data).toBe("nospace");
  });
});
