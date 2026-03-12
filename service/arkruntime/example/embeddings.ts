/**
 * 文本 Embedding 示例
 * 对齐 Go SDK: example/embeddings/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-embedding-large";

async function createEmbedding() {
  console.log("----- 文本 Embedding -----");

  const response = await client.createEmbeddings({
    model: MODEL,
    input: ["天空是蓝色的", "草地是绿色的"],
  });

  console.log("Model:", response.model);
  console.log("Object:", response.object);
  console.log("Usage:", JSON.stringify(response.usage));

  for (const item of response.data) {
    console.log(`  [${item.index}] dimension=${item.embedding.length}, first 5:`, item.embedding.slice(0, 5));
  }
}

async function main() {
  await createEmbedding();
}

main().catch(console.error);
