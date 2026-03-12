/**
 * Responses API Doubao App 功能示例
 * 对齐 Go SDK: example/responses/doubao_app/main.go
 *
 * 支持 Doubao 平台特定功能：chat, deepChat, aiSearch, reasoningSearch
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";
import { getEventType, isDelta, isResponseDone } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

async function doubaoFeatureChat(featureType: string) {
  console.log(`\n----- Doubao Feature: ${featureType} -----`);

  const stream = await client.createResponsesStream({
    model: MODEL,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: "解释什么是人工智能" }],
      } as any,
    ],
    tools: [
      {
        type: "doubao_feature",
        doubao_feature: { type: featureType },
      },
    ],
  } as any);

  for await (const event of stream) {
    if (isDelta(event)) {
      const delta = event as any;
      if (delta.delta) {
        process.stdout.write(delta.delta);
      }
    }
    if (isResponseDone(event)) {
      console.log(`\n[Done] ${getEventType(event)}`);
    }
  }
}

async function main() {
  // 测试不同的 Doubao 功能类型
  await doubaoFeatureChat("chat");
  await doubaoFeatureChat("deepChat");
  await doubaoFeatureChat("aiSearch");
  await doubaoFeatureChat("reasoningSearch");
}

main().catch(console.error);
