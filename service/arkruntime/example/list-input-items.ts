/**
 * Response Input Items 分页列表示例
 * 对齐 Go SDK: example/listinputitems/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

async function listInputItems() {
  // 先创建一个 Response
  console.log("----- 创建 Response -----");
  const response = await client.createResponses({
    model: MODEL,
    input: "Hello world",
  });
  console.log("Response ID:", response.id);

  // 列出该 Response 的 input items
  console.log("\n----- List Input Items -----");
  const items = await client.listResponseInputItems(response.id as string);
  console.log("Input Items:", JSON.stringify(items, null, 2));

  // 删除 Response
  console.log("\n----- 删除 Response -----");
  await client.deleteResponse(response.id as string);
  console.log("Deleted.");
}

async function main() {
  await listInputItems();
}

main().catch(console.error);
