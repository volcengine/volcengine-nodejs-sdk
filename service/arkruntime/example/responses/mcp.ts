/**
 * Responses API MCP (Model Context Protocol) 工具示例
 * 对齐 Go SDK: example/responses/mcp/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";
import { getEventType } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

async function mcpNonStream() {
  console.log("----- MCP Tool (非流式) -----");

  const response = await client.createResponses({
    model: MODEL,
    input: "查询今天北京的天气",
    tools: [
      {
        type: "mcp",
        server_label: "weather",
        server_url: "https://example.com/mcp/weather",
        require_approval: "never",
      },
    ],
  } as any);

  console.log("Response:", JSON.stringify(response, null, 2));
}

async function mcpStream() {
  console.log("\n----- MCP Tool (流式) -----");

  const stream = await client.createResponsesStream({
    model: MODEL,
    input: "查询上海的天气",
    tools: [
      {
        type: "mcp",
        server_label: "weather",
        server_url: "https://example.com/mcp/weather",
        require_approval: "never",
      },
    ],
  } as any);

  for await (const event of stream) {
    const eventType = getEventType(event);

    if (eventType.includes("mcp")) {
      console.log(`[MCP] ${eventType}`, JSON.stringify(event, null, 2));
    }

    const delta = event as any;
    if (delta.delta && typeof delta.delta === "string") {
      process.stdout.write(delta.delta);
    }
  }
  console.log();
}

async function main() {
  await mcpNonStream();
  await mcpStream();
}

main().catch(console.error);
