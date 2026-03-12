/**
 * End-to-end tests against real Ark API.
 * Run with: ARK_E2E=1 npx jest --testPathPattern=e2e
 */

const API_KEY = "your-api-key";
const MODEL = "doubao-seed-2-0-pro-260215";

// Skip if not in E2E mode
const describeE2E = process.env.ARK_E2E ? describe : describe.skip;

import { ArkRuntimeClient } from "../src/client";
import type { ChatCompletionResponse } from "../src/types/chat-completion";

describeE2E("E2E: Chat Completions", () => {
  let client: ArkRuntimeClient;

  beforeAll(() => {
    client = ArkRuntimeClient.withApiKey(API_KEY);
  });

  it("should create a chat completion", async () => {
    const response = await client.createChatCompletion({
      model: MODEL,
      messages: [{ role: "user", content: "请回答1+1等于几，只回答数字" }],
    });

    expect(response).toBeDefined();
    expect(response.id).toBeTruthy();
    expect(response.choices).toBeDefined();
    expect(response.choices.length).toBeGreaterThan(0);
    expect(response.choices[0].message).toBeDefined();
    expect(response.choices[0].message.content).toBeTruthy();
    console.log("[Chat] Response:", response.choices[0].message.content);
  }, 30000);

  it("should stream a chat completion", async () => {
    const stream = await client.createChatCompletionStream({
      model: MODEL,
      messages: [{ role: "user", content: "请回答1+1等于几，只回答数字" }],
    });

    const chunks: string[] = [];
    for await (const chunk of stream) {
      expect(chunk).toBeDefined();
      expect(chunk.id).toBeTruthy();
      if (chunk.choices?.[0]?.delta?.content) {
        chunks.push(chunk.choices[0].delta.content);
      }
    }

    const fullContent = chunks.join("");
    expect(fullContent).toBeTruthy();
    console.log("[Stream] Full response:", fullContent);
  }, 30000);

  it("should handle multi-turn conversation", async () => {
    const response = await client.createChatCompletion({
      model: MODEL,
      messages: [
        { role: "system", content: "你是一个数学助手，只回答数字" },
        { role: "user", content: "1+1=" },
        { role: "assistant", content: "2" },
        { role: "user", content: "再加3等于几？" },
      ],
    });

    expect(response.choices.length).toBeGreaterThan(0);
    const content = response.choices[0].message.content;
    expect(content).toBeTruthy();
    console.log("[MultiTurn] Response:", content);
  }, 30000);
});

describeE2E("E2E: Tokenization", () => {
  let client: ArkRuntimeClient;

  beforeAll(() => {
    client = ArkRuntimeClient.withApiKey(API_KEY);
  });

  it("should tokenize text", async () => {
    const response = await client.createTokenization({
      model: MODEL,
      text: "hello world",
    });

    expect(response).toBeDefined();
    expect(response.data).toBeDefined();
    expect(response.data.length).toBeGreaterThan(0);
    expect(response.data[0].total_tokens).toBeGreaterThan(0);
    console.log("[Tokenization] Token count:", response.data[0].total_tokens);
  }, 30000);
});
