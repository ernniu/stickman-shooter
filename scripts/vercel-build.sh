#!/usr/bin/env bash
set -euo pipefail

echo "===== Vercel build start ====="
echo "Current dir:"
pwd

echo "Run original build script..."
bash ./scripts/build.sh

echo "Original build completed."

echo "Find app dist index.html:"
find /tmp/coze-phaser-runtime -type f -path "*/dist/index.html" -print || true

INDEX_FILE="$(find /tmp/coze-phaser-runtime -type f -path "*/dist/index.html" | head -n 1 || true)"

if [ -z "$INDEX_FILE" ]; then
  echo "ERROR: app dist/index.html not found."
  echo "List possible dist directories:"
  find /tmp/coze-phaser-runtime -type d -name "dist" -print || true
  exit 1
fi

DIST_DIR="$(dirname "$INDEX_FILE")"

echo "Found app dist directory: $DIST_DIR"

rm -rf ./dist
cp -R "$DIST_DIR" ./dist

echo "Copied app dist to project root:"
ls -la ./dist

echo "Check index.html:"
test -f ./dist/index.html

echo "===== Vercel build finished successfully ====="
