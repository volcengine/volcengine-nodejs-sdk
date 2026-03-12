/**
 * Responses API Web Search 示例
 * 对齐 Go SDK: example/responses/web_search/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";
import { getEventType } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

async function webSearchNonStream() {
  console.log("----- Web Search (非流式) -----");

  const response = await client.createResponses({
    model: MODEL,
    input: "2024年诺贝尔物理学奖获得者是谁？",
    tools: [{ type: "web_search_call" }],
  } as any);

  console.log("Response:", JSON.stringify(response, null, 2));
}

async function webSearchStream() {
  console.log("\n----- Web Search (流式) -----");

  const stream = await client.createResponsesStream({
    model: MODEL,
    input: "今天的最新科技新闻是什么？",
    tools: [{ type: "web_search_call" }],
  } as any);

  for await (const event of stream) {
    const eventType = getEventType(event);

    if (eventType.includes("web_search")) {
      console.log(`[WebSearch] ${eventType}`);
    }

    const delta = event as any;
    if (delta.delta && typeof delta.delta === "string") {
      process.stdout.write(delta.delta);
    }
  }
  console.log();
}

async function main() {
  await webSearchNonStream();
  await webSearchStream();
}

main().catch(console.error);
