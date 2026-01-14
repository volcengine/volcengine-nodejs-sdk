import { defineConfig } from "@rslib/core";

export default defineConfig({
  source: {
    entry: {
      index: "./src/index.ts",
      testing: "./src/testing/testing.ts",
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
