/**
 * @volcengine/sdk-core/testing
 *
 * Testing utilities for unit testing SDK clients.
 * Import these tools to mock HTTP requests and time in your tests.
 *
 * @example
 * ```typescript
 * import { MockRequestHandler, MockClock } from '@volcengine/sdk-core/testing';
 *
 * const mockHandler = new MockRequestHandler();
 * mockHandler.mock('https://api.example.com', {
 *   status: 200,
 *   data: { result: 'success' }
 * });
 *
 * const client = new Client({
 *   requestHandler: mockHandler,
 *   clock: new MockClock()
 * });
 * ```
 */

export { MockRequestHandler } from "./mock-request-handler";
export { MockClock, waitForPromise } from "./mock-clock";
export type { MockResponse } from "./mock-request-handler";
