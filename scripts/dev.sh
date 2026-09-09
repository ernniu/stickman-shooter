#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "${SCRIPT_DIR}/phaser-runtime.sh"

# Detached dev servers have no owner after this script exits. Bound their
# lifetime so abandoned Vite processes do not retain ports and memory forever.
MAX_RUNTIME_SECONDS=7200

# The detached bash wrapper is the process-group leader. Its watchdog reclaims
# the whole group (wrapper -> pnpm -> Vite/node) after the timeout; if Vite exits
# first, the wrapper also tears down the remaining group immediately.
RUN_WITH_TIMEOUT='
timeout_seconds=$1
shift

"$@" &
child_pid=$!

( trap "" TERM
  sleep "${timeout_seconds}"
  echo "[dev] Phaser dev server exceeded ${timeout_seconds}s; stopping process group $$."
  kill -TERM -- "-$$" 2>/dev/null || true
  sleep 5
  kill -KILL -- "-$$" 2>/dev/null || true
) &

wait "${child_pid}"
kill -KILL -- "-$$" 2>/dev/null || true
'

phaser_resolve_runtime "$@"
phaser_ensure_install

preferred_port="${DEPLOY_RUN_PORT:-${PORT:-}}"
phaser_select_port "${preferred_port}"
DEPLOY_RUN_PORT="${PHASER_PORT}"
phaser_stop_bound_port "${DEPLOY_RUN_PORT}"
phaser_clear_server_state
cd "${PHASER_EXEC_ROOT}"

if [[ "${NODE_ENV:-}" == "test" ]]; then
# Keep the process attached so a test runner can collect logs and stop it deterministically.
env COZE_PHASER_GAME_ENV=DEV pnpm vite \
  --port "${DEPLOY_RUN_PORT}" \
  --host 0.0.0.0 \
  --strictPort &
server_pid="$!"
phaser_record_server_state "dev" "${server_pid}"
trap 'phaser_stop_bound_port "${DEPLOY_RUN_PORT}" || true; phaser_clear_server_state' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! phaser_wait_for_server "${DEPLOY_RUN_PORT}"; then
  echo "Phaser dev server failed to start." >&2
  exit 1
fi
echo "Phaser dev server running for tests (PID: ${server_pid})."
echo "PID file: ${PHASER_EXEC_ROOT}/logs/phaser-server.pid"
wait "${server_pid}"
else
LOG_DIR="${PHASER_EXEC_ROOT}/logs"
LOG_FILE="${LOG_DIR}/phaser-dev.log"
PID_FILE="${LOG_DIR}/phaser-server.pid"
mkdir -p "${LOG_DIR}"

echo "Starting Phaser dev server on port ${DEPLOY_RUN_PORT}..."
server_pid="$(COZE_PHASER_GAME_ENV=DEV node "${PHASER_GAME_ROOT}/scripts/spawn-detached.cjs" \
  "${LOG_FILE}" /bin/bash -c "${RUN_WITH_TIMEOUT}" \
  detached-runner "${MAX_RUNTIME_SECONDS}" pnpm vite \
  --port "${DEPLOY_RUN_PORT}" \
  --host 0.0.0.0 \
  --strictPort)"
phaser_record_server_state "dev" "${server_pid}"

if ! phaser_wait_for_server "${DEPLOY_RUN_PORT}"; then
  echo "Phaser dev server failed to start. See ${LOG_FILE}." >&2
  tail -n 20 "${LOG_FILE}" >&2 || true
  phaser_stop_bound_port "${DEPLOY_RUN_PORT}" || true
  phaser_clear_server_state
  exit 1
fi
echo "Phaser dev server started (PID: ${server_pid})."
echo "Auto stop after ${MAX_RUNTIME_SECONDS}s."
echo "Log file: ${LOG_FILE}"
echo "PID file: ${PID_FILE}"
fi
