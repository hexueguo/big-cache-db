#!/usr/bin/env node
/**
 * 一键打包 + 发布 big-cache-db
 *
 * 使用方法:
 *   node release.js
 *
 * 前提：
 *   - 已配置 rollup.config.mjs
 *   - 已安装依赖: rollup, typescript, tslib, @rollup/plugin-typescript, @rollup/plugin-node-resolve, @rollup/plugin-commonjs, rollup-plugin-dts
 *   - 已登录 npm: npm login
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// ------------------ 配置 ------------------
const PACKAGE_JSON = path.resolve(process.cwd(), "package.json");
const DIST_DIR = path.resolve(process.cwd(), "dist");

// ------------------ 工具函数 ------------------
function run(cmd, opts = {}) {
  console.log(`\x1b[36m$ ${cmd}\x1b[0m`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

// ------------------ 1. 清理 dist ------------------
if (fs.existsSync(DIST_DIR)) {
  console.log("清理 dist 目录...");
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}

// ------------------ 2. 安装依赖 ------------------
console.log("确保依赖安装完成...");
run("npm install");

// ------------------ 3. 构建 JS + 类型文件 ------------------
console.log("开始打包...");
run("npx rollup -c");

// ------------------ 4. 检查打包产物 ------------------
if (!fs.existsSync(path.join(DIST_DIR, "index.esm.js")) ||
    !fs.existsSync(path.join(DIST_DIR, "index.cjs.js")) ||
    !fs.existsSync(path.join(DIST_DIR, "index.d.ts"))) {
  console.error("❌ 构建产物缺失，请检查 rollup 配置");
  process.exit(1);
}
console.log("✅ 打包产物检查通过");

// ------------------ 5. npm pack 验证 ------------------
console.log("验证 npm pack...");
run("npm pack --dry-run");

// ------------------ 6. 发布 npm ------------------
console.log("发布到 npm...");
run("npm publish --access public");

console.log("\x1b[32m🎉 发布完成！\x1b[0m");
