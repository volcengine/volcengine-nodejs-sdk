/**
 * 推理 (Reasoning / Thinking) 模式示例
 * 对齐 Go SDK: example/completion_reasoning/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

async function reasoningStream() {
  console.log("----- 流式推理模式 -----");

  const stream = await client.createChatCompletionStream({
    model: MODEL,
    messages: [{ role: "user", content: "请解释为什么 0.1 + 0.2 !== 0.3 in JavaScript" }],
    thinking: { type: "enabled" },
  });

  let inReasoning = false;
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.reasoning_content) {
      if (!inReasoning) {
        console.log("[Reasoning]");
        inReasoning = true;
      }
      process.stdout.write(delta.reasoning_content);
    }

    if (delta.content) {
      if (inReasoning) {
        console.log("\n[Output]");
        inReasoning = false;
      }
      process.stdout.write(delta.content);
    }
  }
  console.log();
}

async function reasoningNonStream() {
  console.log("\n----- 非流式推理模式 -----");

  const response = await client.createChatCompletion({
    model: MODEL,
    messages: [{ role: "user", content: "计算 123 * 456 的结果" }],
    thinking: { type: "enabled" },
  });

  const msg = response.choices[0].message;
  if (msg.reasoning_content) {
    console.log("[Reasoning]:", msg.reasoning_content);
  }
  console.log("[Output]:", msg.content);
}

async function main() {
  await reasoningStream();
  await reasoningNonStream();
}

main().catch(console.error);
