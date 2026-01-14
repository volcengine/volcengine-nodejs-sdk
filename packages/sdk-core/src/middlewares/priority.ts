export const PRIORITY: Record<
  string,
  {
    priority: number;
    step: "initialize" | "serialize" | "build" | "finalizeRequest";
  }
> = {
  defaultHeadersMiddleware: {
    priority: 150,
    step: "initialize",
  },
  credentialsMiddleware: {
    priority: 100,
    step: "initialize",
  },
  endpointMiddleware: {
    priority: 50,
    step: "initialize",
  },
  dotNMiddleware: {
    priority: 50,
    step: "serialize",
  },
  signerMiddleware: {
    priority: 100,
    step: "build",
  },
  retryMiddleware: {
    priority: 100,
    step: "finalizeRequest",
  },
  httpRequestMiddleware: {
    priority: 50,
    step: "finalizeRequest",
  },
};
