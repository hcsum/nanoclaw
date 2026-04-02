import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';

import { readEnvFile } from './env.js';
import { logger } from './logger.js';

interface SkillResult {
  success: boolean;
  message: string;
  data?: unknown;
}

interface WebAccessIpcData {
  type?: string;
  requestId?: string;
  method?: string;
  endpoint?: string;
  query?: Record<string, unknown>;
  body?: string;
}

const RESULT_DIR_NAME = 'web_access_results';
const CHECK_DEPS_TIMEOUT_MS = 130_000;
const PROXY_REQUEST_TIMEOUT_MS = 30_000;
const PROXY_BASE_URL = 'http://127.0.0.1:3456';

function readWebAccessEnv(): Record<string, string> {
  const envFile = readEnvFile([
    'WEB_ACCESS_BROWSER_PORT',
    'WEB_ACCESS_BROWSER_DEVTOOLS_FILE',
    'WEB_ACCESS_BROWSER_PATH',
    'WEB_ACCESS_BROWSER_USER_DATA_DIR',
    'WEB_ACCESS_BROWSER_ARGS',
    'CDP_PROXY_PORT',
  ]);

  return {
    WEB_ACCESS_BROWSER_PORT:
      process.env.WEB_ACCESS_BROWSER_PORT ||
      envFile.WEB_ACCESS_BROWSER_PORT ||
      '',
    WEB_ACCESS_BROWSER_DEVTOOLS_FILE:
      process.env.WEB_ACCESS_BROWSER_DEVTOOLS_FILE ||
      envFile.WEB_ACCESS_BROWSER_DEVTOOLS_FILE ||
      '',
    WEB_ACCESS_BROWSER_PATH:
      process.env.WEB_ACCESS_BROWSER_PATH ||
      envFile.WEB_ACCESS_BROWSER_PATH ||
      '',
    WEB_ACCESS_BROWSER_USER_DATA_DIR:
      process.env.WEB_ACCESS_BROWSER_USER_DATA_DIR ||
      envFile.WEB_ACCESS_BROWSER_USER_DATA_DIR ||
      '',
    WEB_ACCESS_BROWSER_ARGS:
      process.env.WEB_ACCESS_BROWSER_ARGS ||
      envFile.WEB_ACCESS_BROWSER_ARGS ||
      '',
    CDP_PROXY_PORT: process.env.CDP_PROXY_PORT || envFile.CDP_PROXY_PORT || '',
  };
}

function webAccessSkillDir(): string {
  return path.join(process.cwd(), '.claude', 'skills', 'web-access');
}

function webAccessScriptPath(name: 'check-deps.sh' | 'cdp-proxy.mjs'): string {
  return path.join(webAccessSkillDir(), 'scripts', name);
}

function writeResult(
  dataDir: string,
  sourceGroup: string,
  requestId: string,
  result: SkillResult,
): void {
  const resultsDir = path.join(dataDir, 'ipc', sourceGroup, RESULT_DIR_NAME);
  fs.mkdirSync(resultsDir, { recursive: true });
  const resultPath = path.join(resultsDir, `${requestId}.json`);
  const tmpPath = `${resultPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(result));
  fs.renameSync(tmpPath, resultPath);
}

function formatCommandFailure(output: string, fallback: string): string {
  const text = output.trim();
  if (!text) return fallback;
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(-6).join('\n');
}

async function runCheckDeps(): Promise<SkillResult> {
  const scriptPath = webAccessScriptPath('check-deps.sh');
  if (!fs.existsSync(scriptPath)) {
    return {
      success: false,
      message: `Web Access setup script not found: ${scriptPath}`,
    };
  }

  return new Promise((resolve) => {
    const webAccessEnv = readWebAccessEnv();
    const proc = spawn('bash', [scriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...webAccessEnv,
        NANOCLAW_ROOT: process.cwd(),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        success: false,
        message: `Web Access setup timed out after ${Math.round(CHECK_DEPS_TIMEOUT_MS / 1000)}s`,
      });
    }, CHECK_DEPS_TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({
          success: true,
          message:
            formatCommandFailure(stdout, 'Web Access proxy is ready.') ||
            'Web Access proxy is ready.',
        });
        return;
      }

      resolve({
        success: false,
        message: formatCommandFailure(
          `${stderr}\n${stdout}`,
          `Web Access setup failed with code ${String(code)}`,
        ),
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        message: `Failed to start Web Access setup: ${err.message}`,
      });
    });
  });
}

function normalizeQuery(
  query: Record<string, unknown> = {},
): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      normalized[key] = String(value);
    }
  }

  return normalized;
}

async function checkProxyReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      `${PROXY_BASE_URL}/health`,
      { method: 'GET', timeout: 3_000 },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve(false);
            return;
          }

          try {
            const parsed = JSON.parse(data) as { status?: unknown };
            resolve(parsed.status === 'ok');
          } catch {
            resolve(false);
          }
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function ensureProxyReady(): Promise<SkillResult> {
  const proxyScriptPath = webAccessScriptPath('cdp-proxy.mjs');
  if (!fs.existsSync(proxyScriptPath)) {
    return {
      success: false,
      message: `Web Access proxy script not found: ${proxyScriptPath}`,
    };
  }

  if (await checkProxyReady()) {
    return { success: true, message: 'Web Access proxy is ready.' };
  }

  return runCheckDeps();
}

async function callProxy(
  method: string,
  endpoint: string,
  query: Record<string, unknown> = {},
  body = '',
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const readiness = await ensureProxyReady();
  if (!readiness.success) {
    return { success: false, error: readiness.message };
  }

  return new Promise((resolve) => {
    const url = new URL(endpoint, PROXY_BASE_URL);
    for (const [key, value] of Object.entries(normalizeQuery(query))) {
      url.searchParams.set(key, value);
    }

    const req = http.request(
      url,
      {
        method: method.toUpperCase(),
        timeout: PROXY_REQUEST_TIMEOUT_MS,
        headers: body
          ? {
              'Content-Type': 'text/plain',
              'Content-Length': Buffer.byteLength(body),
            }
          : undefined,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          let parsed: unknown = data;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }

          if ((res.statusCode || 500) >= 400) {
            const message =
              typeof parsed === 'object' &&
              parsed !== null &&
              'error' in parsed &&
              typeof (parsed as { error?: unknown }).error === 'string'
                ? (parsed as { error: string }).error
                : `Web Access proxy returned HTTP ${String(res.statusCode)}`;
            resolve({ success: false, error: message, data: parsed });
            return;
          }

          resolve({ success: true, data: parsed });
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Web Access proxy request timed out' });
    });
    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

export async function handleWebAccessIpc(
  data: WebAccessIpcData,
  sourceGroup: string,
  isMain: boolean,
  dataDir: string,
): Promise<boolean> {
  const type = data.type || '';
  if (!type.startsWith('web_access_')) return false;

  const requestId = data.requestId;
  if (!requestId) {
    logger.warn({ type, sourceGroup }, 'Web Access IPC task missing requestId');
    return true;
  }

  if (!isMain) {
    writeResult(dataDir, sourceGroup, requestId, {
      success: false,
      message: 'Only the main group can use Web Access tools.',
    });
    return true;
  }

  let result: SkillResult;

  switch (type) {
    case 'web_access_call': {
      if (!data.method || !data.endpoint) {
        result = { success: false, message: 'Missing method or endpoint' };
        break;
      }

      const proxyResult = await callProxy(
        data.method,
        data.endpoint,
        data.query,
        data.body || '',
      );

      result = proxyResult.success
        ? {
            success: true,
            message: 'Web Access call successful',
            data: proxyResult.data,
          }
        : {
            success: false,
            message: proxyResult.error || 'Web Access call failed',
            data: proxyResult.data,
          };
      break;
    }
    default:
      result = {
        success: false,
        message: `Unknown Web Access task type: ${type}`,
      };
      break;
  }

  writeResult(dataDir, sourceGroup, requestId, result);

  if (result.success) {
    logger.info(
      { type, sourceGroup, requestId },
      'Web Access IPC task completed',
    );
  } else {
    logger.warn(
      { type, sourceGroup, requestId, message: result.message },
      'Web Access IPC task failed',
    );
  }

  return true;
}
