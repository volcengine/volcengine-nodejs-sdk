import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { ArkRuntimeClient } from "../src/client";

// Mock the @volcengine/ark module to prevent dynamic import issues in tests
jest.mock("@volcengine/ark", () => ({
  ARKClient: jest.fn(),
  GetApiKeyCommand: jest.fn(),
}));

describe("Content Generation", () => {
  let mock: MockAdapter;
  let client: ArkRuntimeClient;
  const baseURL = "https://ark.cn-beijing.volces.com/api/v3";
  const tasksURL = `${baseURL}/contents/generations/tasks`;

  beforeEach(() => {
    client = ArkRuntimeClient.withApiKey("test-api-key");
    const httpClient = (client as any).httpClient;
    mock = new MockAdapter(httpClient);
  });

  afterEach(() => {
    mock.restore();
  });

  describe("createContentGenerationTask", () => {
    it("should create a text-only task", async () => {
      const mockResponse = { id: "cgt-text-001" };

      mock.onPost(tasksURL).reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.model).toBe("doubao-seedance-2-0-260128");
        expect(body.content).toHaveLength(1);
        expect(body.content[0].type).toBe("text");
        expect(body.content[0].text).toBe("一只猫在草地上奔跑");
        return [200, mockResponse];
      });

      const result = await client.createContentGenerationTask({
        model: "doubao-seedance-2-0-260128",
        content: [{ type: "text", text: "一只猫在草地上奔跑" }],
      });

      expect(result.id).toBe("cgt-text-001");
    });

    it("should create a task with reference image", async () => {
      const mockResponse = { id: "cgt-img-001" };

      mock.onPost(tasksURL).reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.content).toHaveLength(2);
        expect(body.content[1].type).toBe("image_url");
        expect(body.content[1].image_url.url).toBe("https://example.com/img.jpg");
        expect(body.content[1].role).toBe("reference_image");
        return [200, mockResponse];
      });

      const result = await client.createContentGenerationTask({
        model: "doubao-seedance-2-0-260128",
        content: [
          { type: "text", text: "参考图生视频" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/img.jpg" },
            role: "reference_image",
          },
        ],
      });

      expect(result.id).toBe("cgt-img-001");
    });

    it("should create a task with reference video", async () => {
      const mockResponse = { id: "cgt-vid-001" };

      mock.onPost(tasksURL).reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.content).toHaveLength(2);
        expect(body.content[1].type).toBe("video_url");
        expect(body.content[1].video_url.url).toBe("https://example.com/video.mp4");
        expect(body.content[1].role).toBe("reference_video");
        return [200, mockResponse];
      });

      const result = await client.createContentGenerationTask({
        model: "doubao-seedance-2-0-260128",
        content: [
          { type: "text", text: "参考视频生视频" },
          {
            type: "video_url",
            video_url: { url: "https://example.com/video.mp4" },
            role: "reference_video",
          },
        ],
      });

      expect(result.id).toBe("cgt-vid-001");
    });

    it("should create a task with reference audio", async () => {
      const mockResponse = { id: "cgt-aud-001" };

      mock.onPost(tasksURL).reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.content).toHaveLength(2);
        expect(body.content[1].type).toBe("audio_url");
        expect(body.content[1].audio_url.url).toBe("https://example.com/audio.mp3");
        expect(body.content[1].role).toBe("reference_audio");
        return [200, mockResponse];
      });

      const result = await client.createContentGenerationTask({
        model: "doubao-seedance-2-0-260128",
        content: [
          { type: "text", text: "参考音频生视频" },
          {
            type: "audio_url",
            audio_url: { url: "https://example.com/audio.mp3" },
            role: "reference_audio",
          },
        ],
      });

      expect(result.id).toBe("cgt-aud-001");
    });

    it("should create a multimodal task with image + video + audio references", async () => {
      const mockResponse = { id: "cgt-multi-001" };

      mock.onPost(tasksURL).reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.content).toHaveLength(5);
        // text
        expect(body.content[0].type).toBe("text");
        // 2 reference images
        expect(body.content[1].type).toBe("image_url");
        expect(body.content[1].role).toBe("reference_image");
        expect(body.content[2].type).toBe("image_url");
        expect(body.content[2].role).toBe("reference_image");
        // reference video
        expect(body.content[3].type).toBe("video_url");
        expect(body.content[3].role).toBe("reference_video");
        // reference audio
        expect(body.content[4].type).toBe("audio_url");
        expect(body.content[4].role).toBe("reference_audio");
        // other params
        expect(body.generate_audio).toBe(true);
        expect(body.ratio).toBe("16:9");
        expect(body.duration).toBe(11);
        expect(body.watermark).toBe(false);
        return [200, mockResponse];
      });

      const result = await client.createContentGenerationTask({
        model: "doubao-seedance-2-0-260128",
        content: [
          { type: "text", text: "多模态参考生视频" },
          {
            type: "image_url",
            image_url: { url: "https://example.com/pic1.jpg" },
            role: "reference_image",
          },
          {
            type: "image_url",
            image_url: { url: "https://example.com/pic2.jpg" },
            role: "reference_image",
          },
          {
            type: "video_url",
            video_url: { url: "https://example.com/video.mp4" },
            role: "reference_video",
          },
          {
            type: "audio_url",
            audio_url: { url: "https://example.com/audio.mp3" },
            role: "reference_audio",
          },
        ],
        generate_audio: true,
        ratio: "16:9",
        duration: 11,
        watermark: false,
      });

      expect(result.id).toBe("cgt-multi-001");
    });

    it("should serialize safety_identifier in request", async () => {
      const mockResponse = { id: "cgt-safe-001", safety_identifier: "safe-id-123" };

      mock.onPost(tasksURL).reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.safety_identifier).toBe("safe-id-123");
        return [200, mockResponse];
      });

      const result = await client.createContentGenerationTask({
        model: "doubao-seedance-2-0-260128",
        content: [{ type: "text", text: "test" }],
        safety_identifier: "safe-id-123",
      });

      expect(result.id).toBe("cgt-safe-001");
      expect(result.safety_identifier).toBe("safe-id-123");
    });

    it("should serialize tools in request", async () => {
      const mockResponse = { id: "cgt-tools-001" };

      mock.onPost(tasksURL).reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.tools).toHaveLength(1);
        expect(body.tools[0].type).toBe("web_search");
        return [200, mockResponse];
      });

      const result = await client.createContentGenerationTask({
        model: "doubao-seedance-2-0-260128",
        content: [{ type: "text", text: "test" }],
        tools: [{ type: "web_search" }],
      });

      expect(result.id).toBe("cgt-tools-001");
    });

    it("should reject AK/SK auth", async () => {
      const akskClient = ArkRuntimeClient.withAkSk("ak", "sk");
      await expect(
        akskClient.createContentGenerationTask({
          model: "doubao-seedance-2-0-260128",
          content: [{ type: "text", text: "test" }],
        }),
      ).rejects.toThrow();
    });

    it("should serialize draft_task content item", async () => {
      const mockResponse = { id: "cgt-draft-001" };

      mock.onPost(tasksURL).reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.content[0].type).toBe("draft_task");
        expect(body.content[0].draft_task.id).toBe("draft-123");
        return [200, mockResponse];
      });

      const result = await client.createContentGenerationTask({
        model: "doubao-seedance-2-0-260128",
        content: [
          { type: "draft_task", draft_task: { id: "draft-123" } },
        ],
      });

      expect(result.id).toBe("cgt-draft-001");
    });
  });

  describe("getContentGenerationTask", () => {
    it("should return succeeded task with all fields", async () => {
      const mockResponse = {
        id: "cgt-get-001",
        model: "doubao-seedance-2-0-260128",
        safety_identifier: "safe-abc",
        status: "succeeded",
        content: {
          video_url: "https://example.com/output.mp4",
          last_frame_url: "https://example.com/frame.jpg",
          file_url: "",
        },
        usage: {
          prompt_tokens: 0,
          completion_tokens: 411300,
          total_tokens: 411300,
          tool_usage: { web_search: 1 },
        },
        frames: 264,
        framespersecond: 24,
        resolution: "1280x720",
        ratio: "16:9",
        duration: 11,
        created_at: 1776073692,
        updated_at: 1776074800,
        seed: 42,
        revised_prompt: "revised prompt text",
        service_tier: "default",
        execution_expires_after: 172800,
        generate_audio: true,
        draft: false,
        draft_task_id: "",
        tools: [{ type: "web_search" }],
      };

      mock.onGet(`${tasksURL}/cgt-get-001`).reply(200, mockResponse);

      const result = await client.getContentGenerationTask("cgt-get-001");

      expect(result.id).toBe("cgt-get-001");
      expect(result.model).toBe("doubao-seedance-2-0-260128");
      expect(result.safety_identifier).toBe("safe-abc");
      expect(result.status).toBe("succeeded");
      expect(result.content.video_url).toBe("https://example.com/output.mp4");
      expect(result.content.last_frame_url).toBe("https://example.com/frame.jpg");
      expect(result.usage.completion_tokens).toBe(411300);
      expect(result.usage.tool_usage).toBeDefined();
      expect(result.usage.tool_usage!.web_search).toBe(1);
      expect(result.frames).toBe(264);
      expect(result.framespersecond).toBe(24);
      expect(result.ratio).toBe("16:9");
      expect(result.duration).toBe(11);
      expect(result.seed).toBe(42);
      expect(result.revised_prompt).toBe("revised prompt text");
      expect(result.service_tier).toBe("default");
      expect(result.execution_expires_after).toBe(172800);
      expect(result.generate_audio).toBe(true);
      expect(result.draft).toBe(false);
      expect(result.tools).toHaveLength(1);
      expect(result.tools![0].type).toBe("web_search");
    });

    it("should return failed task with error", async () => {
      const mockResponse = {
        id: "cgt-fail-001",
        model: "doubao-seedance-2-0-260128",
        status: "failed",
        content: { video_url: "", last_frame_url: "", file_url: "" },
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        error: { code: "content_filter", message: "Content was filtered" },
        created_at: 1776073692,
        updated_at: 1776073700,
      };

      mock.onGet(`${tasksURL}/cgt-fail-001`).reply(200, mockResponse);

      const result = await client.getContentGenerationTask("cgt-fail-001");

      expect(result.status).toBe("failed");
      expect(result.error?.code).toBe("content_filter");
      expect(result.error?.message).toBe("Content was filtered");
    });

    it("should reject AK/SK auth", async () => {
      const akskClient = ArkRuntimeClient.withAkSk("ak", "sk");
      await expect(
        akskClient.getContentGenerationTask("cgt-001"),
      ).rejects.toThrow();
    });
  });

  describe("listContentGenerationTasks", () => {
    it("should list tasks with filter", async () => {
      const mockResponse = {
        total: 2,
        items: [
          {
            id: "cgt-list-001",
            model: "doubao-seedance-2-0-260128",
            safety_identifier: "safe-x",
            status: "succeeded",
            content: { video_url: "https://example.com/v1.mp4", last_frame_url: "", file_url: "" },
            usage: { prompt_tokens: 0, completion_tokens: 100, total_tokens: 100, tool_usage: { web_search: 2 } },
            created_at: 1776073000,
            updated_at: 1776074000,
            generate_audio: true,
            tools: [{ type: "web_search" }],
          },
          {
            id: "cgt-list-002",
            model: "doubao-seedance-2-0-260128",
            status: "running",
            content: { video_url: "", last_frame_url: "", file_url: "" },
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            created_at: 1776073500,
            updated_at: 1776073500,
          },
        ],
      };

      mock.onGet(tasksURL).reply((config) => {
        expect(config.params["page_num"]).toBe("1");
        expect(config.params["page_size"]).toBe("10");
        expect(config.params["filter.status"]).toBe("succeeded");
        expect(config.params["filter.service_tier"]).toBe("default");
        return [200, mockResponse];
      });

      const result = await client.listContentGenerationTasks({
        page_num: 1,
        page_size: 10,
        filter: { status: "succeeded", service_tier: "default" },
      });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe("cgt-list-001");
      expect(result.items[0].safety_identifier).toBe("safe-x");
      expect(result.items[0].usage.tool_usage).toBeDefined();
      expect(result.items[0].usage.tool_usage!.web_search).toBe(2);
      expect(result.items[0].tools).toHaveLength(1);
      expect(result.items[0].tools![0].type).toBe("web_search");
      expect(result.items[1].id).toBe("cgt-list-002");
      expect(result.items[1].status).toBe("running");
    });

    it("should list tasks with task_ids filter", async () => {
      const mockResponse = { total: 0, items: [] };

      mock.onGet(tasksURL).reply((config) => {
        expect(config.params["filter.task_ids"]).toEqual(["cgt-a", "cgt-b"]);
        return [200, mockResponse];
      });

      await client.listContentGenerationTasks({
        filter: { task_ids: ["cgt-a", "cgt-b"] },
      });
    });

    it("should reject AK/SK auth", async () => {
      const akskClient = ArkRuntimeClient.withAkSk("ak", "sk");
      await expect(
        akskClient.listContentGenerationTasks({ page_num: 1, page_size: 10 }),
      ).rejects.toThrow();
    });
  });

  describe("deleteContentGenerationTask", () => {
    it("should delete a task", async () => {
      mock.onDelete(`${tasksURL}/cgt-del-001`).reply(200, undefined);
      await expect(
        client.deleteContentGenerationTask("cgt-del-001"),
      ).resolves.not.toThrow();
    });

    it("should reject AK/SK auth", async () => {
      const akskClient = ArkRuntimeClient.withAkSk("ak", "sk");
      await expect(
        akskClient.deleteContentGenerationTask("cgt-001"),
      ).rejects.toThrow();
    });
  });
});
