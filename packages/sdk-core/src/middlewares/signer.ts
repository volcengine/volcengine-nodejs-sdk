import { signRequest } from "../utils/signer";
import type {
  Args,
  MiddlewareFunction,
  MiddlewareStackOptions,
  MiddlewareContext,
} from "./types";
import { PRIORITY } from "./priority";

export const signerMiddleware: {
  middleware: MiddlewareFunction;
  options: MiddlewareStackOptions;
} = {
  middleware: (next, context: MiddlewareContext) => async (args: Args) => {
    const { request } = args;
    const clientConfig = context.clientConfig || {};

    if (clientConfig.accessKeyId && clientConfig.secretAccessKey) {
      // Handle application/x-www-form-urlencoded body serialization
      const contentTypeKey = Object.keys(request.headers || {}).find(
        (k) => k.toLowerCase() === "content-type"
      );
      const contentType = contentTypeKey
        ? request.headers![contentTypeKey]
        : "";

      if (
        typeof contentType === "string" &&
        contentType.toLowerCase() === "application/x-www-form-urlencoded" &&
        request.body &&
        typeof request.body === "object"
      ) {
        const params = new URLSearchParams();
        Object.entries(request.body).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          params.append(key, String(value));
        });
        request.body = params.toString();
      }

      const result = signRequest({
        method: request.method,
        uri: request.pathname,
        query: request.params,
        headers: request.headers || {},
        body: request.body,
        region: request.region || clientConfig.region || "cn-beijing",
        serviceName: request.serviceName || "",
        accessKeyId: clientConfig.accessKeyId,
        secretAccessKey: clientConfig.secretAccessKey,
        sessionToken: clientConfig.sessionToken,
        host: request.host || "",
      });

      request.headers = result.headers;
    }

    return next(args);
  },
  options: {
    step: PRIORITY.signerMiddleware.step,
    name: "signerMiddleware",
    priority: PRIORITY.signerMiddleware.priority,
  },
};
