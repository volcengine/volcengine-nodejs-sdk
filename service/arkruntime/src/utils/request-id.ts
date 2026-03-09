import { randomBytes } from "crypto";

/**
 * Generate a request ID in the format: YYYYMMDDHHmmss + 20 hex digits.
 */
export function genRequestId(): string {
  const now = new Date();
  const ts =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  const hex = randomBytes(10).toString("hex");
  return ts + hex;
}
