/**
 * 多模态/视觉对话示例
 * 对齐 Go SDK: example/completion_vision/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

async function visionChat() {
  console.log("----- 视觉对话 -----");

  const response = await client.createChatCompletion({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "这张图片里有什么？" },
          {
            type: "image_url",
            image_url: {
              url: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png",
            },
          },
        ],
      },
    ],
  });

  console.log("Response:", response.choices[0].message.content);
}

async function visionChatStream() {
  console.log("\n----- 视觉流式对话 -----");

  const stream = await client.createChatCompletionStream({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "详细描述这张图片" },
          {
            type: "image_url",
            image_url: {
              url: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png",
              detail: "high",
            },
          },
        ],
      },
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
  await visionChat();
  await visionChatStream();
}

main().catch(console.error);
