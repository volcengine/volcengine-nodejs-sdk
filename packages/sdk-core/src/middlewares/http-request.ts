import { canonicalQueryString } from "../utils/signer";
import type { RequestHandler } from "../types/request-handler";
import { HttpRequestError } from "../types/http-request-error";
import type { Args, MiddlewareFunction, MiddlewareStackOptions } from "./types";
import { PRIORITY } from "./priority";

export function createHttpRequestMiddleware(requestHandler: RequestHandler): {
  middleware: MiddlewareFunction;
  options: MiddlewareStackOptions;
} {
  const middleware: MiddlewareFunction =
    (next, context) => async (args: Args) => {
      const { request } = args;
      const clientConfig = context.clientConfig || {};

      let url = `${request.protocol || "https"}://${request.host}${
        request.pathname || "/"
      }`.trim();
      const queryString = canonicalQueryString(request.params as any);
      if (queryString) url += "?" + queryString;

      try {
        const response = await requestHandler.request({
          url,
          timeout:
            request.timeout || clientConfig.httpOptions?.timeout || 30 * 1000,
          method: request.method,
          headers: request.headers || {},
          data: request.body,
          signal: request.signal,
        });

        // Handle Volcengine specific error response
        if (response.data?.ResponseMetadata?.Error) {
          const { Code, Message } = response.data.ResponseMetadata.Error;
          const { RequestId } = response.data.ResponseMetadata;
          throw new HttpRequestError(
            "ApiException",
            `[${Code}] ${Message} (RequestId: ${RequestId})`,
            response.status,
            response.data,
            response
          );
        }

        return next({ ...args, response });
      } catch (error) {
        if (error instanceof HttpRequestError) {
          throw error;
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const status = (error as any).status || (error as any).response?.status;
        const data = (error as any).data || (error as any).response?.data;
        const code = (error as any).code;

        if (status < 200 || status > 299) {
          throw new HttpRequestError(
            "ApiException",
            `HTTP ${status}: ${(error as any).response?.statusText || "Error"}`,
            status,
            data,
            (error as any).response
          );
        }

        // Network Errors
        if (
          [
            "ECONNREFUSED", // urllib3.exceptions.NewConnectionError
            "ETIMEDOUT", // urllib3.exceptions.ConnectTimeoutError, socket.timeout
            "ECONNRESET", // urllib3.exceptions.ProtocolError (partial)
            "ENOTFOUND", // socket.gaierror
            "EHOSTUNREACH", // urllib3.exceptions.NewConnectionError (No Route to Host)
            "EAI_AGAIN", // socket.gaierror (DNS temporary failure)
            "EPROTO", // urllib3.exceptions.ProtocolError
            "ECONNABORTED", // urllib3.exceptions.ReadTimeoutError (Axios)
            "ENETUNREACH", // urllib3.exceptions.NewConnectionError (Network Unreachable)
            "EPIPE", // urllib3.exceptions.ProtocolError (Broken Pipe)
          ].includes(code) ||
          errorMessage.toLowerCase().includes("timeout") ||
          errorMessage.toLowerCase().includes("network error")
        ) {
          throw new HttpRequestError(
            "NetworkError",
            `Network error: ${errorMessage}`,
            undefined,
            undefined,
            error
          );
        }

        // SSL Errors - Treat as ApiException with status 0
        if (
          [
            "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
            "CERT_HAS_EXPIRED",
            "DEPTH_ZERO_SELF_SIGNED_CERT",
            "ERR_TLS_CERT_ALTNAME_INVALID",
          ].includes(code) ||
          errorMessage.toLowerCase().includes("ssl")
        ) {
          throw new HttpRequestError(
            "ApiException",
            `SSL Error: ${errorMessage}`,
            0,
            undefined,
            error
          );
        }

        throw new HttpRequestError(
          "Exception",
          `HTTP request failed: ${errorMessage || "Unknown error"}`,
          status,
          data,
          error
        );
      }
    };

  const options: MiddlewareStackOptions = {
    step: PRIORITY.httpRequestMiddleware.step,
    name: "httpRequestMiddleware",
    priority: PRIORITY.httpRequestMiddleware.priority,
  };

  return { middleware, options };
}
