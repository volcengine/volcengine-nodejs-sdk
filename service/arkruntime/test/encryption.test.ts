import * as crypto from "crypto";
import {
  aesGcmEncrypt,
  aesGcmDecrypt,
  aesGcmEncryptBase64,
  aesGcmDecryptBase64,
  getCertInfo,
  checkIsModeAICC,
} from "../src/encryption/key-agreement";
import {
  encryptChatRequest,
  decryptChatResponse,
  decryptChatStreamResponse,
  deepCopyRequest,
} from "../src/encryption/encrypt-chat";
import type { ChatCompletionRequest, ChatCompletionResponse, ChatCompletionStreamResponse } from "../src/types/chat-completion";

describe("AES-GCM encryption", () => {
  const key = crypto.randomBytes(32);
  const nonce = crypto.randomBytes(12);

  it("should encrypt and decrypt binary data", () => {
    const plaintext = Buffer.from("Hello, World!");
    const ciphertext = aesGcmEncrypt(key, nonce, plaintext);
    expect(ciphertext).not.toEqual(plaintext);
    expect(ciphertext.length).toBeGreaterThan(plaintext.length); // includes auth tag

    const decrypted = aesGcmDecrypt(key, nonce, ciphertext);
    expect(decrypted).toEqual(plaintext);
  });

  it("should encrypt and decrypt base64 strings", () => {
    const plaintext = "This is a test message for encryption.";
    const encrypted = aesGcmEncryptBase64(key, nonce, plaintext);
    expect(typeof encrypted).toBe("string");
    // Should be valid base64
    expect(Buffer.from(encrypted, "base64").toString("base64")).toBe(encrypted);

    const decrypted = aesGcmDecryptBase64(key, nonce, encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should handle empty string", () => {
    const encrypted = aesGcmEncryptBase64(key, nonce, "");
    const decrypted = aesGcmDecryptBase64(key, nonce, encrypted);
    expect(decrypted).toBe("");
  });

  it("should handle UTF-8 multibyte characters", () => {
    const plaintext = "你好世界 🌍";
    const encrypted = aesGcmEncryptBase64(key, nonce, plaintext);
    const decrypted = aesGcmDecryptBase64(key, nonce, encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should fail with wrong key", () => {
    const plaintext = "secret message";
    const encrypted = aesGcmEncryptBase64(key, nonce, plaintext);
    const wrongKey = crypto.randomBytes(32);
    expect(() => aesGcmDecryptBase64(wrongKey, nonce, encrypted)).toThrow();
  });

  it("should fail with wrong nonce", () => {
    const plaintext = "secret message";
    const encrypted = aesGcmEncryptBase64(key, nonce, plaintext);
    const wrongNonce = crypto.randomBytes(12);
    expect(() => aesGcmDecryptBase64(key, wrongNonce, encrypted)).toThrow();
  });
});

describe("checkIsModeAICC", () => {
  const originalEnv = process.env.VOLC_ARK_ENCRYPTION;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.VOLC_ARK_ENCRYPTION;
    } else {
      process.env.VOLC_ARK_ENCRYPTION = originalEnv;
    }
  });

  it("should return true when VOLC_ARK_ENCRYPTION=AICC", () => {
    process.env.VOLC_ARK_ENCRYPTION = "AICC";
    expect(checkIsModeAICC()).toBe(true);
  });

  it("should return false when VOLC_ARK_ENCRYPTION is not AICC", () => {
    process.env.VOLC_ARK_ENCRYPTION = "other";
    expect(checkIsModeAICC()).toBe(false);
  });

  it("should return false when VOLC_ARK_ENCRYPTION is not set", () => {
    delete process.env.VOLC_ARK_ENCRYPTION;
    expect(checkIsModeAICC()).toBe(false);
  });
});

describe("getCertInfo", () => {
  it("should return empty for invalid PEM", () => {
    const result = getCertInfo("not a certificate");
    expect(result.ringId).toBe("");
    expect(result.keyId).toBe("");
    expect(result.expireTime).toBe(0);
  });
});

describe("deepCopyRequest", () => {
  it("should deep copy a request object", () => {
    const original: ChatCompletionRequest = {
      model: "test-model",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    };
    const copy = deepCopyRequest(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.messages).not.toBe(original.messages);
  });
});

describe("encryptChatRequest", () => {
  const keyNonce = Buffer.concat([
    crypto.randomBytes(32), // AES key
    crypto.randomBytes(12), // nonce
  ]);

  it("should encrypt string message content", () => {
    const request: ChatCompletionRequest = {
      model: "test-model",
      messages: [
        { role: "user", content: "Hello, please help me." },
      ],
    };
    const copy = deepCopyRequest(request);
    encryptChatRequest(keyNonce, copy);

    // Content should be encrypted (base64)
    expect(copy.messages![0].content).not.toBe("Hello, please help me.");
    expect(typeof copy.messages![0].content).toBe("string");
  });

  it("should encrypt multipart content text", () => {
    const request: ChatCompletionRequest = {
      model: "test-model",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image" },
            { type: "image_url", image_url: { url: "https://example.com/img.png" } },
          ],
        },
      ],
    };
    const copy = deepCopyRequest(request);
    encryptChatRequest(keyNonce, copy);

    const parts = copy.messages![0].content as any[];
    // Text should be encrypted
    expect(parts[0].text).not.toBe("Describe this image");
    // HTTPS URL should NOT be encrypted
    expect(parts[1].image_url.url).toBe("https://example.com/img.png");
  });

  it("should encrypt data: URIs in image_url", () => {
    const request: ChatCompletionRequest = {
      model: "test-model",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: "data:image/png;base64,abc123" } },
          ],
        },
      ],
    };
    const copy = deepCopyRequest(request);
    encryptChatRequest(keyNonce, copy);

    const parts = copy.messages![0].content as any[];
    // data: URI should be encrypted
    expect(parts[0].image_url.url).not.toBe("data:image/png;base64,abc123");
  });

  it("should reject invalid keyNonce length", () => {
    const request: ChatCompletionRequest = {
      model: "test-model",
      messages: [{ role: "user", content: "Hello" }],
    };
    expect(() => encryptChatRequest(Buffer.alloc(10), request)).toThrow(
      /keyNonce must be 44 bytes/,
    );
  });
});

describe("decryptChatResponse", () => {
  const key = crypto.randomBytes(32);
  const nonce = crypto.randomBytes(12);
  const keyNonce = Buffer.concat([key, nonce]);

  it("should decrypt response message content", () => {
    const plaintext = "This is the assistant's response.";
    const encrypted = aesGcmEncryptBase64(key, nonce, plaintext);

    const response: ChatCompletionResponse = {
      id: "test-id",
      object: "chat.completion",
      created: 123,
      model: "test-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: encrypted },
          finish_reason: "stop",
        },
      ],
    } as any;

    decryptChatResponse(keyNonce, response);
    expect((response.choices[0] as any).message.content).toBe(plaintext);
  });

  it("should skip content_filter choices", () => {
    const response: ChatCompletionResponse = {
      id: "test-id",
      object: "chat.completion",
      created: 123,
      model: "test-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "not-encrypted" },
          finish_reason: "content_filter",
        },
      ],
    } as any;

    decryptChatResponse(keyNonce, response);
    // Should not throw — content_filter choices are skipped
    expect((response.choices[0] as any).message.content).toBe("not-encrypted");
  });
});

describe("decryptChatStreamResponse", () => {
  const key = crypto.randomBytes(32);
  const nonce = crypto.randomBytes(12);
  const keyNonce = Buffer.concat([key, nonce]);

  it("should decrypt delta content in stream chunks", () => {
    const plaintext = "Hello";
    const encrypted = aesGcmEncryptBase64(key, nonce, plaintext);

    const streamResponse: ChatCompletionStreamResponse = {
      id: "test-id",
      object: "chat.completion.chunk",
      created: 123,
      model: "test-model",
      choices: [
        {
          index: 0,
          delta: { content: encrypted },
          finish_reason: null,
        },
      ],
    } as any;

    decryptChatStreamResponse(keyNonce, streamResponse);
    expect((streamResponse.choices[0] as any).delta.content).toBe(plaintext);
  });
});
