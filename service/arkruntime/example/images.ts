/**
 * 图片生成示例 (Seedream / Seededit)
 * 对齐 Go SDK: example/images/main.go
 *
 * 注意：图片生成仅支持 API Key 鉴权
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = process.env.ARK_IMAGE_MODEL ?? "seedream-3-0";

async function generateImageURL() {
  console.log("----- 生成图片 (URL 格式) -----");

  const response = await client.generateImages({
    model: MODEL,
    prompt: "一只可爱的橘猫在花园里玩耍",
    response_format: "url",
    size: "1024x1024",
    watermark: false,
  });

  console.log("Created:", response.created);
  for (const img of response.data) {
    console.log("  URL:", img.url);
    console.log("  Size:", img.size);
  }
}

async function generateImageBase64() {
  console.log("\n----- 生成图片 (Base64 格式) -----");

  const response = await client.generateImages({
    model: MODEL,
    prompt: "一座雪山的油画风景",
    response_format: "b64_json",
    size: "512x512",
  });

  for (const img of response.data) {
    console.log("  Base64 length:", img.b64_json?.length);
    console.log("  Size:", img.size);
  }
}

async function generateImageStream() {
  console.log("\n----- 流式图片生成 -----");

  const stream = await client.generateImagesStream({
    model: MODEL,
    prompt: "赛博朋克风格的城市夜景",
    response_format: "url",
    sequential_image_generation: "auto",
    sequential_image_generation_options: { max_images: 3 },
  });

  for await (const event of stream) {
    console.log(`  [${event.type}] index=${event.image_index}`);
    if (event.url) {
      console.log(`    URL: ${event.url}`);
    }
    if (event.error) {
      console.log(`    Error: ${event.error.message}`);
    }
  }
}

async function main() {
  await generateImageURL();
  await generateImageBase64();
  await generateImageStream();
}

main().catch(console.error);
