#!/usr/bin/env node
// ============================================================
// check-version.js
// 校验 src/version.ts 的 SDK_VERSION 与 package.json 的 version 是否一致
// 两者不一致会导致 User-Agent 与实际发布版本脱节，构建/发布前应拦截
// ============================================================

const fs = require("fs");
const path = require("path");

const pkgPath = path.resolve(__dirname, "../package.json");
const versionPath = path.resolve(__dirname, "../src/version.ts");

function log(msg) {
  console.log(`[check-version] ${msg}`);
}
function err(msg) {
  console.error(`[check-version][ERROR] ${msg}`);
}

const pkgVersion = JSON.parse(fs.readFileSync(pkgPath, "utf8")).version;

const versionSource = fs.readFileSync(versionPath, "utf8");
const match = versionSource.match(
  /export\s+const\s+SDK_VERSION\s*=\s*["']([^"']+)["']/,
);

if (!match) {
  err(`未能在 ${path.relative(process.cwd(), versionPath)} 中解析出 SDK_VERSION`);
  process.exit(1);
}

const sdkVersion = match[1];

if (sdkVersion !== pkgVersion) {
  err(
    `版本不一致：package.json version=${pkgVersion}，但 version.ts SDK_VERSION=${sdkVersion}`,
  );
  err(`请将 src/version.ts 的 SDK_VERSION 更新为 ${pkgVersion} 后重试。`);
  process.exit(1);
}

log(`版本一致：${sdkVersion}`);
