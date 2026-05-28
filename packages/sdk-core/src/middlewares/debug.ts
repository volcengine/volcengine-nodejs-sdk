import type {
  Args,
  MiddlewareFunction,
  MiddlewareStackOptions,
} from "./types";
import { PRIORITY } from "./priority";

import { LogLevel } from "../types/types";
import type { DebugOptions, DebugLogger } from "../types/types";

/**
 * Parent-level dependencies for each log level.
 * When a child level is enabled, its parent levels are implicitly enabled.
 */
const LOG_LEVEL_PARENTS: Partial<Record<LogLevel, LogLevel>> = {
  [LogLevel.LOG_DEBUG_WITH_REQUEST_BODY]: LogLevel.LOG_DEBUG_WITH_REQUEST,
  [LogLevel.LOG_DEBUG_WITH_REQUEST_ID]: LogLevel.LOG_DEBUG_WITH_REQUEST,
  [LogLevel.LOG_DEBUG_WITH_RESPONSE]: LogLevel.LOG_DEBUG_WITH_REQUEST,
  [LogLevel.LOG_DEBUG_WITH_RESPONSE_BODY]: LogLevel.LOG_DEBUG_WITH_RESPONSE,
  [LogLevel.LOG_DEBUG_WITH_SIGNING]: LogLevel.LOG_DEBUG_WITH_REQUEST,
  [LogLevel.LOG_DEBUG_WITH_ENDPOINT]: LogLevel.LOG_DEBUG_WITH_REQUEST,
  [LogLevel.LOG_DEBUG_WITH_REQUEST_RETRIES]: LogLevel.LOG_DEBUG_WITH_REQUEST,
  [LogLevel.LOG_DEBUG_WITH_CONFIG]: LogLevel.LOG_DEBUG_WITH_REQUEST,
};

/**
 * Expand a user-specified logLevel bitmask to include all implied parent levels.
 */
function expandLogLevel(mask: number): number {
  let expanded = mask;
  for (const [child, parent] of Object.entries(LOG_LEVEL_PARENTS)) {
    if (expanded & Number(child)) {
      expanded |= parent as number;
    }
  }
  return expanded;
}

// ============================================================================
// Logger implementations
// ============================================================================

/**
 * Default console logger with configurable format.
 * Output goes to `process.stderr` (same convention as debug libraries).
 */
class ConsoleDebugLogger implements DebugLogger {
  private format: string;

  constructor(format?: string) {
    this.format = format || "%(timestamp)s %(level)s %(message)s";
  }

  debug(message: string): void {
    const timestamp = new Date().toISOString();
    const line = this.format
      .replace("%(timestamp)s", timestamp)
      .replace("%(level)s", "DEBUG")
      .replace("%(message)s", message);
    process.stderr.write(line + "\n");
  }
}

/**
 * File-based logger — appends debug lines to a file.
 * Uses synchronous writes for simplicity (debug output is low-volume).
 */
class FileDebugLogger implements DebugLogger {
  private filePath: string;
  private format: string;
  private fs: typeof import("fs") | null = null;

  constructor(filePath: string, format?: string) {
    this.filePath = filePath;
    this.format = format || "%(timestamp)s %(level)s %(message)s";
  }

  private getFs(): typeof import("fs") {
    if (!this.fs) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.fs = require("fs");
    }
    return this.fs!;
  }

  debug(message: string): void {
    const timestamp = new Date().toISOString();
    const line = this.format
      .replace("%(timestamp)s", timestamp)
      .replace("%(level)s", "DEBUG")
      .replace("%(message)s", message);
    this.getFs().appendFileSync(this.filePath, line + "\n");
  }
}



// ============================================================================
// Internal helpers
// ============================================================================

function resolveLogger(config: DebugOptions): DebugLogger {
  if (config.logger) {
    return config.logger;
  }
  if (config.loggerFile) {
    return new FileDebugLogger(config.loggerFile, config.loggerFormat);
  }
  return new ConsoleDebugLogger(config.loggerFormat);
}

function maskSensitiveHeaders(
  headers: Record<string, any>
): Record<string, any> {
  const masked = { ...headers };
  const sensitiveKeys = ["authorization", "x-security-token"];
  for (const key of Object.keys(masked)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      const val = String(masked[key]);
      masked[key] = val.length > 12 ? val.slice(0, 8) + "****" + val.slice(-4) : "****";
    }
  }
  return masked;
}

function truncateBody(body: any, maxLen = 1024): string {
  if (body === undefined || body === null) return "<empty>";
  let str: string;
  if (typeof body === "string") {
    str = body;
  } else if (Buffer.isBuffer(body)) {
    str = `<Buffer length=${body.length}>`;
  } else {
    try {
      str = JSON.stringify(body);
    } catch {
      str = String(body);
    }
  }
  if (str.length > maxLen) {
    return str.slice(0, maxLen) + `... (truncated, total ${str.length} chars)`;
  }
  return str;
}

// ============================================================================
// Debug middleware
// ============================================================================

export const debugMiddleware: {
  middleware: MiddlewareFunction;
  options: MiddlewareStackOptions;
} = {
  middleware: (next, context) => async (args: Args) => {
    const clientConfig = context.clientConfig || {};
    const debugConfig = (clientConfig as any).debugOptions as DebugOptions | undefined;

    // Short-circuit: if debug is not enabled, pass through immediately
    if (!debugConfig?.debug) {
      return next(args);
    }

    const effectiveLevel = expandLogLevel(
      debugConfig.logLevel ?? LogLevel.LOG_DEBUG_ALL
    );
    const logger = resolveLogger(debugConfig);

    const { request } = args;
    const tag = `[${context.clientName}::${context.commandName}]`;

    // ── Config ───────────────────────────────────────────────────────
    if (effectiveLevel & LogLevel.LOG_DEBUG_WITH_CONFIG) {
      const safeConfig: Record<string, any> = {
        region: clientConfig.region,
        protocol: clientConfig.protocol,
        host: clientConfig.host,
        autoRetry: clientConfig.autoRetry,
        maxRetries: clientConfig.maxRetries,
      };
      if (clientConfig.httpOptions) {
        safeConfig.httpOptions = {
          timeout: clientConfig.httpOptions.timeout,
          connectTimeout: clientConfig.httpOptions.connectTimeout,
          readTimeout: clientConfig.httpOptions.readTimeout,
          proxy: clientConfig.httpOptions.proxy,
          ignoreSSL: clientConfig.httpOptions.ignoreSSL,
        };
      }
      logger.debug(`${tag} Config: ${JSON.stringify(safeConfig)}`);
    }

    // ── Endpoint ─────────────────────────────────────────────────────
    if (effectiveLevel & LogLevel.LOG_DEBUG_WITH_ENDPOINT) {
      logger.debug(
        `${tag} Endpoint: host=${request.host || "<unresolved>"}, ` +
          `serviceName=${request.serviceName || "<unknown>"}, ` +
          `region=${request.region || clientConfig.region || "<default>"}`
      );
    }

    // ── Request ──────────────────────────────────────────────────────
    if (effectiveLevel & LogLevel.LOG_DEBUG_WITH_REQUEST) {
      const method = (request.method || "GET").toUpperCase();
      const protocol = request.protocol || "https";
      let url = `${protocol}://${request.host || ""}${request.pathname || "/"}`;
      if (request.params && Object.keys(request.params).length > 0) {
        const qs = new URLSearchParams(
          Object.entries(request.params).reduce(
            (acc, [k, v]) => {
              if (v !== undefined && v !== null) acc[k] = String(v);
              return acc;
            },
            {} as Record<string, string>
          )
        ).toString();
        if (qs) url += "?" + qs;
      }
      logger.debug(`${tag} Request: ${method} ${url}`);
      if (request.headers) {
        logger.debug(
          `${tag} Request Headers: ${JSON.stringify(maskSensitiveHeaders(request.headers))}`
        );
      }
    }

    // ── Request body ─────────────────────────────────────────────────
    if (effectiveLevel & LogLevel.LOG_DEBUG_WITH_REQUEST_BODY) {
      logger.debug(
        `${tag} Request Body: ${truncateBody(request.body)}`
      );
    }

    // ── Signing (logged before next() so signing info is available) ──
    if (effectiveLevel & LogLevel.LOG_DEBUG_WITH_SIGNING) {
      const hasCredentials = !!(
        clientConfig.accessKeyId && clientConfig.secretAccessKey
      );
      logger.debug(
        `${tag} Signing: credentials=${hasCredentials ? "present" : "missing"}, ` +
          `region=${request.region || clientConfig.region || "cn-beijing"}, ` +
          `serviceName=${request.serviceName || "<unknown>"}`
      );
    }

    // ── Execute downstream middleware chain ───────────────────────────
    const startTime = Date.now();
    let result: any;
    let error: any;
    try {
      result = await next(args);
    } catch (err) {
      error = err;
    }
    const elapsed = Date.now() - startTime;

    // ── Response ─────────────────────────────────────────────────────
    if (result) {
      const response = args.response || result?.response;

      if (effectiveLevel & LogLevel.LOG_DEBUG_WITH_RESPONSE) {
        const status = response?.status || response?.statusCode || "N/A";
        logger.debug(`${tag} Response: status=${status}, elapsed=${elapsed}ms`);
        if (response?.headers) {
          logger.debug(
            `${tag} Response Headers: ${JSON.stringify(response.headers)}`
          );
        }
      }

      if (effectiveLevel & LogLevel.LOG_DEBUG_WITH_RESPONSE_BODY) {
        const body = response?.data ?? response?.body ?? result;
        logger.debug(
          `${tag} Response Body: ${truncateBody(body, 2048)}`
        );
      }

      // ── RequestId ──────────────────────────────────────────────────
      if (effectiveLevel & LogLevel.LOG_DEBUG_WITH_REQUEST_ID) {
        const responseData = response?.data ?? result;
        const requestId =
          responseData?.ResponseMetadata?.RequestId || "N/A";
        logger.debug(`${tag} RequestId: ${requestId}`);
      }
    }

    // ── Retry info (logged on error) ─────────────────────────────────
    if (error && effectiveLevel & LogLevel.LOG_DEBUG_WITH_REQUEST_RETRIES) {
      const errMsg =
        error instanceof Error ? error.message : String(error);
      logger.debug(
        `${tag} Request failed (elapsed=${elapsed}ms): ${errMsg}`
      );
    }

    // Re-throw if the downstream chain errored
    if (error) {
      // Still log basic error info if request level is enabled
      if (effectiveLevel & LogLevel.LOG_DEBUG_WITH_REQUEST) {
        const errMsg =
          error instanceof Error ? error.message : String(error);
        logger.debug(`${tag} Error: ${errMsg}`);
      }
      throw error;
    }

    return result;
  },
  options: {
    step: PRIORITY.debugMiddleware.step,
    name: "debugMiddleware",
    priority: PRIORITY.debugMiddleware.priority,
  },
};
