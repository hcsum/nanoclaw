#!/usr/bin/env bash

if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node --version 2>/dev/null)
  NODE_MAJOR=$(printf '%s' "$NODE_VER" | cut -c2- | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 22 ] 2>/dev/null; then
    echo "node: ok ($NODE_VER)"
  else
    echo "node: warn ($NODE_VER, recommended 22+)"
  fi
else
  echo "node: missing - install Node.js 22+"
  exit 1
fi

start_dedicated_browser() {
  if [ -z "${WEB_ACCESS_BROWSER_PATH:-}" ]; then
    return 1
  fi

  if [ ! -x "$WEB_ACCESS_BROWSER_PATH" ]; then
    echo "browser: configured binary is not executable: $WEB_ACCESS_BROWSER_PATH"
    exit 1
  fi

  if [ -z "${WEB_ACCESS_BROWSER_PORT:-}" ]; then
    echo "browser: auto-start requires WEB_ACCESS_BROWSER_PORT"
    exit 1
  fi

  USER_DATA_DIR="${WEB_ACCESS_BROWSER_USER_DATA_DIR:-}"
  if [ -z "$USER_DATA_DIR" ] && [ -n "${WEB_ACCESS_BROWSER_DEVTOOLS_FILE:-}" ]; then
    USER_DATA_DIR=$(dirname "$WEB_ACCESS_BROWSER_DEVTOOLS_FILE")
  fi

  if [ -z "$USER_DATA_DIR" ]; then
    echo "browser: auto-start requires WEB_ACCESS_BROWSER_USER_DATA_DIR or WEB_ACCESS_BROWSER_DEVTOOLS_FILE"
    exit 1
  fi

  mkdir -p "$USER_DATA_DIR"

  EXTRA_ARGS="${WEB_ACCESS_BROWSER_ARGS:-}"

  if [ -n "$EXTRA_ARGS" ]; then
    EXTRA_ARGS="$EXTRA_ARGS --remote-debugging-port=$WEB_ACCESS_BROWSER_PORT --user-data-dir=$USER_DATA_DIR"
  else
    EXTRA_ARGS="--remote-debugging-port=$WEB_ACCESS_BROWSER_PORT --user-data-dir=$USER_DATA_DIR"
  fi

  case "$(uname -s)" in
    Darwin)
      APP_BUNDLE=${WEB_ACCESS_BROWSER_PATH%/Contents/MacOS/*}
      if [ -d "$APP_BUNDLE" ]; then
        APP_BUNDLE="$APP_BUNDLE" EXTRA_ARGS="$EXTRA_ARGS" node -e "
const { spawn } = require('child_process');

const appBundle = process.env.APP_BUNDLE;
const extraArgs = process.env.EXTRA_ARGS || '';
const args = extraArgs.match(/(?:[^\s\"']+|\"[^\"]*\"|'[^']*')+/g) || [];
const normalized = args.map((arg) => {
  if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
    return arg.slice(1, -1);
  }
  return arg;
});

const child = spawn('open', ['-na', appBundle, '--args', ...normalized], {
  detached: true,
  stdio: 'ignore',
});
child.unref();
" >/dev/null 2>&1
        echo "browser: starting dedicated debug browser on port $WEB_ACCESS_BROWSER_PORT"
        return 0
      fi
      ;;
  esac

  EXTRA_ARGS="$EXTRA_ARGS" node -e "
const { spawn } = require('child_process');

const command = process.env.WEB_ACCESS_BROWSER_PATH;
const extraArgs = process.env.EXTRA_ARGS || '';
const args = extraArgs.match(/(?:[^\s\"']+|\"[^\"]*\"|'[^']*')+/g) || [];
const normalized = args.map((arg) => {
  if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
    return arg.slice(1, -1);
  }
  return arg;
});

const child = spawn(command, normalized, {
  detached: true,
  stdio: 'ignore',
});
child.unref();
" >/dev/null 2>&1

  echo "browser: starting dedicated debug browser on port $WEB_ACCESS_BROWSER_PORT"
  return 0
}

if ! CHROME_PORT=$(node -e "
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection(port, '127.0.0.1');
    const timer = setTimeout(() => { socket.destroy(); resolve(false); }, 2000);
    socket.once('connect', () => { clearTimeout(timer); socket.destroy(); resolve(true); });
    socket.once('error', () => { clearTimeout(timer); resolve(false); });
  });
}

function activePortFiles() {
  const configured = process.env.WEB_ACCESS_BROWSER_DEVTOOLS_FILE || '';
  if (configured) {
    return uniq([configured]);
  }
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || '';
  switch (process.platform) {
    case 'darwin':
      return uniq([
        configured,
        path.join(home, 'Library/Application Support/Google/Chrome/DevToolsActivePort'),
        path.join(home, 'Library/Application Support/Google/Chrome Canary/DevToolsActivePort'),
        path.join(home, 'Library/Application Support/Chromium/DevToolsActivePort'),
      ]);
    case 'linux':
      return uniq([
        configured,
        path.join(home, '.config/google-chrome/DevToolsActivePort'),
        path.join(home, '.config/chromium/DevToolsActivePort'),
      ]);
    case 'win32':
      return uniq([
        configured,
        path.join(localAppData, 'Google/Chrome/User Data/DevToolsActivePort'),
        path.join(localAppData, 'Chromium/User Data/DevToolsActivePort'),
      ]);
    default:
      return uniq([configured]);
  }
}

function configuredPorts() {
  const raw = process.env.WEB_ACCESS_BROWSER_PORT || '';
  const port = parseInt(raw, 10);
  if (Number.isInteger(port) && port > 0 && port < 65536) {
    return [port];
  }
  return [];
}

(async () => {
  for (const filePath of activePortFiles()) {
    try {
      const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\\r?\\n/).filter(Boolean);
      const port = parseInt(lines[0], 10);
      if (port > 0 && port < 65536 && await checkPort(port)) {
        console.log(port);
        process.exit(0);
      }
    } catch (_) {}
  }

  const ports = configuredPorts();
  const candidates = ports.length > 0 ? ports : [9222, 9229, 9333];

  for (const port of uniq(candidates)) {
    if (await checkPort(port)) {
      console.log(port);
      process.exit(0);
    }
  }

  process.exit(1);
})();
" 2>/dev/null); then
  start_dedicated_browser

  i=1
  while [ "$i" -le 20 ]; do
    if CHROME_PORT=$(node -e "
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection(port, '127.0.0.1');
    const timer = setTimeout(() => { socket.destroy(); resolve(false); }, 2000);
    socket.once('connect', () => { clearTimeout(timer); socket.destroy(); resolve(true); });
    socket.once('error', () => { clearTimeout(timer); resolve(false); });
  });
}

function activePortFiles() {
  const configured = process.env.WEB_ACCESS_BROWSER_DEVTOOLS_FILE || '';
  if (configured) {
    return uniq([configured]);
  }
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || '';
  switch (process.platform) {
    case 'darwin':
      return uniq([
        configured,
        path.join(home, 'Library/Application Support/Google/Chrome/DevToolsActivePort'),
        path.join(home, 'Library/Application Support/Google/Chrome Canary/DevToolsActivePort'),
        path.join(home, 'Library/Application Support/Chromium/DevToolsActivePort'),
      ]);
    case 'linux':
      return uniq([
        configured,
        path.join(home, '.config/google-chrome/DevToolsActivePort'),
        path.join(home, '.config/chromium/DevToolsActivePort'),
      ]);
    case 'win32':
      return uniq([
        configured,
        path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/User Data/DevToolsActivePort'),
        path.join(process.env.LOCALAPPDATA || '', 'Chromium/User Data/DevToolsActivePort'),
      ]);
    default:
      return uniq([configured]);
  }
}

function configuredPorts() {
  const raw = process.env.WEB_ACCESS_BROWSER_PORT || '';
  const port = parseInt(raw, 10);
  if (Number.isInteger(port) && port > 0 && port < 65536) {
    return [port];
  }
  return [];
}

(async () => {
  for (const filePath of activePortFiles()) {
    try {
      const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\\r?\\n/).filter(Boolean);
      const port = parseInt(lines[0], 10);
      if (port > 0 && port < 65536 && await checkPort(port)) {
        console.log(port);
        process.exit(0);
      }
    } catch (_) {}
  }

  const ports = configuredPorts();
  const candidates = ports.length > 0 ? ports : [9222, 9229, 9333];

  for (const port of uniq(candidates)) {
    if (await checkPort(port)) {
      console.log(port);
      process.exit(0);
    }
  }

  process.exit(1);
})();
" 2>/dev/null); then
      break
    fi
    sleep 1
    i=$((i + 1))
  done

  if [ -z "$CHROME_PORT" ]; then
    echo "browser: not connected - start a browser remote-debugging instance or set WEB_ACCESS_BROWSER_PORT"
    exit 1
  fi
fi
echo "browser: ok (port $CHROME_PORT)"

HEALTH=$(curl -s --connect-timeout 3 "http://127.0.0.1:3456/health" 2>/dev/null)
case "$HEALTH" in
  *'"ok"'* )
    echo "proxy: ready"
    exit 0
    ;;
esac

echo "proxy: connecting..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/cdp-proxy.mjs" >/tmp/cdp-proxy.log 2>&1 &
sleep 2

i=1
while [ "$i" -le 15 ]; do
  HEALTH=$(curl -s --connect-timeout 5 --max-time 8 "http://127.0.0.1:3456/health" 2>/dev/null)
  case "$HEALTH" in
    *'"ok"'* )
      echo "proxy: ready"
      exit 0
      ;;
  esac

  if [ "$i" -eq 1 ]; then
    echo "if the browser shows an authorization prompt, allow it and wait"
  fi
  i=$((i + 1))
done

echo "proxy connection timed out; check browser remote debugging settings or WEB_ACCESS_BROWSER_*"
exit 1
