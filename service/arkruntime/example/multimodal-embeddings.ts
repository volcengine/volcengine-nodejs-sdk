/**
 * 多模态 Embedding 示例
 * 对齐 Go SDK: example/multimodalembeddings/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = process.env.ARK_MULTIMODAL_EMBEDDING_MODEL ?? "doubao-embedding-vision";

async function multimodalEmbedding() {
  console.log("----- 多模态 Embedding -----");

  const response = await client.createMultiModalEmbeddings({
    model: MODEL,
    input: [
      {
        type: "image_url",
        image_url: {
          url: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png",
        },
      },
      {
        type: "text",
        text: "一个彩色的logo",
      },
    ],
  });

  console.log("Response:", JSON.stringify(response, null, 2));
}

async function main() {
  await multimodalEmbedding();
}

main().catch(console.error);
