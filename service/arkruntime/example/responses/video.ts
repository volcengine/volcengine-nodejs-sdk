/**
 * Responses API 视频理解示例
 * 对齐 Go SDK: example/responses/video/main.go
 *
 * 支持 file:// URL 自动上传：SDK 会自动上传本地文件并替换为 file_id
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";
import { getEventType, isDelta } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

async function videoUnderstanding() {
  console.log("----- 视频理解 (Responses API) -----");

  // 使用远程视频 URL
  const response = await client.createResponses({
    model: MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "描述这个视频的内容" },
          {
            type: "input_video",
            video_url: "https://example.com/sample-video.mp4",
          },
        ],
      } as any,
    ],
  });

  console.log("Response:", JSON.stringify(response, null, 2));
}

async function videoUnderstandingLocalFile() {
  console.log("\n----- 视频理解 (本地文件自动上传) -----");

  // 使用 file:// URL，SDK 会自动上传并替换为 file_id
  const stream = await client.createResponsesStream({
    model: MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "这个视频讲了什么？" },
          {
            type: "input_video",
            // file:// URL 会被 SDK 自动上传
            video_url: "file:///path/to/local/video.mp4",
          },
        ],
      } as any,
    ],
  });

  for await (const event of stream) {
    if (isDelta(event)) {
      const delta = event as any;
      if (delta.delta) {
        process.stdout.write(delta.delta);
      }
    }
  }
  console.log();
}

async function main() {
  await videoUnderstanding();
  // 取消注释下面一行来测试本地文件上传
  // await videoUnderstandingLocalFile();
}

main().catch(console.error);
