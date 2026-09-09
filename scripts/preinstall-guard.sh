#!/bin/bash
set -Eeuo pipefail

if [[ "${COZE_PHASER_PREPARE_OK:-}" == "1" ]] ||
  [[ -n "${PHASER_EXEC_ROOT:-}" && "$(pwd -P)" == "${PHASER_EXEC_ROOT}" ]]; then
  exit 0
fi

case "${1:-prepare}" in
  build) project_entry="build" ;;
  dev) project_entry="dev" ;;
  preview | start) project_entry="start" ;;
  typecheck | validate) project_entry="validate" ;;
  *) project_entry="prepare" ;;
esac

cat >&2 <<MSG
Do not run package-manager commands directly in this managed Phaser project.
Use the managed project entry instead:

    bash ./scripts/${project_entry}.sh
MSG
exit 1
