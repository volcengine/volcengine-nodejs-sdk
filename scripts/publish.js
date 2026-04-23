#!/usr/bin/env node
// ============================================================
// publish.js
// 逐包发布 core + service，跳过已存在版本，发布后立即打 tag 并推送
// - 429 限流直接熔断（不重试），仅对网络瞬时错误重试
// - 分批发布，规避 npm ~25 包/窗口的限流
// - 断点续传：重跑时自动跳过已发布的包
// - 支持 DRY_RUN=true 模式进行空跑测试
// ============================================================

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// ---- 配置 ---------------------------------------------------
const DRY_RUN = process.env.DRY_RUN === "true";
const MAX_RETRIES = 3;
const RETRY_DELAY = 60; // 网络瞬时错误重试间隔（秒）
const PUBLISH_DELAY = 120; // 同批次内包间间隔（秒）
const BATCH_SIZE = 20; // 每批最多发布包数（留 buffer，npm 硬限 ~25）
const BATCH_COOLDOWN = 600; // 批次间冷却时间（秒），默认 10 分钟

const failedPackages = [];
const skippedPackages = [];
const publishedPackages = [];

// ---- helpers ------------------------------------------------
function log(msg) {
  console.log(`[publish] ${msg}`);
}
function warn(msg) {
  console.error(`[publish][WARN] ${msg}`);
}
function err(msg) {
  console.error(`[publish][ERROR] ${msg}`);
}

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/** 判断是否为网络瞬时错误（值得重试） */
function isTransientError(output) {
  return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|network|fetch failed/i.test(
    output,
  );
}

/** 判断是否为 429 限流 */
function isRateLimited(output) {
  return /429|too many requests|rate limit|ETOOMANYREQUEST/i.test(output);
}

/** 判断是否为版本已存在 */
function isAlreadyPublished(output) {
  return /cannot publish over the previously published|EPUBLISHCONFLICT|You cannot publish over/i.test(
    output,
  );
}

/**
 * 检查 npm registry 上是否已存在某版本
 */
function versionExists(pkgName, pkgVersion) {
  try {
    execSync(`npm view "${pkgName}@${pkgVersion}" version --registry https://registry.npmjs.org/`, {
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取 package.json 中的 name 和 version
 */
function readPkgMeta(pkgDir) {
  const pkgJsonPath = path.join(pkgDir, "package.json");
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  return { name: pkgJson.name, version: pkgJson.version };
}

// ---- publish ------------------------------------------------

/**
 * 带重试的 publish（仅对网络瞬时错误重试，429 直接失败）
 * @returns {string} "published" | "skipped" | "rate_limited" | "failed"
 */
async function publishWithRetry(pkgDir, pkgName, pkgVersion) {
  const publishCmd = DRY_RUN
    ? "pnpm publish --access public --no-git-checks --dry-run"
    : "pnpm publish --access public --no-git-checks";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const dryLabel = DRY_RUN ? " [DRY-RUN]" : "";
    log(
      `Publishing ${pkgName}@${pkgVersion} (attempt ${attempt}/${MAX_RETRIES})${dryLabel}...`,
    );

    try {
      execSync(publishCmd, { cwd: pkgDir, stdio: "pipe" });
      log(`Published ${pkgName}@${pkgVersion}${dryLabel}`);
      return "published";
    } catch (e) {
      const output = (e.stderr || e.stdout || "").toString();

      // 429 限流：直接终止，不重试
      if (isRateLimited(output)) {
        err(
          `Hit npm rate limit (429) for ${pkgName}. Aborting — retrying won't help.`,
        );
        return "rate_limited";
      }

      // 版本已存在：视为跳过
      if (isAlreadyPublished(output)) {
        warn(
          `${pkgName}@${pkgVersion} already exists on npm (detected during publish). Skipping.`,
        );
        return "skipped";
      }

      // 网络瞬时错误：可重试
      if (isTransientError(output) && attempt < MAX_RETRIES) {
        warn(
          `Transient network error for ${pkgName}. Retrying in ${RETRY_DELAY}s...`,
        );
        await sleep(RETRY_DELAY);
        continue;
      }

      // 其他错误或重试耗尽
      err(`Failed to publish ${pkgName}@${pkgVersion}: ${output}`);
      return "failed";
    }
  }

  return "failed";
}

// ---- git tag ------------------------------------------------

/**
 * 发布后创建 git tag（同时检查本地 + 远程，避免重复）
 */
function createTag(pkgName, pkgVersion) {
  const tagName = `${pkgName}@${pkgVersion}`;

  // 检查本地 tag
  try {
    execSync(`git rev-parse "refs/tags/${tagName}"`, { stdio: "pipe" });
    log(`Tag ${tagName} already exists locally, skipping.`);
    return tagName;
  } catch {
    // 本地不存在，继续
  }

  // 检查远程 tag
  try {
    const remote = execSync(
      `git ls-remote --tags origin "refs/tags/${tagName}"`,
      { stdio: "pipe" },
    ).toString();
    if (remote.trim()) {
      log(`Tag ${tagName} already exists on remote, skipping.`);
      return tagName;
    }
  } catch {
    warn("Could not check remote tags, proceeding with tag creation.");
  }

  if (DRY_RUN) {
    log(`[DRY-RUN] Would create tag: ${tagName}`);
    execSync(`git tag -a "${tagName}" -m "Release ${tagName}"`);
    return tagName;
  }

  log(`Creating tag: ${tagName}`);
  execSync(`git tag -a "${tagName}" -m "Release ${tagName}"`);
  return tagName;
}

/**
 * 立即推送单个 tag 到远程（不攒到最后）
 */
function pushTag(tagName) {
  if (DRY_RUN) {
    log(`[DRY-RUN] Would push tag: ${tagName}`);
    return;
  }

  try {
    log(`Pushing tag: ${tagName}`);
    execSync(`git push origin "refs/tags/${tagName}"`, { stdio: "pipe" });
  } catch (e) {
    warn(`Failed to push tag ${tagName}: ${(e.stderr || "").toString()}`);
  }
}

// ---- main ---------------------------------------------------
async function main() {
  if (DRY_RUN) {
    log("============================================");
    log("  DRY-RUN MODE - no real publish or tags");
    log("============================================");
  }

  // 仅在 CI 环境设置 git 身份
  if (process.env.CI) {
    execSync('git config user.name "github-actions[bot]"');
    execSync(
      'git config user.email "github-actions[bot]@users.noreply.github.com"',
    );
  }

  // ---- 收集所有要发布的包目录 ------------------------------------
  const packageDirs = [];

  // 1) core 包（优先发布，因为 service 依赖 core）
  if (fs.existsSync("packages/sdk-core")) {
    packageDirs.push("packages/sdk-core");
  }

  // 2) service 下所有包
  if (fs.existsSync("service")) {
    for (const dirent of fs.readdirSync("service", { withFileTypes: true })) {
      if (dirent.isDirectory()) {
        const dir = path.join("service", dirent.name);
        if (fs.existsSync(path.join(dir, "package.json"))) {
          packageDirs.push(dir);
        }
      }
    }
  }

  log(`Found ${packageDirs.length} packages to process.`);

  // ---- 逐包处理（分批 + 熔断） ----------------------------------
  let batchPublishCount = 0;
  let rateLimited = false;

  for (let i = 0; i < packageDirs.length; i++) {
    const pkgDir = packageDirs[i];
    const { name: pkgName, version: pkgVersion } = readPkgMeta(pkgDir);

    // 前置检查: 版本是否已存在（不消耗 publish 配额）
    if (versionExists(pkgName, pkgVersion)) {
      log(`Skip ${pkgName}@${pkgVersion} — already exists on npm.`);
      skippedPackages.push(`${pkgName}@${pkgVersion}`);
      continue;
    }

    // 检查 dist 目录是否存在（确保已编译）
    if (!fs.existsSync(path.join(pkgDir, "dist"))) {
      warn(`${pkgName} has no dist/ directory. Skipping.`);
      skippedPackages.push(`${pkgName}@${pkgVersion}`);
      continue;
    }

    // 批次配额用完 → 冷却
    if (batchPublishCount > 0 && batchPublishCount % BATCH_SIZE === 0) {
      log(
        `Reached batch limit (${BATCH_SIZE}). Cooling down for ${BATCH_COOLDOWN}s...`,
      );
      if (!DRY_RUN) {
        await sleep(BATCH_COOLDOWN);
      }
    }

    // 发布
    const result = await publishWithRetry(pkgDir, pkgName, pkgVersion);

    switch (result) {
      case "published":
        publishedPackages.push(`${pkgName}@${pkgVersion}`);
        batchPublishCount++;
        // 立即打 tag 并推送到远程
        const tagName = createTag(pkgName, pkgVersion);
        pushTag(tagName);
        break;

      case "skipped":
        skippedPackages.push(`${pkgName}@${pkgVersion}`);
        break;

      case "rate_limited":
        failedPackages.push(`${pkgName}@${pkgVersion}`);
        rateLimited = true;
        break;

      default: // "failed"
        failedPackages.push(`${pkgName}@${pkgVersion}`);
        break;
    }

    // 429 熔断：后续包大概率也会失败，直接中断
    // 下次运行时 versionExists 会跳过已发布的包，实现断点续传
    if (rateLimited) {
      log("Rate limit hit. Stopping to avoid further 429 errors.");
      log("Re-run this script later to continue from where it left off.");
      break;
    }

    // 同批次内包间间隔
    if (!DRY_RUN && i < packageDirs.length - 1) {
      await sleep(PUBLISH_DELAY);
    }
  }

  // ---- 汇总报告 ------------------------------------------------
  const dryLabel = DRY_RUN ? " [DRY-RUN]" : "";
  console.log();
  log(`========== Publish Summary${dryLabel} ==========`);

  log(`Published: ${publishedPackages.length}`);
  for (const p of publishedPackages) console.log(`  [ok] ${p}`);

  log(`Skipped (already exists): ${skippedPackages.length}`);
  for (const p of skippedPackages) console.log(`  [skip] ${p}`);

  log(`Failed: ${failedPackages.length}`);
  for (const p of failedPackages) console.log(`  [fail] ${p}`);

  if (failedPackages.length > 0) {
    err("Some packages failed to publish!");
    process.exit(1);
  }

  log("All done!");
}

main().catch((e) => {
  err(e.message || e);
  process.exit(1);
});
