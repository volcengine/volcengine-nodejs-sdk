/**
 * Mock RequestHandler for testing
 * Records requests and returns mock responses
 */

import {
  RequestHandler,
  HttpRequestConfig,
  HttpResponse,
} from "../types/request-handler";
import { Clock } from "../types/clock";
import { RealClock } from "../types/clock";

/**
 * Mock response configuration
 */
export interface MockResponse<T = any> {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  data?: T;
  delayMs?: number; // Simulate network delay
}

/**
 * Options for MockRequestHandler
 */
export interface MockRequestHandlerOptions {
  /**
   * Clock implementation for controlling time in tests
   */
  clock?: Clock;
}

/**
 * Mock RequestHandler that records requests for testing
 */
export class MockRequestHandler implements RequestHandler {
  private responses: Map<string, MockResponse> = new Map();
  private requests: HttpRequestConfig[] = [];
  private clock: Clock;

  /**
   * Constructor
   * @param options Mock request handler options
   */
  constructor(options: MockRequestHandlerOptions = {}) {
    this.clock = options.clock || new RealClock();
  }

  /**
   * Add a mock response for a URL
   * @param url URL or regex pattern
   * @param response Mock response
   */
  mock<T>(url: string | RegExp, response: MockResponse<T>): void {
    const key = url instanceof RegExp ? url.source : url;
    this.responses.set(key, response);
  }

  /**
   * Clear all mocks
   */
  reset(): void {
    this.responses.clear();
    this.requests = [];
  }

  /**
   * Get recorded requests
   */
  getRequests(): HttpRequestConfig[] {
    return [...this.requests];
  }

  /**
   * Get the number of recorded requests
   */
  getRequestCount(): number {
    return this.requests.length;
  }

  /**
   * Get the last request
   */
  getLastRequest(): HttpRequestConfig | undefined {
    return this.requests[this.requests.length - 1];
  }

  /**
   * Check if a URL was called
   */
  wasCalled(url: string | RegExp): boolean {
    const key = url instanceof RegExp ? url.source : url;
    return this.requests.some((req) => {
      if (url instanceof RegExp) {
        return req.url.match(url);
      }
      return req.url === url;
    });
  }

  /**
   * Implementation of RequestHandler.request
   */
  async request<T>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    // Record the request
    this.requests.push(config);

    // Check if the request has been aborted
    if (config.signal?.aborted) {
      throw new Error("Request aborted");
    }

    // Find matching mock response
    let mockResponse: MockResponse | undefined;

    // Exact match
    mockResponse = this.responses.get(config.url);

    // Regex match
    if (!mockResponse) {
      for (const [pattern, response] of this.responses) {
        if (config.url.match(pattern)) {
          mockResponse = response;
          break;
        }
      }
    }

    // Default response if no mock found
    if (!mockResponse) {
      return {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "application/json" },
        data: { message: "Mock fallback response" } as any,
      };
    }

    // Simulate delay if specified
    if (mockResponse.delayMs) {
      await new Promise((resolve, reject) => {
        let timeoutId: NodeJS.Timeout | number | null = null;
        const delayMs = mockResponse.delayMs || 0;

        // Helper to set timeout - use clock if available, otherwise fall back to global
        const setTimer = (callback: () => void, ms: number) => {
          if (this.clock.setTimeout) {
            return this.clock.setTimeout(callback, ms);
          } else {
            return setTimeout(callback, ms);
          }
        };

        // Helper to clear timeout
        const clearTimer = (id: any | null) => {
          if (id !== null) {
            if (this.clock.clearTimeout) {
              this.clock.clearTimeout(id);
            } else {
              clearTimeout(id);
            }
          }
        };

        // Check for request timeout
        if (config.timeout && delayMs > config.timeout) {
          // Simulate axios timeout error
          timeoutId = setTimer(() => {
            const error: any = new Error(
              `timeout of ${config.timeout}ms exceeded`
            );
            error.code = "ECONNABORTED";
            error.timedOut = true;
            error.timeout = config.timeout;
            reject(error);
          }, config.timeout);
        } else {
          // Normal delay
          timeoutId = setTimer(() => resolve(undefined), delayMs);
        }

        // Handle abort signal
        if (config.signal) {
          const abortHandler = () => {
            clearTimer(timeoutId);
            reject(new Error("Request aborted"));
          };

          if (config.signal.aborted) {
            abortHandler();
          } else {
            config.signal.addEventListener("abort", abortHandler, {
              once: true,
            });
          }
        }
      });
    }

    const status = mockResponse.status || 200;
    const response = {
      status: status,
      statusText: mockResponse.statusText || "OK",
      headers: mockResponse.headers || { "content-type": "application/json" },
      data: mockResponse.data as T,
    };

    // Simulate Axios error for non-2xx status codes
    if (status < 200 || status >= 300) {
      const error: any = new Error(
        `Request failed with status code ${status}`
      );
      error.isAxiosError = true;
      error.response = response;
      error.status = status;
      throw error;
    }

    return response;
  }
}
