/**
 * Bot 对话示例 (Doubao Bot)
 * 对齐 Go SDK: example/bot/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const BOT_ID = process.env.ARK_BOT_ID ?? "bot-xxxxx"; // 替换为实际 Bot ID

async function botChatNonStream() {
  console.log("----- Bot 非流式对话 -----");

  const response = await client.createBotChatCompletion({
    model: BOT_ID,
    bot_id: BOT_ID,
    messages: [{ role: "user", content: "介绍一下火山引擎" }],
  });

  console.log("Response:", response.choices[0].message.content);

  // Bot 可能返回引用信息
  if (response.references && response.references.length > 0) {
    console.log("\nReferences:");
    for (const ref of response.references) {
      console.log(`  - ${ref.title}: ${ref.url}`);
    }
  }

  // Bot 使用统计
  if (response.bot_usage) {
    console.log("\nBot Usage:", JSON.stringify(response.bot_usage, null, 2));
  }
}

async function botChatStream() {
  console.log("\n----- Bot 流式对话 -----");

  const stream = await client.createBotChatCompletionStream({
    model: BOT_ID,
    bot_id: BOT_ID,
    messages: [{ role: "user", content: "介绍一下火山引擎" }],
  });

  process.stdout.write("Streaming: ");
  for await (const chunk of stream) {
    if (chunk.choices?.[0]?.delta?.content) {
      process.stdout.write(chunk.choices[0].delta.content);
    }

    // 流式中也可能包含引用
    if (chunk.references && chunk.references.length > 0) {
      console.log("\nReferences:");
      for (const ref of chunk.references) {
        console.log(`  - ${ref.title}: ${ref.url}`);
      }
    }
  }
  console.log();
}

async function main() {
  await botChatNonStream();
  await botChatStream();
}

main().catch(console.error);
