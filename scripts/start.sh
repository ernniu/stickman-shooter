#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
source "${SCRIPT_DIR}/phaser-runtime.sh"

phaser_resolve_runtime "$@"
phaser_ensure_install
phaser_require_build

preferred_port="${DEPLOY_RUN_PORT:-${PORT:-}}"
phaser_select_port "${preferred_port}"
DEPLOY_RUN_PORT="${PHASER_PORT}"
phaser_stop_bound_port "${DEPLOY_RUN_PORT}"
phaser_clear_server_state
cd "${PHASER_EXEC_ROOT}"

if [[ "${NODE_ENV:-}" == "test" ]]; then
# Keep the process attached in tests so the test runner can collect logs and stop it.
env COZE_PHASER_GAME_ENV=PROD pnpm vite preview \
  --port "${DEPLOY_RUN_PORT}" \
  --host 0.0.0.0 \
  --strictPort &
server_pid="$!"
phaser_record_server_state "start" "${server_pid}"
trap 'phaser_stop_bound_port "${DEPLOY_RUN_PORT}" || true; phaser_clear_server_state' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! phaser_wait_for_server "${DEPLOY_RUN_PORT}"; then
  echo "Phaser production server failed to start." >&2
  exit 1
fi
wait "${server_pid}"
else
LOG_DIR="${PHASER_EXEC_ROOT}/logs"
LOG_FILE="${LOG_DIR}/phaser-start.log"
PID_FILE="${LOG_DIR}/phaser-server.pid"
mkdir -p "${LOG_DIR}"

echo "Starting Phaser production server on port ${DEPLOY_RUN_PORT}..."
server_pid="$(COZE_PHASER_GAME_ENV=PROD node "${PHASER_GAME_ROOT}/scripts/spawn-detached.cjs" \
  "${LOG_FILE}" pnpm vite preview \
  --port "${DEPLOY_RUN_PORT}" \
  --host 0.0.0.0 \
  --strictPort)"
phaser_record_server_state "start" "${server_pid}"

if ! phaser_wait_for_server "${DEPLOY_RUN_PORT}"; then
  echo "Phaser production server failed to start. See ${LOG_FILE}." >&2
  tail -n 20 "${LOG_FILE}" >&2 || true
  phaser_stop_bound_port "${DEPLOY_RUN_PORT}" || true
  phaser_clear_server_state
  exit 1
fi
echo "Phaser production server started (PID: ${server_pid})."
echo "Log file: ${LOG_FILE}"
echo "PID file: ${PID_FILE}"
fi
