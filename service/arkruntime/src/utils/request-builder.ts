import type { AxiosRequestConfig } from "axios";
import { genRequestId } from "./request-id";
import { ClientRequestHeader } from "../types/common";

export interface RequestOptions {
  body?: unknown;
  contentType?: string;
  projectName?: string;
  customHeaders?: Record<string, string>;
  query?: Record<string, string>;
  signal?: AbortSignal;
  stream?: boolean;
}

/**
 * Build an AxiosRequestConfig from method, url, and request options.
 */
export function buildRequest(
  method: string,
  url: string,
  authHeader: Record<string, string>,
  opts: RequestOptions = {},
): AxiosRequestConfig {
  const headers: Record<string, string> = {
    [ClientRequestHeader]: genRequestId(),
    "Content-Type": opts.contentType ?? "application/json",
    ...authHeader,
    ...opts.customHeaders,
  };

  const config: AxiosRequestConfig = {
    method: method as any,
    url,
    headers,
    signal: opts.signal,
  };

  if (opts.body !== undefined) {
    config.data = opts.body;
  }

  if (opts.query) {
    config.params = opts.query;
  }

  if (opts.stream) {
    config.responseType = "stream";
  }

  return config;
}
