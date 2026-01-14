/**
 * Command Base Class
 * Core abstraction representing an operation to be sent by a client.
 */
import { MiddlewareStack } from "../middlewares";
import type { CommandOutputMap, CommandInput } from "../types/types";

export class Command<
  TInput extends CommandInput = CommandInput,
  TOutput = any,
  TCommandName extends keyof CommandOutputMap | never = never
> {
  input: TInput;
  middlewareStack: MiddlewareStack;
  requestConfig?: {
    params?: Record<string, any>;
    method?: string;
    serviceName?: string;
    pathname?: string;
    contentType?: string;
  };
  requestMap?: Record<string, any>;
  responseMap?: Record<string, any>;

  protected __type?: {
    output: TOutput;
    commandName: TCommandName;
  };

  constructor(input: TInput) {
    this.input = input;
    this.middlewareStack = new MiddlewareStack();
  }

  /**
   * Returns a string representation of the command's local middleware stack
   * Useful for debugging execution order and priority of command-specific middleware
   */
  debugMiddlewareStack(): string {
    return this.middlewareStack.toString();
  }
}
