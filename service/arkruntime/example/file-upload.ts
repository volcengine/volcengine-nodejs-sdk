/**
 * 文件上传与管理示例
 * 对齐 Go SDK: example/file.go (内嵌在 responses/video 示例中)
 */
import * as fs from "fs";
import * as path from "path";
import { ArkRuntimeClient } from "@volcengine/ark-runtime";

const client = ArkRuntimeClient.withApiKey(process.env.ARK_API_KEY!);

async function fileOperations() {
  console.log("----- 文件上传 -----");

  // 上传文件（这里创建一个临时文件作为示例）
  const tmpFile = path.join("/tmp", "ark-test-upload.txt");
  fs.writeFileSync(tmpFile, "Hello, this is a test file for upload.");

  const fileMeta = await client.uploadFile({
    file: fs.createReadStream(tmpFile) as any,
    purpose: "user_data",
  });

  console.log("File ID:", fileMeta.id);
  console.log("Filename:", fileMeta.filename);
  console.log("Status:", fileMeta.status);

  // 查询文件
  console.log("\n----- 查询文件 -----");
  const retrieved = await client.retrieveFile(fileMeta.id);
  console.log("Retrieved:", retrieved.id, retrieved.status);

  // 列出文件
  console.log("\n----- 列出文件 -----");
  const list = await client.listFiles({ limit: 5 });
  console.log(`Total files listed: ${list.data?.length ?? 0}`);
  for (const f of list.data ?? []) {
    console.log(`  [${f.id}] ${f.filename} (${f.status})`);
  }

  // 删除文件
  console.log("\n----- 删除文件 -----");
  const deleteResult = await client.deleteFile(fileMeta.id);
  console.log("Deleted:", deleteResult.deleted);

  // 清理临时文件
  fs.unlinkSync(tmpFile);
}

async function main() {
  await fileOperations();
}

main().catch(console.error);
