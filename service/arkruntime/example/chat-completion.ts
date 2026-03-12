/**
 * 基础对话补全示例
 * Basic chat completion example (non-streaming + streaming)
 *
 * 对齐 Go SDK: example/completion/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

// 使用 API Key 鉴权
const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);

// 也可以使用 AK/SK 鉴权（会自动获取 STS token）
// const client = ArkRuntimeClient.withAkSk(
//   process.env.VOLC_ACCESSKEY!,
//   process.env.VOLC_SECRETKEY!,
// );

const MODEL = "doubao-seed-2-0-pro-260215";

async function chatCompletion() {
  console.log("----- 非流式对话 -----");

  const response = await client.createChatCompletion({
    model: MODEL,
    messages: [
      { role: "system", content: "你是一个有帮助的AI助手。" },
      { role: "user", content: "请介绍一下北京的天气特点" },
    ],
  });

  console.log("Response ID:", response.id);
  console.log("Model:", response.model);
  console.log("Content:", response.choices[0].message.content);
  console.log("Usage:", JSON.stringify(response.usage));
}

async function chatCompletionStream() {
  console.log("\n----- 流式对话 -----");

  const stream = await client.createChatCompletionStream({
    model: MODEL,
    messages: [
      { role: "system", content: "你是一个有帮助的AI助手。" },
      { role: "user", content: "请介绍一下北京的天气特点" },
    ],
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
  await chatCompletion();
  await chatCompletionStream();
}

main().catch(console.error);
