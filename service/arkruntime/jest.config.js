module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  moduleNameMapper: {
    "^@volcengine/ark$": "<rootDir>/../ark/src/api",
    "^@volcengine/sdk-core$": "<rootDir>/../../packages/sdk-core/src/index",
  },
};
