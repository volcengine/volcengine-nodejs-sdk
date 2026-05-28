/**
 * Base Client implementation.
 * Handles request handler injection, middleware setup, retry logic, and credentials.
 */
import type { RequestHandler } from "../types/request-handler";
import type { Clock } from "../types/clock";
import { AxiosRequestHandler } from "../request-handlers/axios-handler";
import { RealClock } from "../types/clock";
import {
  MiddlewareStack,
  defaultHeadersMiddleware,
  signerMiddleware,
  createHttpRequestMiddleware,
  credentialsMiddleware,
  createRetryMiddleware,
  endpointMiddleware,
  createPresignMiddleware,
  debugMiddleware,
} from "../middlewares";
import {
  Request,
  Args,
  MiddlewareContext,
  MiddlewareFunction,
  MiddlewareStackOptions,
} from "../middlewares/types";
import type { CommandInput } from "../types/types";
import type {
  ClientConfig,
  SendOptions,
  CommandOutputMap,
} from "../types/types";
import type { Provider } from "../credentials/types";
import { Command } from "../command/Command";
import { dotNMiddleware } from "../middlewares/dotn";
import { shouldRetry, calculateRetryDelay } from "../utils/retry";
import { resolveHttpOptions } from "../utils/proxy";

export class Client {
  config: ClientConfig;
  middlewareStack: MiddlewareStack;
  private requestHandler: RequestHandler;
  private clock: Clock;

  constructor(config: ClientConfig = {}) {
    this.config = config;
    this.middlewareStack = new MiddlewareStack();

    // 读取环境变量中的代理配置
    const httpOptions = resolveHttpOptions(config);

    // 依赖注入：使用提供的 requestHandler 或创建默认的 AxiosRequestHandler
    if (config.requestHandler) {
      this.requestHandler = config.requestHandler;
    } else {
      // 使用 httpOptions 配置创建默认的 AxiosRequestHandler
      this.requestHandler = new AxiosRequestHandler(httpOptions || {});
    }

    // 依赖注入：使用提供的 clock 或创建默认的 RealClock
    this.clock = config.clock || new RealClock();

    this.setupDefaultMiddleware();
  }

  setupDefaultMiddleware(): void {
    // Debug middleware - log request/response when debug is enabled
    this.middlewareStack.add(
      debugMiddleware.middleware,
      debugMiddleware.options,
    );

    // Build middleware - set default headers
    this.middlewareStack.add(
      defaultHeadersMiddleware.middleware,
      defaultHeadersMiddleware.options,
    );

    // Build middleware - set credentials
    this.middlewareStack.add(
      credentialsMiddleware.middleware,
      credentialsMiddleware.options,
    );

    // Build middleware - set endpoint
    this.middlewareStack.add(
      endpointMiddleware.middleware,
      endpointMiddleware.options,
    );

    this.middlewareStack.add(dotNMiddleware.middleware, dotNMiddleware.options);

    // Serialize middleware - handle request signing
    this.middlewareStack.add(
      signerMiddleware.middleware,
      signerMiddleware.options,
    );

    // Finalize middleware - send actual HTTP request (highest priority within finalizeRequest)
    const httpRequest = createHttpRequestMiddleware(this.requestHandler);
    this.middlewareStack.add(httpRequest.middleware, httpRequest.options);

    // Finalize middleware - retry logic (wrapper around HTTP request, priority 100)
    const retry = createRetryMiddleware(
      this.clock,
      (error) => shouldRetry(error),
      (attempt, retryStrategy) => calculateRetryDelay(attempt, retryStrategy),
    );
    this.middlewareStack.add(retry.middleware, retry.options);
  }

  /**
   * Set the credential provider for this client.
   *
   * The provider will be called by the credentials middleware on every
   * request to resolve AK/SK(/Token). Providers that return temporary
   * credentials should handle caching & refresh internally.
   *
   * @example
   * ```ts
   * import { StaticCredentialProvider } from "@volcengine/sdk-core";
   * client.setCredentials(new StaticCredentialProvider({ accessKeyId: "AK", secretAccessKey: "SK" }));
   * ```
   */
  setCredentials(credentialProvider: Provider): void {
    this.config = { ...this.config, credentialProvider };
  }

  async send<
    TInput extends CommandInput,
    TOutput extends any,
    TCommandName extends keyof CommandOutputMap,
  >(
    command: Command<TInput, TOutput, TCommandName>,
    options?: SendOptions,
  ): Promise<TOutput> {
    const stack = this.middlewareStack.merge(command.middlewareStack);
    const context: MiddlewareContext = {
      clientName: this.constructor.name,
      commandName: command.constructor.name,
      clientConfig: this.config,
      contentType: command.requestConfig?.contentType || "",
    };
    const handler = stack.resolve(async (args: Args) => args, context);

    const request: Request = {
      host: this.config.host,
      protocol: this.config.protocol || "https",
      region: this.config.region || "cn-beijing",
      signal: options?.abortSignal,
      timeout: options?.timeout,
    };

    const config = command.requestConfig;
    if (config) {
      if (config.params) {
        request.params = config.params;
      }
      if (config.method) {
        request.method = config.method;
      }
      if (config.serviceName) {
        request.serviceName = config.serviceName;
      }
      if (config.pathname) {
        request.pathname = config.pathname;
      }
      // 根据 HTTP method 自动决定是否将 input 作为 body
      const method = config.method?.toUpperCase();
      if (method === "POST") {
        request.body = command.input;
      }

      if (method === "GET") {
        const inputParams =
          command.input &&
          typeof command.input === "object" &&
          !Array.isArray(command.input)
            ? (command.input as any)
            : {};

        request.params = { ...inputParams, ...(request.params || {}) };
      }
    }

    const result = await handler({
      input: command.input,
      request,
    });

    // Extra safety check: if result still contains axios response, extract data
    // This ensures we don't return the full axios response object
    if (
      result &&
      (result as any).response &&
      (result as any).response.data !== undefined
    ) {
      return (result as any).response.data;
    }
    return result as any;
  }

  async presign<
    TInput extends CommandInput,
    TOutput extends any,
    TCommandName extends keyof CommandOutputMap,
  >(command: Command<TInput, TOutput, TCommandName>): Promise<string> {
    const stack = this.middlewareStack.merge(command.middlewareStack);
    const presign = createPresignMiddleware();
    stack.add(presign.middleware, presign.options);

    const { handler, request } = this.createHandlerAndRequest(stack, command, {
      host: this.config.host,
      protocol: this.config.protocol || "https",
      region: this.config.region || "cn-beijing",
    });

    const result = await handler({ input: command.input, request });

    return result as string;
  }

  private createHandlerAndRequest<
    TInput extends CommandInput,
    TOutput extends any,
    TCommandName extends keyof CommandOutputMap,
  >(
    stack: MiddlewareStack,
    command: Command<TInput, TOutput, TCommandName>,
    baseRequest: Request,
  ): { handler: (args: Args) => Promise<any>; request: Request } {
    const context: MiddlewareContext = {
      clientName: this.constructor.name,
      commandName: command.constructor.name,
      clientConfig: this.config,
      contentType: command.requestConfig?.contentType || "",
    };
    const handler = stack.resolve(async (args: Args) => args, context);

    const request: Request = { ...baseRequest };

    const config = command.requestConfig;
    if (config) {
      if (config.params) {
        request.params = config.params;
      }
      if (config.method) {
        request.method = config.method;
      }
      if (config.serviceName) {
        request.serviceName = config.serviceName;
      }
      if (config.pathname) {
        request.pathname = config.pathname;
      }
      const method = config.method?.toUpperCase();
      if (method === "POST") {
        request.body = command.input;
      }

      if (method === "GET") {
        const inputParams =
          command.input &&
          typeof command.input === "object" &&
          !Array.isArray(command.input)
            ? (command.input as any)
            : {};

        request.params = { ...inputParams, ...(request.params || {}) };
      }
    }

    return { handler, request };
  }

  destroy(): void {
    // 清理 requestHandler 资源
    this.requestHandler.destroy?.();
  }

  /**
   * Returns a string representation of the full middleware stack (Client + Command)
   * Useful for debugging execution order and priority
   */
  debugMiddlewareStack<
    TInput extends CommandInput,
    TOutput extends any,
    TCommandName extends keyof CommandOutputMap,
  >(command: Command<TInput, TOutput, TCommandName>): string {
    const mergedStack = this.middlewareStack.merge(command.middlewareStack);
    return mergedStack.toString();
  }

  public addMiddleware(
    middleware: MiddlewareFunction,
    options: MiddlewareStackOptions,
  ): void {
    this.middlewareStack.add(middleware, options);
  }
}
