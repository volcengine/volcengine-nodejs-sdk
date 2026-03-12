/**
 * Context（上下文/会话管理）示例
 * 对齐 Go SDK: example/context/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

async function contextChat() {
  console.log("----- 创建 Context -----");

  // 创建一个持久化的上下文（session 模式），TTL=3600 秒
  const ctx = await client.createContext({
    model: MODEL,
    mode: "session",
    messages: [
      { role: "system", content: "你是一个数学助手，用简洁的方式回答问题。" },
    ],
    ttl: 3600,
  });

  console.log("Context ID:", ctx.id);
  console.log("Mode:", ctx.mode);
  console.log("Usage:", JSON.stringify(ctx.usage));

  // 第一轮对话
  console.log("\n----- 第一轮对话 -----");
  const resp1 = await client.createContextChatCompletion({
    model: MODEL,
    context_id: ctx.id,
    mode: "session",
    messages: [{ role: "user", content: "1+1等于几？" }],
  });
  console.log("Answer:", resp1.choices[0].message.content);

  // 第二轮对话（上下文自动保持）
  console.log("\n----- 第二轮对话 -----");
  const resp2 = await client.createContextChatCompletion({
    model: MODEL,
    context_id: ctx.id,
    mode: "session",
    messages: [{ role: "user", content: "再加3呢？" }],
  });
  console.log("Answer:", resp2.choices[0].message.content);

  // 流式上下文对话
  console.log("\n----- 流式上下文对话 -----");
  const stream = await client.createContextChatCompletionStream({
    model: MODEL,
    context_id: ctx.id,
    mode: "session",
    messages: [{ role: "user", content: "再乘以2呢？" }],
  });

  process.stdout.write("Streaming: ");
  for await (const chunk of stream) {
    if (chunk.choices?.[0]?.delta?.content) {
      process.stdout.write(chunk.choices[0].delta.content);
    }
  }
  console.log();
}

async function main() {
  await contextChat();
}

main().catch(console.error);
