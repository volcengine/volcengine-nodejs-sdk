/**
 * Responses API 流式示例
 * 对齐 Go SDK: example/responses/web_search/main.go (streaming 部分)
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";
import {
  getEventType,
  isDelta,
  isDeltaDone,
  isResponseDone,
} from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

async function responsesStream() {
  console.log("----- Responses API 流式 -----");

  const stream = await client.createResponsesStream({
    model: MODEL,
    input: "写一首关于春天的诗",
  });

  for await (const event of stream) {
    const eventType = getEventType(event);

    if (isDelta(event)) {
      // 增量文本
      const delta = event as any;
      if (delta.delta) {
        process.stdout.write(delta.delta);
      }
    } else if (isDeltaDone(event)) {
      console.log(`\n[Delta Done] type=${eventType}`);
    } else if (isResponseDone(event)) {
      console.log(`[Response Done] type=${eventType}`);
    }
  }
}

async function main() {
  await responsesStream();
}

main().catch(console.error);
