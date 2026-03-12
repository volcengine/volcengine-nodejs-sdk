/**
 * Tokenization（分词计数）示例
 * 对齐 Go SDK: example/tokenization/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

async function tokenize() {
  console.log("----- Tokenization -----");

  const response = await client.createTokenization({
    model: MODEL,
    text: "hello world, 你好世界！",
  });

  console.log("Response:", JSON.stringify(response, null, 2));

  for (const item of response.data) {
    console.log(`  Total tokens: ${item.total_tokens}`);
    console.log(`  Token IDs: [${item.token_ids.join(", ")}]`);
  }
}

async function main() {
  await tokenize();
}

main().catch(console.error);
