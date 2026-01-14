import { getDefaultEndpointByServiceInfo } from "../utils/endpoint";
import type { Args, MiddlewareFunction, MiddlewareStackOptions } from "./types";
import { PRIORITY } from "./priority";

export const endpointMiddleware: {
  middleware: MiddlewareFunction;
  options: MiddlewareStackOptions;
} = {
  middleware: (next, _context) => async (args: Args) => {
    const { request } = args;
    const { clientConfig } = _context;

    const { useDualStack, customBootstrapRegion } = clientConfig || {};
    // If host is already set, skip endpoint resolution
    if (request.host) {
      return next(args);
    }

    const defaultEndpoint = getDefaultEndpointByServiceInfo(
      request.serviceName || "",
      request.region || "",
      customBootstrapRegion,
      useDualStack
    );

    if (defaultEndpoint) {
      request.host = defaultEndpoint;
    }
    return next(args);
  },
  options: {
    step: PRIORITY.endpointMiddleware.step,
    name: "endpointMiddleware",
    priority: PRIORITY.endpointMiddleware.priority,
  },
};
