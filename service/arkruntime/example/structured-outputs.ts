/**
 * 结构化输出示例 (JSON Schema Response Format)
 * 对齐 Go SDK: example/structured_outputs/main.go
 */
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);
const MODEL = "doubao-seed-2-0-pro-260215";

// 定义期望输出的 JSON Schema
const personSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "人物名称" },
    age: { type: "integer", description: "年龄" },
    occupation: { type: "string", description: "职业" },
    hobbies: {
      type: "array",
      items: { type: "string" },
      description: "爱好列表",
    },
  },
  required: ["name", "age", "occupation", "hobbies"],
};

async function structuredOutput() {
  console.log("----- 结构化输出 -----");

  const response = await client.createChatCompletion({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: "请生成一个虚构人物的信息，包含姓名、年龄、职业和爱好。",
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "person_info",
        description: "人物信息",
        schema: personSchema,
        strict: true,
      },
    },
  });

  const content = response.choices[0].message.content;
  console.log("Raw response:", content);

  // 解析为类型化对象
  if (typeof content === "string") {
    const person = JSON.parse(content) as {
      name: string;
      age: number;
      occupation: string;
      hobbies: string[];
    };
    console.log("Parsed person:", person);
    console.log("  Name:", person.name);
    console.log("  Age:", person.age);
    console.log("  Occupation:", person.occupation);
    console.log("  Hobbies:", person.hobbies.join(", "));
  }
}

async function main() {
  await structuredOutput();
}

main().catch(console.error);
