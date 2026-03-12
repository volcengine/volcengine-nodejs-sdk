import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { ArkRuntimeClient } from "../src/client";
import { ArkAPIError, ArkRequestError } from "../src/types/error";

// Mock the @volcengine/ark module to prevent dynamic import issues in tests
jest.mock("@volcengine/ark", () => ({
  ARKClient: jest.fn(),
  GetApiKeyCommand: jest.fn(),
}));

describe("ArkRuntimeClient", () => {
  let mock: MockAdapter;
  let client: ArkRuntimeClient;
  const baseURL = "https://ark.cn-beijing.volces.com/api/v3";

  beforeEach(() => {
    client = ArkRuntimeClient.withApiKey("test-api-key");
    // Access internal httpClient to mock it
    const httpClient = (client as any).httpClient;
    mock = new MockAdapter(httpClient);
  });

  afterEach(() => {
    mock.restore();
  });

  describe("factory methods", () => {
    it("should create with API key", () => {
      const c = ArkRuntimeClient.withApiKey("key123");
      expect(c).toBeInstanceOf(ArkRuntimeClient);
    });

    it("should create with AK/SK", () => {
      const c = ArkRuntimeClient.withAkSk("ak", "sk");
      expect(c).toBeInstanceOf(ArkRuntimeClient);
    });

    it("should create with constructor", () => {
      const c = new ArkRuntimeClient({ apiKey: "key123" });
      expect(c).toBeInstanceOf(ArkRuntimeClient);
    });
  });

  describe("createChatCompletion", () => {
    it("should make a POST request and return response", async () => {
      const mockResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "test-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hello!" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 3,
          total_tokens: 8,
        },
      };

      mock.onPost(`${baseURL}/chat/completions`).reply(200, mockResponse);

      const result = await client.createChatCompletion({
        model: "test-model",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result.id).toBe("chatcmpl-123");
      expect(result.choices[0].message.content).toBe("Hello!");
    });

    it("should throw when stream is true", async () => {
      await expect(
        client.createChatCompletion({
          model: "test-model",
          messages: [{ role: "user", content: "Hi" }],
          stream: true,
        }),
      ).rejects.toThrow();
    });

    it("should handle API errors", async () => {
      mock.onPost(`${baseURL}/chat/completions`).reply(400, {
        error: {
          message: "Invalid model",
          type: "invalid_request_error",
          code: "model_not_found",
        },
      });

      await expect(
        client.createChatCompletion({
          model: "bad-model",
          messages: [{ role: "user", content: "Hi" }],
        }),
      ).rejects.toThrow(ArkAPIError);
    });

    it("should handle 500 errors as ArkRequestError", async () => {
      mock.onPost(`${baseURL}/chat/completions`).reply(500, "Internal Server Error");

      await expect(
        client.createChatCompletion({
          model: "test-model",
          messages: [{ role: "user", content: "Hi" }],
        }),
      ).rejects.toThrow();
    });
  });

  describe("createEmbeddings", () => {
    it("should create embeddings", async () => {
      const mockResponse = {
        object: "list",
        data: [
          {
            object: "embedding",
            embedding: [0.1, 0.2, 0.3],
            index: 0,
          },
        ],
        model: "test-embed",
        usage: { prompt_tokens: 5, total_tokens: 5 },
      };

      mock.onPost(`${baseURL}/embeddings`).reply(200, mockResponse);

      const result = await client.createEmbeddings({
        model: "test-embed",
        input: ["hello"],
      });

      expect(result.data[0].embedding).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe("generateImages", () => {
    it("should generate images (API key auth only)", async () => {
      const mockResponse = {
        created: 1234567890,
        data: [{ b64_json: "abc123" }],
      };

      mock.onPost(`${baseURL}/images/generations`).reply(200, mockResponse);

      const result = await client.generateImages({
        model: "test-image-model",
        prompt: "a cat",
      });

      expect(result.data[0].b64_json).toBe("abc123");
    });

    it("should reject AK/SK auth for image generation", async () => {
      const akskClient = ArkRuntimeClient.withAkSk("ak", "sk");
      await expect(
        akskClient.generateImages({
          model: "test-image-model",
          prompt: "a cat",
        }),
      ).rejects.toThrow();
    });
  });

  describe("createTokenization", () => {
    it("should create tokenization", async () => {
      const mockResponse = {
        id: "tok-123",
        created: 1234567890,
        model: "test-model",
        object: "list",
        data: [
          {
            index: 0,
            object: "tokenization",
            total_tokens: 3,
            token_ids: [123, 456, 789],
            offset_mapping: [],
          },
        ],
      };

      mock.onPost(`${baseURL}/tokenization`).reply(200, mockResponse);

      const result = await client.createTokenization({
        model: "test-model",
        text: "hello world",
      });

      expect(result.data[0].token_ids).toEqual([123, 456, 789]);
    });
  });

  describe("files", () => {
    it("should retrieve a file", async () => {
      const mockFile = {
        object: "file",
        id: "file-123",
        purpose: "user_data",
        filename: "test.txt",
        created_at: 1234567890,
        expire_at: 9999999999,
        status: "active",
      };

      mock.onGet(`${baseURL}/files/file-123`).reply(200, mockFile);

      const result = await client.retrieveFile("file-123");
      expect(result.id).toBe("file-123");
      expect(result.status).toBe("active");
    });

    it("should list files", async () => {
      const mockResponse = {
        object: "list",
        data: [],
        first_id: "",
        last_id: "",
        has_more: false,
      };

      mock.onGet(`${baseURL}/files`).reply(200, mockResponse);

      const result = await client.listFiles();
      expect(result.object).toBe("list");
    });

    it("should delete a file", async () => {
      const mockResponse = {
        object: "file",
        id: "file-123",
        deleted: true,
      };

      mock.onDelete(`${baseURL}/files/file-123`).reply(200, mockResponse);

      const result = await client.deleteFile("file-123");
      expect(result.deleted).toBe(true);
    });
  });

  describe("responses", () => {
    it("should create responses", async () => {
      const mockResponse = {
        id: "resp-123",
        object: "response",
        status: "completed",
        output: [],
      };

      mock.onPost(`${baseURL}/responses`).reply(200, mockResponse);

      const result = await client.createResponses({
        model: "test-model",
        input: "What is 2+2?",
      });

      expect(result.id).toBe("resp-123");
    });

    it("should get responses", async () => {
      const mockResponse = {
        id: "resp-123",
        object: "response",
        status: "completed",
      };

      mock.onGet(`${baseURL}/responses/resp-123`).reply(200, mockResponse);

      const result = await client.getResponses("resp-123");
      expect(result.id).toBe("resp-123");
    });

    it("should delete response", async () => {
      mock.onDelete(`${baseURL}/responses/resp-123`).reply(200, undefined);
      await expect(client.deleteResponse("resp-123")).resolves.not.toThrow();
    });

    it("should throw for empty response ID", async () => {
      await expect(client.getResponses("")).rejects.toThrow("missing required response_id");
      await expect(client.deleteResponse("")).rejects.toThrow("missing required response_id");
      await expect(client.listResponseInputItems("")).rejects.toThrow("missing required response_id");
    });
  });

  describe("batch methods", () => {
    it("should create batch chat completion with breaker", async () => {
      const mockResponse = {
        id: "chatcmpl-batch-123",
        object: "chat.completion",
        created: 1234567890,
        model: "test-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hello!" },
            finish_reason: "stop",
          },
        ],
      };

      mock.onPost(`${baseURL}/batch/chat/completions`).reply(200, mockResponse);

      const result = await client.createBatchChatCompletion({
        model: "test-model",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result.id).toBe("chatcmpl-batch-123");
    });
  });

  describe("custom headers and options", () => {
    it("should pass custom headers", async () => {
      const mockResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "test-model",
        choices: [],
      };

      mock.onPost(`${baseURL}/chat/completions`).reply((config) => {
        expect(config.headers!["X-Custom"]).toBe("value");
        return [200, mockResponse];
      });

      await client.createChatCompletion(
        {
          model: "test-model",
          messages: [{ role: "user", content: "Hi" }],
        },
        { customHeaders: { "X-Custom": "value" } },
      );
    });

    it("should set project name header", async () => {
      const mockResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1234567890,
        model: "test-model",
        choices: [],
      };

      mock.onPost(`${baseURL}/chat/completions`).reply((config) => {
        expect(config.headers!["X-Project-Name"]).toBe("my-project");
        return [200, mockResponse];
      });

      await client.createChatCompletion(
        {
          model: "test-model",
          messages: [{ role: "user", content: "Hi" }],
        },
        { projectName: "my-project" },
      );
    });
  });

  describe("error handling", () => {
    it("should parse API error response", async () => {
      mock.onPost(`${baseURL}/chat/completions`).reply(400, {
        error: {
          message: "Invalid request",
          type: "invalid_request_error",
          code: "invalid_model",
          param: "model",
          request_id: "req-123",
        },
      });

      try {
        await client.createChatCompletion({
          model: "bad-model",
          messages: [{ role: "user", content: "Hi" }],
        });
        fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ArkAPIError);
        const apiErr = err as ArkAPIError;
        expect(apiErr.message).toBe("Invalid request");
        expect(apiErr.type).toBe("invalid_request_error");
        expect(apiErr.code).toBe("invalid_model");
        expect(apiErr.param).toBe("model");
        expect(apiErr.httpStatusCode).toBe(400);
        expect(apiErr.requestId).toBe("req-123");
      }
    });

    it("should handle non-JSON error responses", async () => {
      mock.onPost(`${baseURL}/chat/completions`).reply(502, "Bad Gateway");

      try {
        await client.createChatCompletion({
          model: "test-model",
          messages: [{ role: "user", content: "Hi" }],
        });
        fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ArkRequestError);
        const reqErr = err as ArkRequestError;
        expect(reqErr.httpStatusCode).toBe(502);
      }
    });
  });
});
