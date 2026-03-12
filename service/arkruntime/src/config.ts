import type { AxiosInstance } from "axios";

export const defaultBaseURL = "https://ark.cn-beijing.volces.com/api/v3";
export const defaultRegion = "cn-beijing";
export const defaultEmptyMessagesLimit = 300;
export const defaultRetryTimes = 2;
export const defaultTimeoutMs = 10 * 60 * 1000; // 10 min
export const defaultBatchMaxParallel = 3000;

export const resourceTypeEndpoint = "endpoint";
export const resourceTypeBot = "bot";
export const resourceTypePresetEndpoint = "presetendpoint";

export interface ClientConfig {
  /** API key for authentication (mutually exclusive with ak/sk) */
  apiKey?: string;
  /** Access key for AK/SK authentication */
  ak?: string;
  /** Secret key for AK/SK authentication */
  sk?: string;
  /** Region, defaults to "cn-beijing" */
  region?: string;
  /** Base URL for the API, defaults to "https://ark.cn-beijing.volces.com/api/v3" */
  baseURL?: string;
  /** Custom axios instance */
  httpClient?: AxiosInstance;
  /** Max number of empty SSE messages before error, defaults to 300 */
  emptyMessagesLimit?: number;
  /** Number of retry attempts, defaults to 2 */
  retryTimes?: number;
  /** Request timeout in milliseconds, defaults to 600000 (10 min) */
  timeout?: number;
  /** Max parallel batch requests, defaults to 3000 */
  batchMaxParallel?: number;
}

export interface ResolvedConfig {
  apiKey: string;
  ak: string;
  sk: string;
  region: string;
  baseURL: string;
  httpClient?: AxiosInstance;
  emptyMessagesLimit: number;
  retryTimes: number;
  timeout: number;
  batchMaxParallel: number;
}

export function resolveConfig(config: ClientConfig): ResolvedConfig {
  let baseURL = config.baseURL ?? process.env.ARK_BASE_URL ?? defaultBaseURL;
  if (baseURL.endsWith("/")) {
    baseURL = baseURL.slice(0, -1);
  }

  return {
    apiKey: config.apiKey ?? process.env.ARK_API_KEY ?? "",
    ak: config.ak ?? "",
    sk: config.sk ?? "",
    region: config.region ?? defaultRegion,
    baseURL,
    httpClient: config.httpClient,
    emptyMessagesLimit: config.emptyMessagesLimit ?? defaultEmptyMessagesLimit,
    retryTimes: config.retryTimes ?? defaultRetryTimes,
    timeout: config.timeout ?? defaultTimeoutMs,
    batchMaxParallel: config.batchMaxParallel ?? defaultBatchMaxParallel,
  };
}
