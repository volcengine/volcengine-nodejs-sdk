/**
 * Responses API 基础示例
 * 对齐 Go SDK: example/responses/basic/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

async function basicResponse() {
  console.log("----- Responses API (非流式) -----");

  const response = await client.createResponses({
    model: MODEL,
    input: "解释什么是量子计算",
  });

  console.log("Response ID:", response.id);
  console.log("Status:", response.status);
  console.log("Output:", JSON.stringify(response.output, null, 2));
}

async function responseWithImageInput() {
  console.log("\n----- Responses API (图片输入) -----");

  const response = await client.createResponses({
    model: MODEL,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: "这张图片是什么？" },
          {
            type: "input_image",
            image_url: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png",
          },
        ],
      } as any,
    ],
  });

  console.log("Response:", JSON.stringify(response, null, 2));
}

async function multiTurnResponse() {
  console.log("\n----- Responses API (多轮对话) -----");

  // 第一轮
  const resp1 = await client.createResponses({
    model: MODEL,
    input: "记住数字42",
  });
  console.log("Turn 1 ID:", resp1.id);

  // 第二轮：引用前一轮
  const resp2 = await client.createResponses({
    model: MODEL,
    input: [
      { type: "response", id: resp1.id } as any,
      {
        role: "user",
        content: [{ type: "input_text", text: "我刚才让你记住的数字是什么？" }],
      } as any,
    ],
  });
  console.log("Turn 2 Output:", JSON.stringify(resp2.output, null, 2));
}

async function main() {
  await basicResponse();
  await responseWithImageInput();
  await multiTurnResponse();
}

main().catch(console.error);
