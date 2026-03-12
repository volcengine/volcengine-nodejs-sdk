import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type AxiosRequestConfig,
} from "axios";
import * as fs from "fs";
import * as https from "https";
import { genRequestId } from "./utils/request-id";
import { retry, type RetryPolicy } from "./utils/retry";
import { ModelBreakerProvider } from "./utils/breaker-provider";
import {
  ChatCompletionStreamReader,
  BotChatCompletionStreamReader,
  ImageGenerationStreamReader,
  ResponsesStreamReader,
} from "./utils/stream-reader";
import {
  type ClientConfig,
  type ResolvedConfig,
  resolveConfig,
  resourceTypeEndpoint,
  resourceTypeBot,
  resourceTypePresetEndpoint,
} from "./config";
import {
  ClientRequestHeader,
  ClientSessionTokenHeader,
  ClientEncryptInfoHeader,
  ClientIsEncryptedHeader,
  ErrorRetryBaseDelayMs,
  ErrorRetryMaxDelayMs,
  DefaultAdvisoryRefreshTimeout,
  DefaultMandatoryRefreshTimeout,
  DefaultStsTimeout,
} from "./types/common";
import { ArkAPIError, ArkRequestError, type ErrorResponse } from "./types/error";
import {
  ErrChatCompletionStreamNotSupported,
  ErrAKSKNotSupported,
} from "./types/error";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamResponse,
} from "./types/chat-completion";
import type {
  BotChatCompletionRequest,
  BotChatCompletionResponse,
  BotChatCompletionStreamResponse,
} from "./types/bot";
import type {
  EmbeddingRequest,
  EmbeddingResponse,
} from "./types/embeddings";
import type { GenerateImagesRequest, ImagesResponse, ImagesStreamResponse } from "./types/images";
import type { TokenizationRequest, TokenizationResponse } from "./types/tokenization";
import type {
  CreateContextRequest,
  CreateContextResponse,
  ContextChatCompletionRequest,
} from "./types/context";
import type {
  CreateContentGenerationTaskRequest,
  CreateContentGenerationTaskResponse,
  GetContentGenerationTaskResponse,
  ListContentGenerationTasksRequest,
  ListContentGenerationTasksResponse,
  DeleteContentGenerationTaskRequest,
} from "./types/content-generation";
import type {
  FileMeta,
  UploadFileRequest,
  ListFilesRequest,
  ListFilesResponse,
  DeleteFileResponse,
} from "./types/file";
import { PurposeUserData, FileStatusProcessing } from "./types/file";
import type {
  MultiModalEmbeddingRequest,
  MultimodalEmbeddingResponse,
} from "./types/multimodal-embedding";
import type {
  ResponsesRequest,
  ResponsesInput,
  InputItem,
  ContentItem,
  ContentItemImage,
  ContentItemVideo,
  ContentItemFile,
} from "./types/responses/types";
import {
  E2eeClient,
  checkIsModeAICC,
  loadLocalCertificate,
  saveToLocalCertificate,
} from "./encryption/key-agreement";
import {
  encryptChatRequest,
  deepCopyRequest,
} from "./encryption/encrypt-chat";
import {
  normalizeChatCompletionResponse,
  normalizeEmbeddingResponse,
} from "./utils/normalize";

// Path constants
const chatCompletionsSuffix = "/chat/completions";
const botChatCompletionsSuffix = "/bots/chat/completions";
const embeddingsSuffix = "/embeddings";
const multimodalEmbeddingsSuffix = "/embeddings/multimodal";
const generateImagesPath = "/images/generations";
const tokenizationSuffix = "/tokenization";
const contextCreateSuffix = "/context/create";
const contextChatSuffix = "/context/chat/completions";
const contentGenerationTaskPath = "/contents/generations/tasks";
const filePrefix = "/files";
const batchChatCompletionsSuffix = "/batch/chat/completions";
const batchEmbeddingsSuffix = "/batch/embeddings";
const batchMultiModalEmbeddingsSuffix = "/batch/embeddings/multimodal";
const e2eGetCertificatePath = "/e2e/get/certificate";

// File preprocessing constants
const FILE_SCHEME = "file";
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_TIME_MS = 10 * 60 * 1000;

interface CertificateResponse {
  Certificate: string;
  error?: Record<string, string>;
}

export interface RequestOptions {
  customHeaders?: Record<string, string>;
  projectName?: string;
  signal?: AbortSignal;
  query?: Record<string, string>;
}

interface TokenInfo {
  token: string;
  expiredTime: number; // unix timestamp (seconds)
}

export class ArkRuntimeClient {
  private config: ResolvedConfig;
  private httpClient: AxiosInstance;
  private batchHttpClient: AxiosInstance;
  private resourceStsTokens = new Map<string, TokenInfo>();
  private refreshPromise: Promise<void> | null = null;
  private advisoryRefreshTimeout = DefaultAdvisoryRefreshTimeout;
  private mandatoryRefreshTimeout = DefaultMandatoryRefreshTimeout;
  private modelBreakerProvider = new ModelBreakerProvider();

  // E2EE state
  private e2eeManager = new Map<string, E2eeClient>();
  private keyNonceMap = new Map<string, Buffer>();
  private e2eeFlightMap = new Map<string, Promise<E2eeClient>>();

  constructor(config: ClientConfig) {
    this.config = resolveConfig(config);
    this.httpClient =
      this.config.httpClient ??
      axios.create({
        timeout: this.config.timeout,
        httpsAgent: new https.Agent({ keepAlive: true }),
        paramsSerializer: (params) => {
          const parts: string[] = [];
          for (const [key, value] of Object.entries(params)) {
            if (Array.isArray(value)) {
              for (const v of value) {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
              }
            } else if (value != null) {
              parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
            }
          }
          return parts.join("&");
        },
      });
    this.batchHttpClient = axios.create({
      timeout: this.config.timeout,
      httpsAgent: new https.Agent({ keepAlive: true }),
    });
  }

  /** Create with API key auth */
  static withApiKey(apiKey: string, config: Omit<ClientConfig, "apiKey"> = {}): ArkRuntimeClient {
    return new ArkRuntimeClient({ ...config, apiKey });
  }

  /** Create with AK/SK auth */
  static withAkSk(ak: string, sk: string, config: Omit<ClientConfig, "ak" | "sk"> = {}): ArkRuntimeClient {
    return new ArkRuntimeClient({ ...config, ak, sk });
  }

  // ─── URL helpers ──────────────────────────────────────────────
  private fullURL(suffix: string): string {
    return `${this.config.baseURL}${suffix}`;
  }

  private isAPIKeyAuth(): boolean {
    return this.config.apiKey.length > 0;
  }

  // ─── Resource type detection ──────────────────────────────────
  private getResourceTypeById(resourceId: string): string {
    if (resourceId.startsWith("ep-m-")) return resourceTypePresetEndpoint;
    if (resourceId.startsWith("ep-")) return resourceTypeEndpoint;
    if (resourceId.startsWith("bot-")) return resourceTypeBot;
    return resourceTypePresetEndpoint;
  }

  // ─── STS token management ────────────────────────────────────
  private stsKey(resourceType: string, resourceId: string): string {
    return `${resourceType}#${resourceId}`;
  }

  private needRefresh(
    resourceType: string,
    resourceId: string,
    delta: number,
  ): boolean {
    const info = this.resourceStsTokens.get(
      this.stsKey(resourceType, resourceId),
    );
    if (!info) return true;
    return info.expiredTime - Math.floor(Date.now() / 1000) < delta;
  }

  private async refreshToken(
    resourceType: string,
    resourceId: string,
    projectName: string,
  ): Promise<void> {
    if (!this.needRefresh(resourceType, resourceId, this.advisoryRefreshTimeout)) {
      return;
    }

    // Coalesce concurrent refreshes into a single promise
    if (this.refreshPromise) {
      await this.refreshPromise;
      if (!this.needRefresh(resourceType, resourceId, this.advisoryRefreshTimeout)) {
        return;
      }
    }

    this.refreshPromise = this.doRefresh(resourceType, resourceId, projectName);
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(
    resourceType: string,
    resourceId: string,
    projectName: string,
  ): Promise<void> {
    // Dynamic import to avoid circular deps at module load time
    try {
      const { ARKClient } = await import("@volcengine/ark");
      const { GetApiKeyCommand } = await import("@volcengine/ark");
      const arkClient = new ARKClient({
        accessKeyId: this.config.ak,
        secretAccessKey: this.config.sk,
        region: this.config.region,
      });
      const input = {
        DurationSeconds: DefaultStsTimeout,
        ResourceIds: [resourceId],
        ResourceType: resourceType,
        ...(projectName ? { ProjectName: projectName } : {}),
      };
      const resp = await arkClient.send(new GetApiKeyCommand(input));
      const result = resp.Result;
      if (result?.ApiKey && result?.ExpiredTime) {
        this.resourceStsTokens.set(this.stsKey(resourceType, resourceId), {
          token: result.ApiKey,
          expiredTime: result.ExpiredTime,
        });
      }
    } catch (err) {
      const isMandatory = this.needRefresh(
        resourceType,
        resourceId,
        this.mandatoryRefreshTimeout,
      );
      if (isMandatory) throw err;
      // Advisory refresh failure is silently ignored
    }
  }

  // ─── Public STS token API ────────────────────────────────────
  /** Get an STS token for the given endpoint ID (mirrors Go SDK). */
  async getEndpointStsToken(endpointId: string): Promise<string> {
    return this.getResourceStsToken(resourceTypeEndpoint, endpointId);
  }

  /** Get an STS token for an arbitrary resource (mirrors Go SDK). */
  async getResourceStsToken(
    resourceType: string,
    resourceId: string,
    projectName?: string,
  ): Promise<string> {
    await this.refreshToken(resourceType, resourceId, projectName ?? "");
    const info = this.resourceStsTokens.get(
      this.stsKey(resourceType, resourceId),
    );
    return info?.token ?? "";
  }

  // ─── Auth header ──────────────────────────────────────────────
  private async getAuthHeader(
    resourceType: string,
    resourceId: string,
    projectName?: string,
  ): Promise<Record<string, string>> {
    if (this.isAPIKeyAuth()) {
      return { Authorization: `Bearer ${this.config.apiKey}` };
    }

    resourceType = this.getResourceTypeById(resourceId);
    await this.refreshToken(resourceType, resourceId, projectName ?? "");
    const info = this.resourceStsTokens.get(
      this.stsKey(resourceType, resourceId),
    );
    return { Authorization: `Bearer ${info?.token ?? ""}` };
  }

  // ─── Core request execution ───────────────────────────────────
  private retryPolicy(): RetryPolicy {
    return {
      maxAttempts: this.config.retryTimes,
      initialBackoffMs: ErrorRetryBaseDelayMs,
      maxBackoffMs: ErrorRetryMaxDelayMs,
    };
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof ArkAPIError) {
      return (
        err.httpStatusCode >= 500 || err.httpStatusCode === 429
      );
    }
    if (err instanceof ArkRequestError) {
      return err.httpStatusCode >= 500;
    }
    return false;
  }

  private async executeRequest<T>(
    method: string,
    url: string,
    resourceType: string,
    resourceId: string,
    opts?: RequestOptions & { body?: unknown; stream?: boolean },
  ): Promise<AxiosResponse<T>> {
    const authHeader = await this.getAuthHeader(
      resourceType,
      resourceId,
      opts?.projectName,
    );
    const requestId = genRequestId();
    const headers: Record<string, string> = {
      [ClientRequestHeader]: requestId,
      "Content-Type": "application/json",
      Accept: opts?.stream ? "text/event-stream" : "application/json",
      ...authHeader,
      ...opts?.customHeaders,
    };
    if (opts?.stream) {
      headers["Cache-Control"] = "no-cache";
      headers["Connection"] = "keep-alive";
    }
    if (opts?.projectName) {
      headers["X-Project-Name"] = opts.projectName;
    }

    const axiosConfig: AxiosRequestConfig = {
      method: method as any,
      url,
      headers,
      data: opts?.body,
      params: opts?.query,
      signal: opts?.signal,
      responseType: opts?.stream ? "stream" : "json",
      validateStatus: () => true, // handle status codes ourselves
    };

    const resp = await this.httpClient.request<T>(axiosConfig);

    // Error handling
    if (resp.status < 200 || resp.status >= 400) {
      this.handleErrorResponse(resp, requestId);
    }

    return resp;
  }

  private handleErrorResponse(resp: AxiosResponse, requestId: string): never {
    let errData: any;
    try {
      errData = typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;
    } catch {
      throw new ArkRequestError({
        httpStatusCode: resp.status,
        message: `Request failed with status ${resp.status}`,
        requestId,
      });
    }

    if (errData?.error) {
      throw new ArkAPIError({
        message: errData.error.message ?? "Unknown error",
        code: errData.error.code,
        param: errData.error.param,
        type: errData.error.type ?? "unknown",
        httpStatusCode: resp.status,
        requestId:
          errData.error.request_id ??
          (resp.headers?.[ClientRequestHeader.toLowerCase()] as string) ??
          requestId,
      });
    }

    throw new ArkRequestError({
      httpStatusCode: resp.status,
      message: `Request failed with status ${resp.status}`,
      requestId,
    });
  }

  // ─── E2EE encryption ─────────────────────────────────────────
  private async getE2eeClient(resourceId: string, authorization: string): Promise<E2eeClient> {
    // Check in-memory cache
    const cached = this.e2eeManager.get(resourceId);
    if (cached && (cached.isAICC === checkIsModeAICC())) {
      return cached;
    }

    // Singleflight: coalesce concurrent certificate fetches
    const existing = this.e2eeFlightMap.get(resourceId);
    if (existing) return existing;

    const promise = this.doLoadE2eeClient(resourceId, authorization);
    this.e2eeFlightMap.set(resourceId, promise);
    try {
      const client = await promise;
      return client;
    } finally {
      this.e2eeFlightMap.delete(resourceId);
    }
  }

  private async doLoadE2eeClient(resourceId: string, authorization: string): Promise<E2eeClient> {
    // Re-check after acquiring flight
    const cached = this.e2eeManager.get(resourceId);
    if (cached && (cached.isAICC === checkIsModeAICC())) {
      return cached;
    }

    // Try local certificate cache
    let certPem = loadLocalCertificate(resourceId);
    if (!certPem) {
      // Fetch from server
      certPem = await this.loadServerCertificate(resourceId, authorization);
      saveToLocalCertificate(resourceId, certPem);
    }

    const client = new E2eeClient(certPem);
    this.e2eeManager.set(resourceId, client);
    return client;
  }

  private async loadServerCertificate(resourceId: string, authorization: string): Promise<string> {
    const url = this.fullURL(e2eGetCertificatePath);
    const body: Record<string, string> = { model: resourceId };
    if (checkIsModeAICC()) {
      body.type = "AICCv0.1";
    }
    const resp = await this.httpClient.request<CertificateResponse>({
      method: "POST",
      url,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authorization,
        [ClientSessionTokenHeader]: e2eGetCertificatePath,
      },
      data: body,
      validateStatus: () => true,
    });
    if (resp.status < 200 || resp.status >= 400) {
      throw new Error(`getting Certificate failed: HTTP ${resp.status}`);
    }
    const cr = resp.data;
    if (cr.error && Object.keys(cr.error).length > 0) {
      throw new Error(`getting Certificate failed: ${JSON.stringify(cr.error)}`);
    }
    return cr.Certificate;
  }

  /**
   * Encrypt a streaming chat completion request.
   * Only called when x-is-encrypted header is "true" AND request is streaming.
   * Matches Go's encryptRequest.
   */
  private async encryptRequestBody(
    resourceId: string,
    requestId: string,
    authorization: string,
    request: ChatCompletionRequest,
  ): Promise<{ body: ChatCompletionRequest; extraHeaders: Record<string, string> }> {
    const e2eeClient = await this.getE2eeClient(resourceId, authorization);
    const [keyNonce, sessionToken] = e2eeClient.generateECIESKeyPair();

    const extraHeaders: Record<string, string> = {
      [ClientSessionTokenHeader]: sessionToken,
    };
    if (checkIsModeAICC()) {
      extraHeaders[ClientEncryptInfoHeader] = e2eeClient.getEncryptInfo();
    }

    // Store keyNonce for later stream decryption
    this.keyNonceMap.set(requestId, keyNonce);

    // Deep copy and encrypt
    const requestCopy = deepCopyRequest(request);
    encryptChatRequest(keyNonce, requestCopy);

    return { body: requestCopy, extraHeaders };
  }

  // ─── Responses file preprocessing ──────────────────────────────
  private async preprocessResponseInput(input: ResponsesInput | undefined): Promise<void> {
    if (!input || typeof input === "string" || !Array.isArray(input)) return;
    await this.preprocessResponseMultiModal(input);
  }

  private async preprocessResponseMultiModal(inputItems: InputItem[]): Promise<void> {
    const tasks: Promise<void>[] = [];

    for (const item of inputItems) {
      if (!item || item.type !== "message" && !("role" in item && "content" in item)) continue;
      const inputMessage = item as { content?: ContentItem[] };
      if (!inputMessage.content || !Array.isArray(inputMessage.content)) continue;

      for (const contentItem of inputMessage.content) {
        const fileUrl = this.getMultiModalFileUrl(contentItem);
        if (!fileUrl) continue;

        tasks.push(this.preprocessResponseFile(contentItem, fileUrl));
      }
    }

    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  }

  private getMultiModalFileUrl(contentItem: ContentItem): string | null {
    if (contentItem.type === "input_video") {
      const video = contentItem as ContentItemVideo;
      if (video.video_url) return video.video_url;
    } else if (contentItem.type === "input_image") {
      const image = contentItem as ContentItemImage;
      if (image.image_url) return image.image_url;
    } else if (contentItem.type === "input_file") {
      const file = contentItem as ContentItemFile;
      if (file.file_url) return file.file_url;
    }
    return null;
  }

  private parseFileUrl(rawUrl: string): string | null {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== `${FILE_SCHEME}:`) return null;
      return parsed.pathname;
    } catch {
      return null;
    }
  }

  private async preprocessResponseFile(contentItem: ContentItem, rawUrl: string): Promise<void> {
    const localPath = this.parseFileUrl(rawUrl);
    if (!localPath) return;

    const fileStream = fs.createReadStream(localPath);
    try {
      // Upload file
      let fileMeta = await this.uploadFile({
        file: fileStream as any,
        purpose: PurposeUserData,
      });

      // Poll until processed (with timeout)
      const deadline = Date.now() + MAX_WAIT_TIME_MS;
      while (fileMeta.status === FileStatusProcessing && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        fileMeta = await this.retrieveFile(fileMeta.id);
      }

      // Replace URL with file_id
      if (contentItem.type === "input_video") {
        const video = contentItem as ContentItemVideo;
        video.video_url = "";
        video.file_id = fileMeta.id;
      } else if (contentItem.type === "input_image") {
        const image = contentItem as ContentItemImage;
        delete image.image_url;
        image.file_id = fileMeta.id;
      } else if (contentItem.type === "input_file") {
        const file = contentItem as ContentItemFile;
        delete file.file_url;
        file.file_id = fileMeta.id;
      }
    } finally {
      fileStream.destroy();
    }
  }

  private async doRequest<T>(
    method: string,
    url: string,
    resourceType: string,
    resourceId: string,
    opts?: RequestOptions & { body?: unknown },
  ): Promise<T> {
    return retry(
      this.retryPolicy(),
      async () => {
        const resp = await this.executeRequest<T>(
          method,
          url,
          resourceType,
          resourceId,
          opts,
        );
        return resp.data;
      },
      (err) => this.isRetryable(err),
      opts?.signal,
    );
  }

  private async doStreamRequest(
    method: string,
    url: string,
    resourceType: string,
    resourceId: string,
    opts?: RequestOptions & { body?: unknown },
  ): Promise<{ stream: NodeJS.ReadableStream; headers: Record<string, string> }> {
    const resp = await retry(
      this.retryPolicy(),
      async () => {
        return this.executeRequest<NodeJS.ReadableStream>(
          method,
          url,
          resourceType,
          resourceId,
          { ...opts, stream: true },
        );
      },
      (err) => this.isRetryable(err),
      opts?.signal,
    );

    const headers: Record<string, string> = {};
    if (resp.headers) {
      for (const [k, v] of Object.entries(resp.headers)) {
        if (typeof v === "string") headers[k] = v;
      }
    }
    return { stream: resp.data, headers };
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API METHODS
  // ═══════════════════════════════════════════════════════════════

  // ─── Chat Completions ─────────────────────────────────────────
  async createChatCompletion(
    request: ChatCompletionRequest,
    opts?: RequestOptions,
  ): Promise<ChatCompletionResponse> {
    if (request.stream) throw ErrChatCompletionStreamNotSupported;
    const resp = await this.doRequest<ChatCompletionResponse>(
      "POST",
      this.fullURL(chatCompletionsSuffix),
      resourceTypeEndpoint,
      request.model,
      { ...opts, body: request },
    );
    return normalizeChatCompletionResponse(resp);
  }

  async createChatCompletionStream(
    request: ChatCompletionRequest,
    opts?: RequestOptions,
  ): Promise<ChatCompletionStreamReader> {
    let body: ChatCompletionRequest = { ...request, stream: true };
    let extraHeaders: Record<string, string> | undefined;

    // E2EE: encrypt if x-is-encrypted header is set and request is streaming
    const isEncrypted = opts?.customHeaders?.[ClientIsEncryptedHeader] === "true";
    const requestId = genRequestId();
    if (isEncrypted) {
      const authHeader = await this.getAuthHeader(
        resourceTypeEndpoint,
        request.model,
        opts?.projectName,
      );
      const result = await this.encryptRequestBody(
        request.model,
        requestId,
        authHeader.Authorization,
        body,
      );
      body = result.body;
      extraHeaders = result.extraHeaders;
    }

    const mergedOpts = {
      ...opts,
      body,
      customHeaders: { ...opts?.customHeaders, ...extraHeaders },
    };
    const { stream, headers } = await this.doStreamRequest(
      "POST",
      this.fullURL(chatCompletionsSuffix),
      resourceTypeEndpoint,
      request.model,
      mergedOpts,
    );

    // Retrieve keyNonce for stream decryption (use local requestId to match encryptRequestBody's store key)
    const keyNonce = this.keyNonceMap.get(requestId);
    const cleanup = keyNonce
      ? () => { this.keyNonceMap.delete(requestId); }
      : undefined;

    return new ChatCompletionStreamReader(
      stream,
      this.config.emptyMessagesLimit,
      headers,
      keyNonce,
      cleanup,
    );
  }

  // ─── Bot Chat Completions ─────────────────────────────────────
  async createBotChatCompletion(
    request: BotChatCompletionRequest,
    opts?: RequestOptions,
  ): Promise<BotChatCompletionResponse> {
    if (request.stream) throw ErrChatCompletionStreamNotSupported;
    const model = request.bot_id || request.model;
    const resp = await this.doRequest<BotChatCompletionResponse>(
      "POST",
      this.fullURL(botChatCompletionsSuffix),
      resourceTypeBot,
      model,
      { ...opts, body: { ...request, model } },
    );
    return normalizeChatCompletionResponse(resp as any) as any;
  }

  async createBotChatCompletionStream(
    request: BotChatCompletionRequest,
    opts?: RequestOptions,
  ): Promise<BotChatCompletionStreamReader> {
    const model = request.bot_id || request.model;
    const body = { ...request, model, stream: true };
    const { stream, headers } = await this.doStreamRequest(
      "POST",
      this.fullURL(botChatCompletionsSuffix),
      resourceTypeBot,
      model,
      { ...opts, body },
    );
    return new BotChatCompletionStreamReader(
      stream,
      this.config.emptyMessagesLimit,
      headers,
    );
  }

  // ─── Embeddings ───────────────────────────────────────────────
  async createEmbeddings(
    request: EmbeddingRequest,
    opts?: RequestOptions,
  ): Promise<EmbeddingResponse> {
    const resp = await this.doRequest<EmbeddingResponse>(
      "POST",
      this.fullURL(embeddingsSuffix),
      resourceTypeEndpoint,
      request.model,
      { ...opts, body: request },
    );
    return normalizeEmbeddingResponse(resp);
  }

  async createMultiModalEmbeddings(
    request: MultiModalEmbeddingRequest,
    opts?: RequestOptions,
  ): Promise<MultimodalEmbeddingResponse> {
    return this.doRequest<MultimodalEmbeddingResponse>(
      "POST",
      this.fullURL(multimodalEmbeddingsSuffix),
      resourceTypeEndpoint,
      request.model,
      { ...opts, body: request },
    );
  }

  // ─── Images ───────────────────────────────────────────────────
  async generateImages(
    request: GenerateImagesRequest,
    opts?: RequestOptions,
  ): Promise<ImagesResponse> {
    if (!this.isAPIKeyAuth()) throw ErrAKSKNotSupported;
    return this.doRequest<ImagesResponse>(
      "POST",
      this.fullURL(generateImagesPath),
      resourceTypeEndpoint,
      request.model,
      { ...opts, body: request },
    );
  }

  async generateImagesStream(
    request: GenerateImagesRequest,
    opts?: RequestOptions,
  ): Promise<ImageGenerationStreamReader> {
    if (!this.isAPIKeyAuth()) throw ErrAKSKNotSupported;
    const body = { ...request, stream: true };
    const { stream, headers } = await this.doStreamRequest(
      "POST",
      this.fullURL(generateImagesPath),
      resourceTypeEndpoint,
      request.model,
      { ...opts, body },
    );
    return new ImageGenerationStreamReader(
      stream,
      this.config.emptyMessagesLimit,
      headers,
    );
  }

  // ─── Tokenization ─────────────────────────────────────────────
  async createTokenization(
    request: TokenizationRequest,
    opts?: RequestOptions,
  ): Promise<TokenizationResponse> {
    return this.doRequest<TokenizationResponse>(
      "POST",
      this.fullURL(tokenizationSuffix),
      resourceTypeEndpoint,
      request.model,
      { ...opts, body: request },
    );
  }

  // ─── Context ──────────────────────────────────────────────────
  async createContext(
    request: CreateContextRequest,
    opts?: RequestOptions,
  ): Promise<CreateContextResponse> {
    return this.doRequest<CreateContextResponse>(
      "POST",
      this.fullURL(contextCreateSuffix),
      resourceTypeEndpoint,
      request.model,
      { ...opts, body: request },
    );
  }

  async createContextChatCompletion(
    request: ContextChatCompletionRequest,
    opts?: RequestOptions,
  ): Promise<ChatCompletionResponse> {
    if (request.stream) throw ErrChatCompletionStreamNotSupported;
    const resp = await this.doRequest<ChatCompletionResponse>(
      "POST",
      this.fullURL(contextChatSuffix),
      resourceTypeEndpoint,
      request.model,
      { ...opts, body: request },
    );
    return normalizeChatCompletionResponse(resp);
  }

  async createContextChatCompletionStream(
    request: ContextChatCompletionRequest,
    opts?: RequestOptions,
  ): Promise<ChatCompletionStreamReader> {
    const body = { ...request, stream: true };
    const { stream, headers } = await this.doStreamRequest(
      "POST",
      this.fullURL(contextChatSuffix),
      resourceTypeEndpoint,
      request.model,
      { ...opts, body },
    );
    return new ChatCompletionStreamReader(
      stream,
      this.config.emptyMessagesLimit,
      headers,
    );
  }

  // ─── Content Generation ───────────────────────────────────────
  async createContentGenerationTask(
    request: CreateContentGenerationTaskRequest,
    opts?: RequestOptions,
  ): Promise<CreateContentGenerationTaskResponse> {
    if (!this.isAPIKeyAuth()) throw ErrAKSKNotSupported;
    return this.doRequest<CreateContentGenerationTaskResponse>(
      "POST",
      this.fullURL(contentGenerationTaskPath),
      resourceTypeEndpoint,
      request.model,
      { ...opts, body: request },
    );
  }

  async getContentGenerationTask(
    taskId: string,
    opts?: RequestOptions,
  ): Promise<GetContentGenerationTaskResponse> {
    if (!this.isAPIKeyAuth()) throw ErrAKSKNotSupported;
    return this.doRequest<GetContentGenerationTaskResponse>(
      "GET",
      `${this.fullURL(contentGenerationTaskPath)}/${taskId}`,
      resourceTypeEndpoint,
      "",
      opts,
    );
  }

  async deleteContentGenerationTask(
    taskId: string,
    opts?: RequestOptions,
  ): Promise<void> {
    if (!this.isAPIKeyAuth()) throw ErrAKSKNotSupported;
    await this.doRequest<void>(
      "DELETE",
      `${this.fullURL(contentGenerationTaskPath)}/${taskId}`,
      resourceTypeEndpoint,
      "",
      opts,
    );
  }

  async listContentGenerationTasks(
    request: ListContentGenerationTasksRequest,
    opts?: RequestOptions,
  ): Promise<ListContentGenerationTasksResponse> {
    if (!this.isAPIKeyAuth()) throw ErrAKSKNotSupported;
    const query: Record<string, string | string[]> = {};
    if (request.page_num != null) query.page_num = String(request.page_num);
    if (request.page_size != null) query.page_size = String(request.page_size);
    if (request.filter) {
      if (request.filter.status) query["filter.status"] = request.filter.status;
      if (request.filter.model) query["filter.model"] = request.filter.model;
      if (request.filter.service_tier)
        query["filter.service_tier"] = request.filter.service_tier;
      if (request.filter.task_ids?.length) {
        query["filter.task_ids"] = request.filter.task_ids;
      }
    }
    return this.doRequest<ListContentGenerationTasksResponse>(
      "GET",
      this.fullURL(contentGenerationTaskPath),
      resourceTypeEndpoint,
      "",
      { ...opts, query: query as any },
    );
  }

  // ─── Responses ────────────────────────────────────────────────
  async createResponses(
    body: ResponsesRequest,
    opts?: RequestOptions,
  ): Promise<Record<string, unknown>> {
    // Preprocess input multi modal files (matches Go)
    await this.preprocessResponseInput(body.input);
    return this.doRequest<Record<string, unknown>>(
      "POST",
      this.fullURL("/responses"),
      resourceTypeEndpoint,
      body.model,
      { ...opts, body },
    );
  }

  async createResponsesStream(
    body: ResponsesRequest,
    opts?: RequestOptions,
  ): Promise<ResponsesStreamReader> {
    // Preprocess input multi modal files (matches Go)
    await this.preprocessResponseInput(body.input);
    const streamBody = { ...body, stream: true };
    const { stream, headers } = await this.doStreamRequest(
      "POST",
      this.fullURL("/responses"),
      resourceTypeEndpoint,
      body.model,
      { ...opts, body: streamBody },
    );
    return new ResponsesStreamReader(
      stream,
      this.config.emptyMessagesLimit,
      headers,
    );
  }

  async getResponses(
    responseId: string,
    query?: Record<string, unknown>,
    opts?: RequestOptions,
  ): Promise<Record<string, unknown>> {
    if (!responseId) throw new Error("missing required response_id parameter");
    return this.doRequest<Record<string, unknown>>(
      "GET",
      this.fullURL(`/responses/${responseId}`),
      "",
      "",
      { ...opts, query: query as any },
    );
  }

  async deleteResponse(
    responseId: string,
    opts?: RequestOptions,
  ): Promise<void> {
    if (!responseId) throw new Error("missing required response_id parameter");
    await this.doRequest<void>(
      "DELETE",
      this.fullURL(`/responses/${responseId}`),
      "",
      "",
      opts,
    );
  }

  async listResponseInputItems(
    responseId: string,
    query?: Record<string, unknown>,
    opts?: RequestOptions,
  ): Promise<Record<string, unknown>> {
    if (!responseId) throw new Error("missing required response_id parameter");
    return this.doRequest<Record<string, unknown>>(
      "GET",
      this.fullURL(`/responses/${responseId}/input_items`),
      "",
      "",
      { ...opts, query: query as any },
    );
  }

  // ─── Files ────────────────────────────────────────────────────
  async uploadFile(
    request: UploadFileRequest,
    opts?: RequestOptions,
  ): Promise<FileMeta> {
    // File upload uses FormData, not JSON
    const formData = new FormData();
    formData.append("file", request.file as any);
    formData.append("purpose", request.purpose);
    if (request.preprocess_configs) {
      formData.append(
        "preprocess_configs",
        JSON.stringify(request.preprocess_configs),
      );
    }
    if (request.expire_at != null) {
      formData.append("expire_at", String(request.expire_at));
    }

    const authHeader = await this.getAuthHeader("", "");
    const requestId = genRequestId();
    const resp = await this.httpClient.request<FileMeta>({
      method: "POST",
      url: this.fullURL(filePrefix),
      headers: {
        [ClientRequestHeader]: requestId,
        ...authHeader,
        ...opts?.customHeaders,
      },
      data: formData,
      signal: opts?.signal,
      validateStatus: () => true,
    });

    if (resp.status < 200 || resp.status >= 400) {
      this.handleErrorResponse(resp, requestId);
    }
    return resp.data;
  }

  async retrieveFile(
    fileId: string,
    opts?: RequestOptions,
  ): Promise<FileMeta> {
    if (!fileId) throw new Error("missing required file_id parameter");
    return this.doRequest<FileMeta>(
      "GET",
      this.fullURL(`${filePrefix}/${fileId}`),
      "",
      "",
      opts,
    );
  }

  async listFiles(
    request?: ListFilesRequest,
    opts?: RequestOptions,
  ): Promise<ListFilesResponse> {
    const query: Record<string, string> = {};
    if (request?.purpose) query.purpose = request.purpose;
    if (request?.after) query.after = request.after;
    if (request?.limit != null) query.limit = String(request.limit);
    if (request?.order) query.order = request.order;
    return this.doRequest<ListFilesResponse>(
      "GET",
      this.fullURL(filePrefix),
      "",
      "",
      { ...opts, query },
    );
  }

  async deleteFile(
    fileId: string,
    opts?: RequestOptions,
  ): Promise<DeleteFileResponse> {
    if (!fileId) throw new Error("missing required file_id parameter");
    return this.doRequest<DeleteFileResponse>(
      "DELETE",
      this.fullURL(`${filePrefix}/${fileId}`),
      "",
      "",
      opts,
    );
  }

  // ─── Batch ────────────────────────────────────────────────────
  async createBatchChatCompletion(
    request: ChatCompletionRequest,
    opts?: RequestOptions,
  ): Promise<ChatCompletionResponse> {
    if (request.stream) throw ErrChatCompletionStreamNotSupported;
    const breaker = this.modelBreakerProvider.getOrCreate(request.model);
    await breaker.wait();
    const resp = await this.doRequest<ChatCompletionResponse>(
      "POST",
      this.fullURL(batchChatCompletionsSuffix),
      resourceTypeEndpoint,
      request.model,
      { ...opts, body: request },
    );
    return normalizeChatCompletionResponse(resp);
  }

  async createBatchEmbeddings(
    request: EmbeddingRequest,
    opts?: RequestOptions,
  ): Promise<EmbeddingResponse> {
    const breaker = this.modelBreakerProvider.getOrCreate(request.model);
    await breaker.wait();
    const resp = await this.doRequest<EmbeddingResponse>(
      "POST",
      this.fullURL(batchEmbeddingsSuffix),
      resourceTypeEndpoint,
      request.model,
      { ...opts, body: request },
    );
    return normalizeEmbeddingResponse(resp);
  }

  async createBatchMultiModalEmbeddings(
    request: MultiModalEmbeddingRequest,
    opts?: RequestOptions,
  ): Promise<MultimodalEmbeddingResponse> {
    const breaker = this.modelBreakerProvider.getOrCreate(request.model);
    await breaker.wait();
    return this.doRequest<MultimodalEmbeddingResponse>(
      "POST",
      this.fullURL(batchMultiModalEmbeddingsSuffix),
      resourceTypeEndpoint,
      request.model,
      { ...opts, body: request },
    );
  }
}
