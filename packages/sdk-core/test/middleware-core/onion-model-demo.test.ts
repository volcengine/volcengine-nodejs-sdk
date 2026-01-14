import { MiddlewareStack } from "../../src/middlewares/stack";
import { MiddlewareHandler } from "../../src/middlewares/types";

// Helper to create a wrapper middleware that logs execution order
function createLoggingMiddleware(name: string, logs: string[]) {
  return (next: MiddlewareHandler) => async (args: any) => {
    logs.push(`[${name}] 🔵 Start`);
    const result = await next(args);
    logs.push(`[${name}] 🟢 End`);
    return result;
  };
}

describe("Onion Model & Priority Demonstration", () => {
  let stack: MiddlewareStack;
  let logs: string[];

  beforeEach(() => {
    stack = new MiddlewareStack();
    logs = [];
  });

  const finalHandler: MiddlewareHandler = async (args) => {
    logs.push("  📡 [Actual HTTP Request]");
    return { response: { statusCode: 200, data: args.input } };
  };

  test("Scenario 1: Single Layer (Client Middleware Only)", async () => {
    stack.add(createLoggingMiddleware("globalLogger", logs), {
      step: "serialize",
      name: "globalLogger",
      priority: 100,
    });

    const handler = stack.resolve(finalHandler, {} as any);
    await handler({ input: { id: 123 } } as any);

    expect(logs).toEqual([
      "[globalLogger] 🔵 Start",
      "  📡 [Actual HTTP Request]",
      "[globalLogger] 🟢 End",
    ]);
  });

  test("Scenario 2: Multi-Layer (Client + Command Middleware) with Priorities", async () => {
    // Simulate Client Middlewares
    stack.add(createLoggingMiddleware("signer", logs), {
      step: "serialize",
      name: "signer",
      priority: 100,
    });
    stack.add(createLoggingMiddleware("retry", logs), {
      step: "finalizeRequest",
      name: "retry",
      priority: 60,
    });

    // Simulate Command Middlewares (Merging logic)
    const commandStack = new MiddlewareStack();
    commandStack.add(createLoggingMiddleware("cmdTimer", logs), {
      step: "build",
      name: "cmdTimer",
      priority: 80,
    });
    commandStack.add(createLoggingMiddleware("errorHandler", logs), {
      step: "finalizeRequest",
      name: "errorHandler",
      priority: 30,
    });

    const mergedStack = stack.merge(commandStack);
    const handler = mergedStack.resolve(finalHandler, {} as any);

    // Expected Order based on Steps and Priority:
    // 1. serialize: signer (p100)
    // 2. build: cmdTimer (p80)
    // 3. finalizeRequest: retry (p60) -> errorHandler (p30)

    await handler({ input: { name: "test" } } as any);

    expect(logs).toEqual([
      "[signer] 🔵 Start", // serialize
      "[cmdTimer] 🔵 Start", // build
      "[retry] 🔵 Start", // finalizeRequest (higher priority)
      "[errorHandler] 🔵 Start", // finalizeRequest (lower priority)
      "  📡 [Actual HTTP Request]",
      "[errorHandler] 🟢 End",
      "[retry] 🟢 End",
      "[cmdTimer] 🟢 End",
      "[signer] 🟢 End",
    ]);
  });

  test("Scenario 3: Priority Ordering (Onion Model Check)", async () => {
    stack.add(createLoggingMiddleware("highPriority", logs), {
      step: "serialize",
      name: "highPriority",
      priority: 200,
    });
    stack.add(createLoggingMiddleware("lowPriority", logs), {
      step: "serialize",
      name: "lowPriority",
      priority: 10,
    });

    const handler = stack.resolve(finalHandler, {} as any);
    await handler({ input: { id: 999 } } as any);

    expect(logs).toEqual([
      "[highPriority] 🔵 Start",
      "[lowPriority] 🔵 Start",
      "  📡 [Actual HTTP Request]",
      "[lowPriority] 🟢 End",
      "[highPriority] 🟢 End",
    ]);
  });

  test("Scenario 4: Full Step Execution Order", async () => {
    // Add middleware to every step to verify step order
    const steps = [
      "initialize",
      "serialize",
      "build",
      "finalizeRequest",
    ] as const;

    steps.forEach((step, index) => {
      stack.add(createLoggingMiddleware(step, logs), {
        step: step,
        name: step,
        priority: 10,
      });
    });

    const handler = stack.resolve(finalHandler, {} as any);
    await handler({} as any);

    expect(logs).toEqual([
      "[initialize] 🔵 Start",
      "[serialize] 🔵 Start",
      "[build] 🔵 Start",
      "[finalizeRequest] 🔵 Start",
      "  📡 [Actual HTTP Request]",
      "[finalizeRequest] 🟢 End",
      "[build] 🟢 End",
      "[serialize] 🟢 End",
      "[initialize] 🟢 End",
    ]);
  });

  test("Scenario 5: Full Real-World Middleware Simulation", async () => {
    // 1. Initialize Step
    // Tracing (Observability) - Outermost, tracks everything
    stack.add(createLoggingMiddleware("tracingMiddleware", logs), {
      step: "initialize",
      name: "tracingMiddleware",
      priority: 200,
    });
    // Metrics (Observability)
    stack.add(createLoggingMiddleware("metricsMiddleware", logs), {
      step: "initialize",
      name: "metricsMiddleware",
      priority: 190,
    });
    // Logging (Observability)
    stack.add(createLoggingMiddleware("loggingMiddleware", logs), {
      step: "initialize",
      name: "loggingMiddleware",
      priority: 180,
    });
    // Credentials - Get AK/SK
    stack.add(createLoggingMiddleware("credentialsMiddleware", logs), {
      step: "initialize",
      name: "credentialsMiddleware",
      priority: 100,
    });
    // Default Headers - Set content-type etc.
    stack.add(createLoggingMiddleware("defaultHeadersMiddleware", logs), {
      step: "initialize",
      name: "defaultHeadersMiddleware",
      priority: 100,
    });
    // Endpoint - Determine host
    stack.add(createLoggingMiddleware("endpointMiddleware", logs), {
      step: "initialize",
      name: "endpointMiddleware",
      priority: 50,
    });

    // 2. Serialize Step
    // Cast - Type conversion (Must happen BEFORE DotN)
    stack.add(createLoggingMiddleware("castMiddleware", logs), {
      step: "serialize",
      name: "castMiddleware",
      priority: 100,
    });
    // DotN - Flatten params
    stack.add(createLoggingMiddleware("dotNMiddleware", logs), {
      step: "serialize",
      name: "dotNMiddleware",
      priority: 50,
    });

    // 3. Build Step
    // Signer - Sign the request (needs flattened params and endpoint)
    stack.add(createLoggingMiddleware("signerMiddleware", logs), {
      step: "build",
      name: "signerMiddleware",
      priority: 100,
    });

    // 4. FinalizeRequest Step
    // Retry - Wraps the HTTP call
    stack.add(createLoggingMiddleware("retryMiddleware", logs), {
      step: "finalizeRequest",
      name: "retryMiddleware",
      priority: 100,
    });
    // HTTP Request - Sends the call
    stack.add(createLoggingMiddleware("httpRequestMiddleware", logs), {
      step: "finalizeRequest",
      name: "httpRequestMiddleware",
      priority: 50,
    });

    const handler = stack.resolve(finalHandler, {} as any);
    await handler({ input: {} } as any);

    // Verify Execution Order
    expect(logs).toEqual([
      // --- Initialize (Start) ---
      "[tracingMiddleware] 🔵 Start",
      "[metricsMiddleware] 🔵 Start",
      "[loggingMiddleware] 🔵 Start",
      "[credentialsMiddleware] 🔵 Start", // or defaultHeaders (same priority)
      "[defaultHeadersMiddleware] 🔵 Start",
      "[endpointMiddleware] 🔵 Start",

      // --- Serialize (Start) ---
      "[castMiddleware] 🔵 Start",
      "[dotNMiddleware] 🔵 Start",

      // --- Build (Start) ---
      "[signerMiddleware] 🔵 Start",

      // --- FinalizeRequest (Start) ---
      "[retryMiddleware] 🔵 Start",
      "[httpRequestMiddleware] 🔵 Start",

      // --- Actual Request ---
      "  📡 [Actual HTTP Request]",

      // --- FinalizeRequest (End) ---
      "[httpRequestMiddleware] 🟢 End",
      "[retryMiddleware] 🟢 End",

      // --- Build (End) ---
      "[signerMiddleware] 🟢 End",

      // --- Serialize (End) ---
      "[dotNMiddleware] 🟢 End",
      "[castMiddleware] 🟢 End",

      // --- Initialize (End) ---
      "[endpointMiddleware] 🟢 End",
      "[defaultHeadersMiddleware] 🟢 End",
      "[credentialsMiddleware] 🟢 End",
      "[loggingMiddleware] 🟢 End",
      "[metricsMiddleware] 🟢 End",
      "[tracingMiddleware] 🟢 End",
    ]);
  });

  test("Scenario 6: MiddlewareStack.toString() Debug Output", () => {
    stack.add(createLoggingMiddleware("A", logs), {
      step: "initialize",
      name: "A",
      priority: 10,
    });
    stack.add(createLoggingMiddleware("B", logs), {
      step: "initialize",
      name: "B",
      priority: 20,
    });
    stack.add(createLoggingMiddleware("C", logs), {
      step: "build",
      name: "C",
      priority: 5,
    });

    const output = stack.toString();
    const expected = `MiddlewareStack:
  [initialize]
    - B (priority: 20)
    - A (priority: 10)
  [build]
    - C (priority: 5)`;

    expect(output).toBe(expected);
  });
});
