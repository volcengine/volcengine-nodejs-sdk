# @volcengine/ark-runtime 示例

本目录包含 `@volcengine/ark-runtime` SDK 的使用示例，对齐 Go SDK 的 example 结构。

## 前置条件

```bash
npm install @volcengine/ark-runtime
# 或
pnpm add @volcengine/ark-runtime
```

设置环境变量：

```bash
export ARK_API_KEY="your-api-key"
```

## 运行示例

```bash
npx ts-node chat-completion.ts
```

## 示例列表

### 核心对话

| 示例 | 说明 | 对齐 Go 示例 |
|------|------|-------------|
| [chat-completion.ts](./chat-completion.ts) | 基础对话（非流式 + 流式） | `example/completion/` |
| [chat-completion-function-call.ts](./chat-completion-function-call.ts) | 函数调用 / Tool Use | `example/completion_function_call/` |
| [chat-completion-vision.ts](./chat-completion-vision.ts) | 多模态视觉对话 | `example/completion_vision/` |
| [chat-completion-reasoning.ts](./chat-completion-reasoning.ts) | 推理 / Thinking 模式 | `example/completion_reasoning/` |
| [structured-outputs.ts](./structured-outputs.ts) | JSON Schema 结构化输出 | `example/structured_outputs/` |

### Embedding & Tokenization

| 示例 | 说明 | 对齐 Go 示例 |
|------|------|-------------|
| [embeddings.ts](./embeddings.ts) | 文本 Embedding | `example/embeddings/` |
| [multimodal-embeddings.ts](./multimodal-embeddings.ts) | 多模态 Embedding | `example/multimodalembeddings/` |
| [tokenization.ts](./tokenization.ts) | 分词计数 | `example/tokenization/` |

### 图片 & 视频生成

| 示例 | 说明 | 对齐 Go 示例 |
|------|------|-------------|
| [images.ts](./images.ts) | 图片生成（URL/Base64/流式） | `example/images/` |
| [content-generation.ts](./content-generation.ts) | 视频生成（异步任务） | `example/content_generation/` |

### Bot & Context

| 示例 | 说明 | 对齐 Go 示例 |
|------|------|-------------|
| [bot-chat.ts](./bot-chat.ts) | Doubao Bot 对话 | `example/bot/` |
| [context.ts](./context.ts) | 上下文 / 会话管理 | `example/context/` |

### 批量处理

| 示例 | 说明 | 对齐 Go 示例 |
|------|------|-------------|
| [batch-chat.ts](./batch-chat.ts) | 批量对话（内置熔断器） | `example/batch_chat/` |

### 文件管理

| 示例 | 说明 | 对齐 Go 示例 |
|------|------|-------------|
| [file-upload.ts](./file-upload.ts) | 文件上传/查询/删除 | (内嵌在 responses/video) |

### Responses API

| 示例 | 说明 | 对齐 Go 示例 |
|------|------|-------------|
| [responses/basic.ts](./responses/basic.ts) | 基础 Responses API | `example/responses/basic/` |
| [responses/streaming.ts](./responses/streaming.ts) | 流式 Responses | `example/responses/web_search/` |
| [responses/web-search.ts](./responses/web-search.ts) | Web Search 工具 | `example/responses/web_search/` |
| [responses/mcp.ts](./responses/mcp.ts) | MCP 工具集成 | `example/responses/mcp/` |
| [responses/video.ts](./responses/video.ts) | 视频理解 + 本地文件上传 | `example/responses/video/` |
| [responses/doubao-app.ts](./responses/doubao-app.ts) | Doubao App 功能 | `example/responses/doubao_app/` |
| [list-input-items.ts](./list-input-items.ts) | Response Input Items 分页 | `example/listinputitems/` |

## 鉴权方式

### API Key（推荐）

```typescript
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

// 方式1：静态方法
const client = ArkRuntimeClient.withApiKey("your-api-key");

// 方式2：从环境变量读取
const client = new ArkRuntimeClient({
  apiKey: process.env.ARK_API_KEY!,
});
```

### AK/SK（IAM 鉴权）

```typescript
// AK/SK 需要从环境变量读取后手动传入
const client = ArkRuntimeClient.withAkSk(
  process.env.VOLC_ACCESSKEY!,
  process.env.VOLC_SECRETKEY!
);
```

### 构造函数

```typescript
const client = new ArkRuntimeClient({
  apiKey: "your-api-key",
  baseURL: "https://ark.cn-beijing.volces.com/api/v3",
  timeout: 60000,
  retryTimes: 2,
});
```
