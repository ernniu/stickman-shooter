#!/bin/bash

phaser_runtime_error() {
  echo "Phaser runtime error: $*" >&2
  return 1
}

PHASER_RUNTIME_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
PHASER_GAME_ROOT="$(cd "${PHASER_RUNTIME_SCRIPT_DIR}/.." && pwd -P)"
PHASER_EXEC_ROOT=""
PHASER_PROJECT_KEY=""
PHASER_NODE_RUNTIME=""
PHASER_PORT=""
PHASER_PORT_SOURCE=""

phaser_copy_required_file() {
  local relative_path="$1"
  local source_path="${PHASER_GAME_ROOT}/${relative_path}"
  local target_path="${PHASER_EXEC_ROOT}/${relative_path}"

  [[ -f "${source_path}" ]] || {
    phaser_runtime_error "required project file is missing: ${relative_path}"
    return 1
  }

  mkdir -p "$(dirname "${target_path}")"
  cp -f "${source_path}" "${target_path}"
}

phaser_copy_optional_file() {
  local relative_path="$1"
  local source_path="${PHASER_GAME_ROOT}/${relative_path}"
  local target_path="${PHASER_EXEC_ROOT}/${relative_path}"

  if [[ -f "${source_path}" ]]; then
    mkdir -p "$(dirname "${target_path}")"
    cp -f "${source_path}" "${target_path}"
  else
    rm -f "${target_path}"
  fi
}

phaser_compute_project_identity() {
  command -v node >/dev/null 2>&1 || {
    phaser_runtime_error "node is required"
    return 1
  }

  PHASER_PROJECT_KEY="$(
    node -e \
      'const { createHash } = require("node:crypto"); process.stdout.write(createHash("sha256").update(process.argv[1]).digest("hex").slice(0, 16));' \
      "${PHASER_GAME_ROOT}"
  )"
  PHASER_NODE_RUNTIME="$(
    node -p \
      '`${process.platform}-${process.arch}-abi${process.versions.modules}`'
  )"
}

phaser_prepare_runtime() {
  local runtime_base="/tmp/coze-phaser-runtime"

  PHASER_EXEC_ROOT="${runtime_base}/${PHASER_PROJECT_KEY}/${PHASER_NODE_RUNTIME}"
  mkdir -p "${PHASER_EXEC_ROOT}"
  PHASER_EXEC_ROOT="$(cd "${PHASER_EXEC_ROOT}" && pwd -P)"

  case "${PHASER_EXEC_ROOT}/" in
    "${PHASER_GAME_ROOT}/"*)
      phaser_runtime_error "managed runtime must not be inside GAME_ROOT"
      return 1
      ;;
  esac

  phaser_copy_required_file "package.json"
  phaser_copy_required_file "pnpm-lock.yaml"
  phaser_copy_required_file "index.html"
  phaser_copy_required_file "tsconfig.json"
  phaser_copy_required_file "vite.config.ts"
  phaser_copy_required_file "scripts/check-image-sizing.mjs"
  phaser_copy_required_file "scripts/preinstall-guard.sh"
  phaser_copy_optional_file ".npmrc"

  local tsconfig_path
  for tsconfig_path in "${PHASER_GAME_ROOT}"/tsconfig*.json; do
    [[ -f "${tsconfig_path}" ]] || continue
    cp -f "${tsconfig_path}" "${PHASER_EXEC_ROOT}/$(basename "${tsconfig_path}")"
  done

  local runtime_source="${PHASER_EXEC_ROOT}/src"
  if [[ -e "${runtime_source}" && ! -L "${runtime_source}" ]]; then
    phaser_runtime_error "runtime src exists and is not a managed symbolic link: ${runtime_source}"
    return 1
  fi

  rm -f "${runtime_source}"
  ln -s "${PHASER_GAME_ROOT}/src" "${runtime_source}"
}

phaser_resolve_runtime() {
  [[ $# -eq 0 ]] || {
    phaser_runtime_error "project scripts do not accept additional arguments"
    return 2
  }

  phaser_compute_project_identity
  phaser_prepare_runtime

  export PHASER_GAME_ROOT PHASER_EXEC_ROOT
  export PHASER_PROJECT_KEY PHASER_NODE_RUNTIME

  echo "Phaser game root: ${PHASER_GAME_ROOT}"
  echo "Phaser execution root: ${PHASER_EXEC_ROOT}"
}

phaser_clear_server_state() {
  local log_dir="${PHASER_EXEC_ROOT}/logs"
  rm -f \
    "${log_dir}/phaser-server.pid" \
    "${log_dir}/phaser-server.kind" \
    "${log_dir}/phaser-server.port"
}

phaser_listener_pids() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null | sort -u || true
    return 0
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -H -lntp 2>/dev/null \
      | awk -v port="${port}" '$4 ~ ":" port "$"' \
      | grep -o 'pid=[0-9]*' \
      | cut -d= -f2 \
      | sort -u || true
    return 0
  fi

  phaser_runtime_error "lsof or ss is required to inspect port ${port}"
  return 1
}

phaser_stop_bound_port() {
  local port="$1"
  local pids=""
  pids="$(phaser_listener_pids "${port}")" || return 1
  [[ -n "${pids}" ]] || return 0

  echo "Stopping the process listening on Phaser project port ${port}: ${pids//$'\n'/ }."
  local pid
  for pid in ${pids}; do
    if [[ "${pid}" =~ ^[0-9]+$ && "${pid}" -gt 1 && "${pid}" != "$$" ]]; then
      kill -TERM "${pid}" 2>/dev/null || true
    fi
  done

  local attempt
  for attempt in {1..20}; do
    pids="$(phaser_listener_pids "${port}")" || return 1
    [[ -z "${pids}" ]] && break
    sleep 0.1
  done

  if [[ -n "${pids}" ]]; then
    for pid in ${pids}; do
      if [[ "${pid}" =~ ^[0-9]+$ && "${pid}" -gt 1 && "${pid}" != "$$" ]]; then
        kill -KILL "${pid}" 2>/dev/null || true
      fi
    done
  fi

  pids="$(phaser_listener_pids "${port}")" || return 1
  [[ -z "${pids}" ]] || {
    phaser_runtime_error "port ${port} is still occupied"
    return 1
  }
}

phaser_select_port() {
  local preferred_port="${1:-}"
  local configured_port=""
  configured_port="$(phaser_read_configured_port)" || return 1

  if [[ -n "${configured_port}" ]]; then
    PHASER_PORT="${configured_port}"
    PHASER_PORT_SOURCE="configured"
  else
    if [[ -n "${preferred_port}" ]] && ! phaser_validate_port "${preferred_port}"; then
      phaser_runtime_error "preferred port must be an integer from 1024 through 65535"
      return 1
    fi
    PHASER_PORT="$(node - "${PHASER_GAME_ROOT}" "${preferred_port}" <<'NODE'
const { createHash } = require("node:crypto");
const net = require("node:net");

const gameRoot = process.argv[2];
const preferredPort = process.argv[3] ? Number(process.argv[3]) : undefined;
const start = 20_000;
const count = 20_000;
const projectHash = createHash("sha256").update(gameRoot).digest("hex");
const firstOffset = Number.parseInt(projectHash.slice(0, 8), 16) % count;
const candidates = [
  ...(preferredPort === undefined ? [] : [preferredPort]),
  ...Array.from(
    { length: count },
    (_value, offset) => start + ((firstOffset + offset) % count),
  ),
];

const available = (port) => new Promise((resolve) => {
  const server = net.createServer();
  server.unref();
  server.once("error", () => resolve(false));
  server.listen(
    { host: "127.0.0.1", port, exclusive: true },
    () => server.close(() => resolve(true)),
  );
});

(async () => {
  const seen = new Set();
  for (const port of candidates) {
    if (seen.has(port)) continue;
    seen.add(port);
    if (await available(port)) {
      process.stdout.write(`${port}\n`);
      return;
    }
  }
  throw new Error("no available Phaser project port in the allocation range");
})().catch((error) => {
  process.stderr.write(`Phaser port allocation failed: ${error.message}\n`);
  process.exitCode = 1;
});
NODE
)" || return 1
    PHASER_PORT_SOURCE="allocated"
  fi

  [[ "${PHASER_PORT}" =~ ^[0-9]+$ ]] || {
    phaser_runtime_error "port selector returned an invalid port: ${PHASER_PORT}"
    return 1
  }
  export PHASER_PORT PHASER_PORT_SOURCE

  echo "Phaser project port: ${PHASER_PORT}"
}

phaser_validate_port() {
  local port="${1//_/}"
  [[ "${port}" =~ ^[0-9]+$ ]] || return 1
  (( 10#${port} >= 1024 && 10#${port} <= 65535 ))
}

phaser_read_configured_port() {
  local config_path="${1:-${PHASER_GAME_ROOT}/.coze}"
  [[ -f "${config_path}" ]] || {
    phaser_runtime_error ".coze is missing: ${config_path}"
    return 1
  }

  local port=""
  port="$(awk '
    /^[[:space:]]*\[project\][[:space:]]*(#.*)?$/ {
      in_project = 1
      next
    }
    /^[[:space:]]*\[[^]]+\][[:space:]]*(#.*)?$/ {
      if (in_project) exit
      next
    }
    in_project && /^[[:space:]]*port[[:space:]]*=/ {
      value = $0
      sub(/^[^=]*=/, "", value)
      sub(/[[:space:]]*#.*/, "", value)
      gsub(/[[:space:]_]/, "", value)
      print value
      exit
    }
  ' "${config_path}")" || return 1

  [[ -n "${port}" ]] || return 0
  if ! phaser_validate_port "${port}"; then
    phaser_runtime_error ".coze [project].port must be an integer from 1024 through 65535"
    return 1
  fi
  printf '%s\n' "${port//_/}"
}

phaser_record_server_state() {
  local kind="$1"
  local pid="$2"
  local log_dir="${PHASER_EXEC_ROOT}/logs"

  mkdir -p "${log_dir}"
  printf '%s\n' "${pid}" > "${log_dir}/phaser-server.pid"
  printf '%s\n' "${kind}" > "${log_dir}/phaser-server.kind"
  printf '%s\n' "${PHASER_PORT}" > "${log_dir}/phaser-server.port"
}

phaser_wait_for_server() {
  local port="$1"

  node -e '
    const net = require("node:net");
    const port = Number(process.argv[1]);
    const deadline = Date.now() + 5000;

    const sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds));

    const probe = () =>
      new Promise((resolve) => {
        const socket = net.createConnection({ host: "127.0.0.1", port });
        let settled = false;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          resolve(result);
        };
        socket.setTimeout(150, () => finish(false));
        socket.once("connect", () => finish(true));
        socket.once("error", () => finish(false));
      });

    (async () => {
      while (Date.now() < deadline) {
        if (await probe()) process.exit(0);
        await sleep(50);
      }
      process.exit(1);
    })();
  ' "${port}"
}

phaser_sync_lockfile_to_game_root() {
  local runtime_lockfile="${PHASER_EXEC_ROOT}/pnpm-lock.yaml"
  local game_lockfile="${PHASER_GAME_ROOT}/pnpm-lock.yaml"

  [[ -f "${runtime_lockfile}" ]] || {
    phaser_runtime_error "pnpm did not produce a lockfile"
    return 1
  }

  if cmp -s "${runtime_lockfile}" "${game_lockfile}"; then
    return 0
  fi

  local temporary_lockfile
  temporary_lockfile="$(mktemp "${PHASER_GAME_ROOT}/.pnpm-lock.yaml.tmp.XXXXXX")"
  if ! cp -f "${runtime_lockfile}" "${temporary_lockfile}"; then
    rm -f "${temporary_lockfile}"
    return 1
  fi
  mv -f "${temporary_lockfile}" "${game_lockfile}"
  echo "Updated canonical lockfile: ${game_lockfile}"
}

phaser_ensure_install() {
  command -v pnpm >/dev/null 2>&1 || {
    phaser_runtime_error "pnpm is required"
    return 1
  }

  (
    cd "${PHASER_EXEC_ROOT}"
    CI=1 COZE_PHASER_PREPARE_OK=1 pnpm install \
      --prefer-frozen-lockfile \
      --prefer-offline \
      --reporter=append-only
  )
  phaser_sync_lockfile_to_game_root
}

phaser_require_build() {
  [[ -f "${PHASER_EXEC_ROOT}/dist/index.html" ]] || {
    phaser_runtime_error "production build is missing; run scripts/build.sh first"
    return 1
  }
}
