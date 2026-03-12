import type { Event, EventType } from "./types";

/**
 * Get the event type string from an Event object.
 * Matches Go's `(*Event).GetEventType()`.
 */
export function getEventType(event: Event | null | undefined): EventType | "" {
  if (!event) return "";
  return event.type ?? "";
}

/**
 * Check if an event is a "delta" event (streaming partial content).
 * Matches Go's `(*Event).IsDelta()`.
 */
export function isDelta(event: Event): boolean {
  const t = event.type;
  return (
    t === "response.output_text.delta" ||
    t === "response.reasoning_summary_text.delta" ||
    t === "response.function_call_arguments.delta" ||
    t === "response.transcription_text.delta" ||
    t === "response.output_text.annotation.added" ||
    t === "response.web_search_call.in_progress" ||
    t === "response.web_search_call.searching" ||
    t === "response.web_search_call.completed" ||
    t === "response.image_process_call.in_progress" ||
    t === "response.image_process_call.completed" ||
    t === "response.mcp_list_tools.completed" ||
    t === "response.mcp_call.in_progress" ||
    t === "response.mcp_call.arguments_delta" ||
    t === "response.mcp_call.arguments_done" ||
    t === "response.mcp_call.completed" ||
    t === "response.mcp_call.failed" ||
    t === "response.knowledge_search_call.in_progress" ||
    t === "response.knowledge_search_call.searching" ||
    t === "response.knowledge_search_call.completed" ||
    t === "response.knowledge_search_call.failed"
  );
}

/**
 * Check if an event is a "delta done" event (end of streaming partial).
 * Matches Go's `(*Event).IsDeltaDone()`.
 */
export function isDeltaDone(event: Event): boolean {
  const t = event.type;
  return (
    t === "response.output_text.done" ||
    t === "response.reasoning_summary_text.done" ||
    t === "response.function_call_arguments.done" ||
    t === "response.transcription_text.done"
  );
}

/**
 * Check if the response generation is complete (success, fail, or incomplete).
 * Matches Go's `(*Event).IsResponseDone()`.
 */
export function isResponseDone(event: Event): boolean {
  const t = event.type;
  return (
    t === "response.completed" ||
    t === "response.failed" ||
    t === "response.incomplete"
  );
}
