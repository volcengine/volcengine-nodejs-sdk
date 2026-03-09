# @volcengine/ark-runtime

火山引擎方舟平台（Ark）Node.js SDK，快速接入大模型推理服务，支持豆包全系列模型。

## 为什么选择这个 SDK？
🚀 **开箱即用**：无需复杂配置，3行代码接入大模型
🎯 **全功能覆盖**：支持聊天、图像生成、视频生成、向量嵌入等所有能力
⚡ **高性能**：内置连接池、自动重试、超时控制，生产级稳定性
🔒 **类型安全**：完整 TypeScript 类型定义，开发体验优秀
🤝 **跨语言对齐**：与 Go SDK 100% API 兼容，多语言项目无切换成本

## 支持的功能

| 功能 | 支持 | 说明 |
|------|------|------|
| 聊天补全 | ✅ | 非流式/流式对话 |
| 多模态对话 | ✅ | 支持图片输入 |
| 函数调用 | ✅ | 工具调用、联网搜索 |
| 嵌入向量 | ✅ | 文本嵌入、多模态嵌入 |
| 图像生成 | ✅ | 文生图、图生图 |
| 视频生成 | ✅ | 文生视频、图生视频 |
| 内容生成 | ✅ | 音频生成、多模态生成 |
| 批处理 | ✅ | 高并发批量请求 |
| 文件管理 | ✅ | 知识库文件上传/管理 |
| Bot 对话 | ✅ | 接入自定义 Bot |
| 上下文对话 | ✅ | 持久化会话上下文 |


## 安装

```bash
npm install @volcengine/ark-runtime
# 或者
yarn add @volcengine/ark-runtime
```

## 快速开始

```typescript
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

// 初始化客户端
const client = new ArkRuntimeClient({
  apiKey: process.env.ARK_API_KEY || "your-api-key",
});

// 非流式聊天
async function chat() {
  const resp = await client.createChatCompletion({
    model: "doubao-seed-2-0-pro-260215",
    messages: [
      { role: "user", content: "2+3=?" }
    ],
  });
  console.log(resp.choices[0].message.content);
}

// 流式聊天
async function chatStream() {
  const stream = await client.createChatCompletionStream({
    model: "doubao-seed-2-0-pro-260215",
    messages: [
      { role: "user", content: "写一首关于春天的诗" }
    ],
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0].delta.content || "");
  }
}

// 图像生成
async function generateImage() {
  const resp = await client.createImage({
    model: "doubao-seedream-5-0-260128",
    prompt: "一只可爱的小狗在公园里奔跑",
    n: 1,
    size: "1024x1024",
  });
  console.log(resp.data[0].url);
}
```

## 错误处理

SDK 提供统一的错误类：
- `ArkAPIError`：API 返回的业务错误
- `ArkRequestError`：网络请求错误

```typescript
try {
  const resp = await client.createChatCompletion({ /* ... */ });
} catch (err) {
  if (err instanceof ArkAPIError) {
    console.log(`API 错误：${err.message}, 请求ID：${err.requestId}`);
    console.log(`HTTP 状态码：${err.httpStatusCode}`);
  } else if (err instanceof ArkRequestError) {
    console.log(`请求错误：${err.message}`);
  }
}
```

## 文档
- [测试报告](./TEST_REPORT.md)：功能对齐、性能测试结果
- 完整示例：参考 [example](../example/) 目录
