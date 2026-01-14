import {
  Middleware,
  MiddlewareContext,
  MiddlewareFunction,
  MiddlewareHandler,
  MiddlewareStackOptions,
} from "./types";

/**
 * Helper function to create a simple middleware (no options required)
 * This enables automatic type inference for the returned function
 */
export function createSimpleMiddleware(
  factory: () => MiddlewareFunction
): () => MiddlewareFunction {
  return factory;
}

/**
 * Helper function to create a configurable middleware with options
 * This enables automatic type inference for the returned function
 */
export function createMiddleware<TOptions>(
  factory: (options: TOptions) => MiddlewareFunction
): (options: TOptions) => MiddlewareFunction {
  return factory;
}

// ============================================================================
// Five-Phase Middleware Stack
// ============================================================================

export class MiddlewareStack {
  steps: {
    initialize: Middleware[];
    serialize: Middleware[];
    build: Middleware[];
    finalizeRequest: Middleware[];
  };

  private middlewareCounter: number = 0;

  constructor() {
    this.steps = {
      initialize: [],
      serialize: [],
      build: [],
      finalizeRequest: [],
    };
  }

  add(
    middleware: MiddlewareFunction,
    options: MiddlewareStackOptions = {}
  ): void {
    const step = options.step || "initialize";
    const name = options.name || `middleware_${++this.middlewareCounter}`;
    const priority = options.priority || 0;
    const override = options.override || false;

    if (override) {
      const index = this.steps[step].findIndex((mw) => mw.name === name);
      if (index !== -1) {
        this.steps[step][index] = { fn: middleware, name, step, priority };
        this.steps[step].sort((a, b) => b.priority - a.priority);
        return;
      }
    }

    this.steps[step].push({ fn: middleware, name, step, priority });
    this.steps[step].sort((a, b) => b.priority - a.priority);
  }

  resolve(
    handler: MiddlewareHandler,
    context: MiddlewareContext
  ): MiddlewareHandler {
    const chain = [
      ...this.steps.initialize,
      ...this.steps.serialize,
      ...this.steps.build,
      ...this.steps.finalizeRequest,
    ];

    return chain.reduceRight((next, mw) => {
      return (args) => mw.fn(next, context)(args);
    }, handler);
  }

  merge(other: MiddlewareStack): MiddlewareStack {
    const merged = new MiddlewareStack();

    Object.keys(this.steps).forEach((step) => {
      this.steps[step as keyof typeof this.steps].forEach((mw) => {
        merged.steps[step as keyof typeof merged.steps].push(mw);
      });
    });

    Object.keys(other.steps).forEach((step) => {
      other.steps[step as keyof typeof other.steps].forEach((mw) => {
        merged.steps[step as keyof typeof merged.steps].push(mw);
      });
    });

    Object.keys(merged.steps).forEach((step) => {
      merged.steps[step as keyof typeof merged.steps].sort(
        (a, b) => b.priority - a.priority
      );
    });

    return merged;
  }

  toString(): string {
    const steps = ["initialize", "serialize", "build", "finalizeRequest"];

    const lines: string[] = ["MiddlewareStack:"];
    for (const step of steps) {
      const middlewares = this.steps[step as keyof typeof this.steps];
      if (middlewares.length > 0) {
        lines.push(`  [${step}]`);
        for (const mw of middlewares) {
          lines.push(`    - ${mw.name} (priority: ${mw.priority})`);
        }
      }
    }
    return lines.join("\n");
  }
}
