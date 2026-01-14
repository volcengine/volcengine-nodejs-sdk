import { MiddlewareStack } from "../src/middlewares/stack";
import { MiddlewareFunction } from "../src/middlewares/types";

describe("MiddlewareStack Override", () => {
  test("should override middleware when step and name match and override is true", async () => {
    const stack = new MiddlewareStack();
    const executions: string[] = [];

    const mw1: MiddlewareFunction = (next) => async (args) => {
      executions.push("mw1");
      return next(args);
    };

    const mw2: MiddlewareFunction = (next) => async (args) => {
      executions.push("mw2");
      return next(args);
    };

    stack.add(mw1, { step: "initialize", name: "testMW" });

    // Should override mw1 with mw2
    stack.add(mw2, { step: "initialize", name: "testMW", override: true });

    const handler = stack.resolve(async (args) => {
      return "result";
    }, {} as any);

    await handler({ request: {} } as any);

    expect(executions).toEqual(["mw2"]);
    expect(stack.steps.initialize.length).toBe(1);
    expect(stack.steps.initialize[0].name).toBe("testMW");
  });

  test("should NOT override middleware when override is false (default)", async () => {
    const stack = new MiddlewareStack();
    const executions: string[] = [];

    const mw1: MiddlewareFunction = (next) => async (args) => {
      executions.push("mw1");
      return next(args);
    };

    const mw2: MiddlewareFunction = (next) => async (args) => {
      executions.push("mw2");
      return next(args);
    };

    stack.add(mw1, { step: "initialize", name: "testMW" });

    // Should NOT override mw1, but add mw2.
    // Note: Same name is allowed if override is false (just pushed to stack)
    stack.add(mw2, { step: "initialize", name: "testMW" });

    const handler = stack.resolve(async (args) => {
      return "result";
    }, {} as any);

    await handler({ request: {} } as any);

    expect(stack.steps.initialize.length).toBe(2);
    expect(executions).toEqual(["mw1", "mw2"]); // Insertion order preserved for same priority
  });

  test("should NOT override middleware when name matches but step differs", () => {
    const stack = new MiddlewareStack();

    const mw1: MiddlewareFunction = (next) => async (args) => next(args);
    const mw2: MiddlewareFunction = (next) => async (args) => next(args);

    stack.add(mw1, { step: "initialize", name: "testMW" });
    stack.add(mw2, { step: "build", name: "testMW", override: true });

    expect(stack.steps.initialize.length).toBe(1);
    expect(stack.steps.build.length).toBe(1);
  });

  test("should respect priority when overriding", async () => {
    const stack = new MiddlewareStack();
    const executions: string[] = [];

    const mw1: MiddlewareFunction = (next) => async (args) => {
      executions.push("mw1");
      return next(args);
    };

    const mw2: MiddlewareFunction = (next) => async (args) => {
      executions.push("mw2");
      return next(args);
    };

    // Add mw1 with priority 10
    stack.add(mw1, { step: "initialize", name: "testMW", priority: 10 });

    // Override mw1 with mw2, but change priority to 20
    stack.add(mw2, {
      step: "initialize",
      name: "testMW",
      priority: 20,
      override: true,
    });

    // Add another middleware with priority 15 to check ordering
    stack.add(
      (next) => async (args) => {
        executions.push("mw3");
        return next(args);
      },
      { step: "initialize", name: "mw3", priority: 15 }
    );

    const handler = stack.resolve(async (args) => {
      return "result";
    }, {} as any);

    await handler({ request: {} } as any);

    // Order should be: mw2 (20) -> mw3 (15)
    expect(executions).toEqual(["mw2", "mw3"]);
    expect(stack.steps.initialize.length).toBe(2);
  });
});
