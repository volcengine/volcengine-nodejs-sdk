/**
 * 批量对话补全示例
 * 对齐 Go SDK: example/batch_chat/main.go
 *
 * 使用 createBatchChatCompletion 实现高并发，内置熔断器限流。
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

async function batchChat() {
  const TOTAL = 10; // Go 示例用了 50000，这里演示用 10 个
  const MAX_PARALLEL = 5;

  console.log(`----- 批量对话 (${TOTAL} 请求, ${MAX_PARALLEL} 并发) -----`);

  let completed = 0;
  let failed = 0;

  // 并发控制：使用 semaphore 模式
  const semaphore = new Array(MAX_PARALLEL).fill(null);
  const tasks: Promise<void>[] = [];

  for (let i = 0; i < TOTAL; i++) {
    const idx = i;
    const task = (async () => {
      try {
        const response = await client.createBatchChatCompletion({
          model: MODEL,
          messages: [
            { role: "user", content: `你好，这是第 ${idx + 1} 个请求。请回复"收到"。` },
          ],
        });
        completed++;
        console.log(`  [${idx + 1}/${TOTAL}] OK: ${response.choices[0]?.message?.content?.slice(0, 20)}`);
      } catch (err: any) {
        failed++;
        console.log(`  [${idx + 1}/${TOTAL}] FAIL: ${err.message}`);
      }
    })();
    tasks.push(task);

    // 控制并发
    if (tasks.length >= MAX_PARALLEL) {
      await Promise.race(tasks);
      // 清理已完成的
      for (let j = tasks.length - 1; j >= 0; j--) {
        const settled = await Promise.race([tasks[j].then(() => true), Promise.resolve(false)]);
        if (settled) tasks.splice(j, 1);
      }
    }
  }

  await Promise.all(tasks);

  console.log(`\nDone: ${completed} succeeded, ${failed} failed`);
}

async function main() {
  await batchChat();
}

main().catch(console.error);
