export type HttpRequestErrorName =
  | "Exception"
  | "ApiException"
  | "NetworkError";

/**
 * HttpRequestError
 * Standardized error class for HTTP request failures
 */
export class HttpRequestError extends Error {
  public status?: number;
  public data?: any;
  public originalError?: any;
  public override name: HttpRequestErrorName;

  constructor(
    name: HttpRequestErrorName = "Exception",
    message: string,
    status?: number,
    data?: any,
    originalError?: any
  ) {
    super(message);
    this.name = name;
    this.status = status;
    this.data = data;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpRequestError);
    }
  }
}
