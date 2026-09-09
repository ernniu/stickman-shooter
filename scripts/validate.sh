#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "${SCRIPT_DIR}/phaser-runtime.sh"

phaser_resolve_runtime "$@"
phaser_ensure_install
cd "${PHASER_EXEC_ROOT}"

pnpm validate
