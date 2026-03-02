
import { defineConfig } from "@rslib/core";

export default defineConfig({
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
