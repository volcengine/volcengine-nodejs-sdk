import type { Args, MiddlewareFunction, MiddlewareStackOptions } from "./types";
import { PRIORITY } from "./priority";

export const defaultHeadersMiddleware: {
  middleware: MiddlewareFunction;
  options: MiddlewareStackOptions;
} = {
  middleware: (next, context) => async (args: Args) => {
    const { request } = args;
    const { contentType } = context;
    if (!request.headers) {
      request.headers = {};
    }
    if (contentType) {
      request.headers["content-type"] = contentType;
    } else {
      request.headers["content-type"] = "application/json; charset=utf-8";
    }

    return next(args);
  },
  options: {
    step: PRIORITY.defaultHeadersMiddleware.step,
    name: "defaultHeadersMiddleware",
    priority: PRIORITY.defaultHeadersMiddleware.priority,
  },
};
