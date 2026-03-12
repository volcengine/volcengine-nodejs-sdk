import {
  getEventType,
  isDelta,
  isDeltaDone,
  isResponseDone,
} from "../src/types/responses/helpers";

// The Event type is a strict discriminated union, so we use `as any` for test convenience
describe("getEventType", () => {
  it("should return the event type", () => {
    expect(getEventType({ type: "response.created" } as any)).toBe("response.created");
    expect(getEventType({ type: "response.output_text.delta" } as any)).toBe("response.output_text.delta");
    expect(getEventType({ type: "error" } as any)).toBe("error");
  });

  it("should return empty string for null/undefined", () => {
    expect(getEventType(null)).toBe("");
    expect(getEventType(undefined)).toBe("");
  });
});

describe("isDelta", () => {
  it("should return true for delta event types", () => {
    // Must match the isDelta implementation (aligned with Go's IsDelta)
    const deltaTypes = [
      "response.output_text.delta",
      "response.reasoning_summary_text.delta",
      "response.function_call_arguments.delta",
      "response.transcription_text.delta",
      "response.output_text.annotation.added",
      "response.web_search_call.in_progress",
      "response.web_search_call.searching",
      "response.web_search_call.completed",
      "response.image_process_call.in_progress",
      "response.image_process_call.completed",
      "response.mcp_list_tools.completed",
      "response.mcp_call.in_progress",
      "response.mcp_call.arguments_delta",
      "response.mcp_call.arguments_done",
      "response.mcp_call.completed",
      "response.mcp_call.failed",
      "response.knowledge_search_call.in_progress",
      "response.knowledge_search_call.searching",
      "response.knowledge_search_call.completed",
      "response.knowledge_search_call.failed",
    ];

    for (const type of deltaTypes) {
      expect(isDelta({ type } as any)).toBe(true);
    }
  });

  it("should return false for non-delta event types", () => {
    expect(isDelta({ type: "response.completed" } as any)).toBe(false);
    expect(isDelta({ type: "response.output_item.done" } as any)).toBe(false);
    expect(isDelta({ type: "error" } as any)).toBe(false);
  });
});

describe("isDeltaDone", () => {
  it("should return true for delta-done event types", () => {
    // Must match the isDeltaDone implementation (aligned with Go's IsDeltaDone)
    const deltaDoneTypes = [
      "response.output_text.done",
      "response.reasoning_summary_text.done",
      "response.function_call_arguments.done",
      "response.transcription_text.done",
    ];

    for (const type of deltaDoneTypes) {
      expect(isDeltaDone({ type } as any)).toBe(true);
    }
  });

  it("should return false for other event types", () => {
    expect(isDeltaDone({ type: "response.completed" } as any)).toBe(false);
    expect(isDeltaDone({ type: "response.output_text.delta" } as any)).toBe(false);
  });
});

describe("isResponseDone", () => {
  it("should return true for terminal event types", () => {
    expect(isResponseDone({ type: "response.completed" } as any)).toBe(true);
    expect(isResponseDone({ type: "response.failed" } as any)).toBe(true);
    expect(isResponseDone({ type: "response.incomplete" } as any)).toBe(true);
  });

  it("should return false for non-terminal event types", () => {
    expect(isResponseDone({ type: "response.created" } as any)).toBe(false);
    expect(isResponseDone({ type: "response.in_progress" } as any)).toBe(false);
    expect(isResponseDone({ type: "response.output_text.delta" } as any)).toBe(false);
  });
});
