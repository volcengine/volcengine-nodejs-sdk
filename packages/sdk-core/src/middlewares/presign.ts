import type { Args, MiddlewareFunction, MiddlewareStackOptions } from "./types";
import { PRIORITY } from "./priority";
import { presignUrl } from "../utils/signer";

export const createPresignMiddleware = (): {
  middleware: MiddlewareFunction;
  options: MiddlewareStackOptions;
} => {
  const name = "presignMiddleware";
  const priority = PRIORITY.presignMiddleware.priority;
  const step = PRIORITY.presignMiddleware.step;

  return {
    middleware: (_next, context) => async (args: Args) => {
      const { request } = args;
      const { clientConfig } = context;

      const accessKeyId = clientConfig?.accessKeyId;
      const secretAccessKey = clientConfig?.secretAccessKey;
      const sessionToken = clientConfig?.sessionToken;

      if (!accessKeyId || !secretAccessKey) {
        throw new Error("Missing accessKeyId/secretAccessKey for presign");
      }

      const url = presignUrl({
        method: request.method,
        uri: request.pathname,
        query: request.params,
        region: request.region || clientConfig?.region || "cn-beijing",
        serviceName: request.serviceName || "",
        accessKeyId,
        secretAccessKey,
        sessionToken,
        host: clientConfig?.host || undefined,
        protocol: request.protocol,
      });
      return url;
    },
    options: {
      step,
      name,
      priority,
    },
  };
};
