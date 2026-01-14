module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/testing.ts", // 仅导出测试工具的文件
    "!src/index.ts", // 主要是接口导出和 re-export
    "!src/signatures.ts", // 如果存在仅导出的签名文件
  ],
};
