import { defineConfig } from "@rslib/core";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 读取 package.json 的 version 作为唯一真源，构建期注入到产物
const pkg = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("./package.json", import.meta.url)),
    "utf8",
  ),
);

export default defineConfig({
  source: {
    entry: {
      index: "./src/index.ts",
      testing: "./src/testing/testing.ts",
    },
    // 将 src/version.ts 中的编译期常量替换为真实版本
    define: {
      "process.env.SDK_VERSION": JSON.stringify(pkg.version),
    },
  },
  lib: [
    {
      format: "esm",
      syntax: "es2020",
      dts: true,
      output: {
        distPath: {
          root: "./dist/esm",
        },
      },
    },
    {
      format: "cjs",
      syntax: "es2020",
      output: {
        distPath: {
          root: "./dist/cjs",
        },
      },
    },
  ],
});
