#!/usr/bin/env bash
set -euo pipefail

echo "Start Vercel build..."

# 执行项目原本的构建脚本
bash ./scripts/build.sh

echo "Original build completed."

# 删除项目根目录旧 dist
rm -rf ./dist

# 查找 Coze/Phaser runtime 里的 dist 目录
DIST_DIR="$(find /tmp/coze-phaser-runtime -type d -path "*/linux-x64-abi*/dist" | head -n 1 || true)"

# 如果没找到，再宽松查找一次
if [ -z "$DIST_DIR" ]; then
  DIST_DIR="$(find /tmp/coze-phaser-runtime -type d -name "dist" | head -n 1 || true)"
fi

# 如果还是没找到，打印目录结构并报错
if [ -z "$DIST_DIR" ]; then
  echo "ERROR: dist directory not found in /tmp/coze-phaser-runtime"
  echo "Directory list:"
  find /tmp/coze-phaser-runtime -maxdepth 5 -type d || true
  exit 1
fi

echo "Found dist directory: $DIST_DIR"

# 复制 dist 到 Vercel 项目根目录
cp -R "$DIST_DIR" ./dist

echo "Copied dist to project root:"
ls -la ./dist

echo "Vercel build finished successfully."
