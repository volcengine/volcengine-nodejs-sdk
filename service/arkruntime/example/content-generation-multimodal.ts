/**
 * 多模态参考生视频示例（r2v）
 * 对齐 PRD「火山cn官方示例-参考多模态（图片，视频，音频）」
 *
 * 支持传入参考图片、参考视频、参考音频，通过 prompt 灵活指定多模态参考。
 *
 * 注意：仅支持 API Key 鉴权
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = process.env.ARK_VIDEO_MODEL ?? "doubao-seedance-2-0-260128";

async function createMultimodalTask() {
  console.log("----- 创建多模态参考生视频任务 -----");

  const task = await client.createContentGenerationTask({
    model: MODEL,
    content: [
      {
        type: "text",
        text: "全程使用视频1的第一视角构图，全程使用音频1作为背景音乐。第一人称视角果茶宣传广告，seedance牌「苹苹安安」苹果果茶限定款；首帧为图片1，你的手摘下一颗带晨露的阿克苏红苹果，轻脆的苹果碰撞声；2-4 秒：快速切镜，你的手将苹果块投入雪克杯，加入冰块与茶底，用力摇晃，冰块碰撞声与摇晃声卡点轻快鼓点，背景音：「鲜切现摇」；4-6 秒：第一人称成品特写，分层果茶倒入透明杯，你的手轻挤奶盖在顶部铺展，在杯身贴上粉红包标，镜头拉近看奶盖与果茶的分层纹理；6-8 秒：第一人称手持举杯，你将图片2中的果茶举到镜头前（模拟递到观众面前的视角），杯身标签清晰可见，背景音「来一口鲜爽」，尾帧定格为图片2。背景声音统一为女生音色。",
      },
      {
        type: "image_url",
        image_url: {
          url: "https://ark-project.tos-cn-beijing.volces.com/doc_image/r2v_tea_pic1.jpg",
        },
        role: "reference_image",
      },
      {
        type: "image_url",
        image_url: {
          url: "https://ark-project.tos-cn-beijing.volces.com/doc_image/r2v_tea_pic2.jpg",
        },
        role: "reference_image",
      },
      {
        type: "video_url",
        video_url: {
          url: "https://ark-project.tos-cn-beijing.volces.com/doc_video/r2v_tea_video1.mp4",
        },
        role: "reference_video",
      },
      {
        type: "audio_url",
        audio_url: {
          url: "https://ark-project.tos-cn-beijing.volces.com/doc_audio/r2v_tea_audio1.mp3",
        },
        role: "reference_audio",
      },
    ],
    generate_audio: true,
    ratio: "16:9",
    duration: 11,
    watermark: false,
  });

  console.log("Task ID:", task.id);
  return task.id;
}

async function pollTask(taskId: string) {
  console.log("\n----- 轮询任务状态 -----");

  let status = "running";
  while (status === "running" || status === "queued") {
    await new Promise((r) => setTimeout(r, 10000));

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

async function main() {
  const taskId = await createMultimodalTask();
  await pollTask(taskId);
}

main().catch(console.error);
