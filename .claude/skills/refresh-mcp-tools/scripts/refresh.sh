#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
SRC_DIR="$ROOT/container/agent-runner/src"
SESSIONS_DIR="$ROOT/data/sessions"
SYNC_ONLY="${1:-}"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "Source directory not found: $SRC_DIR" >&2
  exit 1
fi

echo "Project root: $ROOT"
echo "Sync source: ${SRC_DIR#$ROOT/}"

synced=0
if [[ -d "$SESSIONS_DIR" ]]; then
  while IFS= read -r -d '' session_dir; do
    dst="$session_dir/agent-runner-src"
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

if [[ "$SYNC_ONLY" == "--sync-only" ]]; then
  echo "Sync complete (no restart requested)."
  exit 0
fi

echo "Restarting NanoClaw service..."
case "$(uname -s)" in
  Darwin)
    launchctl kickstart -k "gui/$(id -u)/com.nanoclaw"
    ;;
  Linux)
    if command -v systemctl >/dev/null 2>&1; then
      if [[ "$(id -u)" -eq 0 ]]; then
        systemctl restart nanoclaw
      else
        systemctl --user restart nanoclaw
      fi
    elif [[ -x "$ROOT/start-nanoclaw.sh" ]]; then
      "$ROOT/start-nanoclaw.sh"
    else
      echo "No supported service manager found (systemctl/start-nanoclaw.sh)." >&2
      exit 1
    fi
    ;;
  *)
    if [[ -x "$ROOT/start-nanoclaw.sh" ]]; then
      "$ROOT/start-nanoclaw.sh"
    else
      echo "Unsupported platform and no fallback script found." >&2
      exit 1
    fi
    ;;
esac

echo "Done. Send one test message to Andy to force a fresh container run."
