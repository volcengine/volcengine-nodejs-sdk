/**
 * 内容/视频生成（异步任务）示例
 * 对齐 Go SDK: example/content_generation/main.go
 *
 * 注意：仅支持 API Key 鉴权
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = process.env.ARK_VIDEO_MODEL ?? "seedance-1-0-lite";

async function createTask() {
  console.log("----- 创建内容生成任务 -----");

  const task = await client.createContentGenerationTask({
    model: MODEL,
    content: [
      { type: "text", text: "一只猫在草地上奔跑" },
    ],
  });

  console.log("Task ID:", task.id);
  return task.id;
}

async function pollTask(taskId: string) {
  console.log("\n----- 轮询任务状态 -----");

  let status = "running";
  while (status === "running" || status === "queued") {
    await new Promise((r) => setTimeout(r, 5000));

    const result = await client.getContentGenerationTask(taskId);
    status = result.status;
    console.log(`  Status: ${status}`);

    if (status === "succeeded") {
      console.log("  Video URL:", result.content.video_url);
      console.log("  Usage:", JSON.stringify(result.usage));
      return;
    }

    if (status === "failed") {
      console.log("  Error:", result.error?.message);
      return;
    }
  }
}

async function listTasks() {
  console.log("\n----- 列出任务 -----");

  const response = await client.listContentGenerationTasks({
    page_num: 1,
    page_size: 5,
  });

  console.log(`Total: ${response.total}`);
  for (const item of response.items) {
    console.log(`  [${item.id}] status=${item.status}, model=${item.model}`);
  }
}

async function main() {
  const taskId = await createTask();
  await pollTask(taskId);
  await listTasks();
}

main().catch(console.error);
