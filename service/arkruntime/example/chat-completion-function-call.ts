/**
 * 函数调用 (Function Calling / Tool Use) 示例
 * 对齐 Go SDK: example/completion_function_call/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";
import type {
  ChatCompletionMessage,
  Tool,
  ToolCall,
} from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

// 定义工具
const tools: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_current_weather",
      description: "获取指定城市的当前天气",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "城市名称，比如 北京",
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "温度单位",
          },
        },
        required: ["location"],
      },
    },
  },
];

// 模拟的天气查询函数
function getWeather(location: string, unit = "celsius"): string {
  return JSON.stringify({
    location,
    temperature: unit === "celsius" ? "25" : "77",
    unit,
    description: "晴天",
  });
}

async function functionCallNonStream() {
  console.log("----- 非流式函数调用 -----");

  const messages: ChatCompletionMessage[] = [
    { role: "user", content: "北京今天天气怎么样？" },
  ];

  // 第一次调用：模型返回 tool_calls
  const response = await client.createChatCompletion({
    model: MODEL,
    messages,
    tools,
  });

  const assistantMsg = response.choices[0].message;
  console.log("Tool calls:", JSON.stringify(assistantMsg.tool_calls, null, 2));

  if (assistantMsg.tool_calls) {
    // 追加 assistant 消息
    messages.push(assistantMsg);

    // 执行每个 tool call 并追加结果
    for (const toolCall of assistantMsg.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments ?? "{}");
      const result = getWeather(args.location, args.unit);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    // 第二次调用：模型基于工具结果生成最终回复
    const finalResponse = await client.createChatCompletion({
      model: MODEL,
      messages,
      tools,
    });

    console.log("Final:", finalResponse.choices[0].message.content);
  }
}

async function functionCallStream() {
  console.log("\n----- 流式函数调用 -----");

  const stream = await client.createChatCompletionStream({
    model: MODEL,
    messages: [{ role: "user", content: "北京今天天气怎么样？" }],
    tools,
  });

  // 聚合 tool call 参数（流式时 arguments 是分片的）
  const toolCalls = new Map<number, { id: string; name: string; args: string }>();

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      process.stdout.write(delta.content);
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        if (!toolCalls.has(idx)) {
          toolCalls.set(idx, { id: tc.id, name: tc.function?.name ?? "", args: "" });
        }
        const existing = toolCalls.get(idx)!;
        if (tc.function?.arguments) {
          existing.args += tc.function.arguments;
        }
      }
    }
  }

  if (toolCalls.size > 0) {
    console.log("\nStreamed tool calls:");
    for (const [idx, tc] of toolCalls) {
      console.log(`  [${idx}] ${tc.name}(${tc.args})`);
    }
  }
}

async function main() {
  await functionCallNonStream();
  await functionCallStream();
}

main().catch(console.error);
