#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SRC_DIR="$ROOT/container/agent-runner/src"
SESSIONS_DIR="$ROOT/data/sessions"
IPC_FILE="$SRC_DIR/ipc-mcp-stdio.ts"

sync_only=0
tool_name=""

usage() {
  cat <<'EOF'
Usage: bash .claude/skills/refresh-mcp-tools/refresh.sh [--sync-only] [--tool-name NAME]

Options:
  --sync-only       Sync cached session sources without restarting NanoClaw
  --tool-name NAME  Check that NAME appears in ipc-mcp-stdio.ts before syncing
  -h, --help        Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sync-only)
      sync_only=1
      shift
      ;;
    --tool-name)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --tool-name" >&2
        usage >&2
        exit 1
      fi
      tool_name="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$SRC_DIR" ]]; then
  echo "Source directory not found: $SRC_DIR" >&2
  exit 1
fi

if [[ -n "$tool_name" ]]; then
  if [[ ! -f "$IPC_FILE" ]]; then
    echo "MCP registry file not found: $IPC_FILE" >&2
    exit 1
  fi

  if ! rg -n --fixed-strings "$tool_name" "$IPC_FILE" >/dev/null; then
    echo "Tool name '$tool_name' was not found in ${IPC_FILE#$ROOT/}." >&2
    echo "Check the tool registration before refreshing session caches." >&2
    exit 1
  fi

  echo "Confirmed '$tool_name' exists in ${IPC_FILE#$ROOT/}."
fi

echo "Project root: $ROOT"
echo "Sync source: ${SRC_DIR#$ROOT/}"

synced=0
if [[ -d "$SESSIONS_DIR" ]]; then
  while IFS= read -r -d '' session_dir; do
    dst="$session_dir/agent-runner-src"
    mkdir -p "$dst"
    rm -rf "$dst"
    mkdir -p "$dst"
    cp -R "$SRC_DIR"/. "$dst"/
    echo "Synced: ${dst#$ROOT/}"
    synced=$((synced + 1))
  done < <(find "$SESSIONS_DIR" -mindepth 1 -maxdepth 1 -type d -print0)
fi

if [[ "$synced" -eq 0 ]]; then
  echo "No session folders found in ${SESSIONS_DIR#$ROOT/}."
  echo "Create a conversation first, then run this again."
fi

if [[ "$sync_only" -eq 1 ]]; then
  echo "Sync complete (no restart requested)."
  exit 0
fi

echo "Restarting NanoClaw service..."
restart_hint=""
case "$(uname -s)" in
  Darwin)
    restart_hint="launchctl kickstart -k gui/$(id -u)/com.nanoclaw"
    $restart_hint
    ;;
  Linux)
    if command -v systemctl >/dev/null 2>&1; then
      if [[ "$(id -u)" -eq 0 ]]; then
        restart_hint="systemctl restart nanoclaw"
      else
        restart_hint="systemctl --user restart nanoclaw"
      fi
      $restart_hint
    elif [[ -x "$ROOT/start-nanoclaw.sh" ]]; then
      restart_hint="$ROOT/start-nanoclaw.sh"
      "$ROOT/start-nanoclaw.sh"
    else
      echo "No supported service manager found (systemctl/start-nanoclaw.sh)." >&2
      exit 1
    fi
    ;;
  *)
    if [[ -x "$ROOT/start-nanoclaw.sh" ]]; then
      restart_hint="$ROOT/start-nanoclaw.sh"
      "$ROOT/start-nanoclaw.sh"
    else
      echo "Unsupported platform and no fallback script found." >&2
      exit 1
    fi
    ;;
esac

echo "Done."
echo "Next: send one test message to Andy to force a fresh container run."
echo "If the tool is still missing, ask Andy to call mcp__nanoclaw__<tool_name> directly."
if [[ -n "$restart_hint" ]]; then
  echo "If restart permissions failed, run this manually: $restart_hint"
fi
