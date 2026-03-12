import { HttpRequestError, HttpRequestErrorName } from "./http-request-error";

export class ArkAPIError extends HttpRequestError {
  code?: string;
  param?: string;
  type: string;
  requestId: string;

  constructor(opts: {
    message: string;
    code?: string;
    param?: string;
    type: string;
    httpStatusCode: number;
    requestId: string;
  }) {
    super("ApiException", opts.message, opts.httpStatusCode, undefined, undefined);
    (this as any).name = "ArkAPIError";
    this.code = opts.code;
    this.param = opts.param;
    this.type = opts.type;
    this.requestId = opts.requestId;
  }

  get httpStatusCode(): number {
    return this.status ?? 0;
  }

  override toString(): string {
    return `Error code: ${this.httpStatusCode} - ${JSON.stringify({
      code: this.code,
      message: this.message,
      param: this.param,
      type: this.type,
      request_id: this.requestId,
    })}`;
  }
}

export class ArkRequestError extends HttpRequestError {
  requestId: string;

  constructor(opts: {
    httpStatusCode: number;
    message: string;
    requestId: string;
    cause?: Error;
  }) {
    super("NetworkError", opts.message, opts.httpStatusCode, undefined, opts.cause);
    (this as any).name = "ArkRequestError";
    this.requestId = opts.requestId;
  }

  get httpStatusCode(): number {
    return this.status ?? 0;
  }

  override toString(): string {
    return `RequestError code: ${this.httpStatusCode}, err: ${this.originalError?.message ?? this.message}, request_id: ${this.requestId}`;
  }
}

export interface ErrorResponse {
  error?: {
    code?: string;
    message: string;
    param?: string;
    type: string;
    request_id?: string;
  };
}

export const ErrTooManyEmptyStreamMessages = new Error(
  "stream has sent too many empty messages",
);
export const ErrChatCompletionStreamNotSupported = new Error(
  "streaming is not supported with this method, please use CreateChatCompletionStream",
);
export const ErrContentFieldsMisused = new Error(
  "can't use both Content and MultiContent properties simultaneously",
);
export const ErrBodyWithoutEndpoint = new Error(
  "can't fetch endpoint sts token without endpoint",
);
export const ErrBodyWithoutBot = new Error(
  "can't fetch bot sts token without bot id",
);
export const ErrAKSKNotSupported = new Error(
  "ak&sk authentication is currently not supported for this method, please use api key instead",
);
export const ErrBodyWithoutProjectName = new Error(
  "project name is required for preset endpoint",
);
