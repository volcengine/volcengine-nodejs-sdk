import type { HttpResponse } from "../types/request-handler";
import type { ClientConfig, CommandInput } from "../types/types";

// ============================================================================
// Core command & request types used by middleware
// ============================================================================

export interface Request {
  method?: string;
  pathname?: string;
  headers?: Record<string, any>;
  params?: Record<string, any>;
  body?: any;
  region?: string;
  host?: string;
  protocol?: string;
  timeout?: number;
  serviceName?: string;
  signal?: AbortSignal;
}

export interface Args {
  input?: CommandInput;
  request: Request;
  response?: HttpResponse;
}

/**
 * Context object passed to middleware
 * Contains metadata about the client and command being executed
 */
export interface MiddlewareContext {
  clientName: string;
  commandName: string;
  /**
   * Client configuration object
   * Typed as a broad object to avoid coupling middleware to ClientConfig
   */
  clientConfig: ClientConfig;
  /**
   * Content type for the request
   */
  contentType?: string;
}

/**
 * Handler function for the next middleware in the chain
 */
export interface MiddlewareHandler {
  (args: Args): Promise<any>;
}

/**
 * Middleware function signature
 */
export type MiddlewareFunction = (
  next: MiddlewareHandler,
  context: MiddlewareContext
) => MiddlewareHandler;

export interface MiddlewareStackOptions {
  step?: "initialize" | "serialize" | "build" | "finalizeRequest";
  name?: string;
  priority?: number;
  override?: boolean;
}

/**
 * Simple middleware function (no options required)
 * For direct use without factory pattern
 */
export type SimpleMiddlewareFn = MiddlewareFunction;

/**
 * Middleware factory with options
 * For creating configurable middleware
 */
export type MiddlewareFactory<TOptions = void> = (
  options: TOptions
) => MiddlewareFunction;

/**
 * Stored middleware instance with metadata
 */
export interface Middleware {
  fn: MiddlewareFunction;
  name: string;
  step: string;
  priority: number;
}
