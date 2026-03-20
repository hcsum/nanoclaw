import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { readEnvFile } from './env.js';
import { logger } from './logger.js';

export interface BrowserUseResult {
  success: boolean;
  message: string;
  data?: unknown;
}

interface BrowserUseIpcData {
  type?: string;
  requestId?: string;
  targetRequestId?: string;
  goal?: string;
  startUrl?: string;
  maxSteps?: number;
  chatJid?: string;
}

const RESULT_DIR_NAME = 'browser_use_results';
const SCRIPT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_MODEL = 'gpt-4.1';
const DEFAULT_MAX_STEPS = 30;
const MAX_ALLOWED_STEPS = 100;
const STATUS_DIR = path.join(process.cwd(), 'data', 'browser-use');
const activeBrowserUseProcesses = new Map<string, ChildProcess>();

interface BrowserUseStatusRecord {
  requestId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  updatedAt: string;
  chatJid?: string;
  goal?: string;
  startUrl?: string;
  maxSteps?: number;
  pid?: number;
  message?: string;
  data?: unknown;
}

interface BrowserUseCompletionData {
  summary?: unknown;
  findings?: unknown;
  sources?: unknown;
  notes?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readBrowserUseEnv(): Record<string, string> {
  const envFile = readEnvFile([
    'BROWSER_USE_OPENAI_API_KEY',
    'BROWSER_USE_OPENAI_MODEL',
    'BROWSER_USE_OPENAI_API_MODE',
    'BROWSER_USE_BASE_URL',
    'BROWSER_USE_HEADLESS',
    'BROWSER_USE_MAX_STEPS',
    'BROWSER_USE_USER_DATA_DIR',
    'BROWSER_USE_PROXY_SERVER',
    'BROWSER_USE_PROXY_BYPASS',
    'BROWSER_USE_PROXY_USERNAME',
    'BROWSER_USE_PROXY_PASSWORD',
    'BROWSER_USE_PYTHON',
    'BROWSER_USE_REFERENCE_DIR',
    'BROWSER_USE_LOGIN_URL',
  ]);

  return {
    BROWSER_USE_OPENAI_API_KEY:
      process.env.BROWSER_USE_OPENAI_API_KEY ||
      envFile.BROWSER_USE_OPENAI_API_KEY ||
      '',
    BROWSER_USE_OPENAI_MODEL:
      process.env.BROWSER_USE_OPENAI_MODEL ||
      envFile.BROWSER_USE_OPENAI_MODEL ||
      DEFAULT_MODEL,
    BROWSER_USE_OPENAI_API_MODE:
      process.env.BROWSER_USE_OPENAI_API_MODE ||
      envFile.BROWSER_USE_OPENAI_API_MODE ||
      'responses',
    BROWSER_USE_BASE_URL:
      process.env.BROWSER_USE_BASE_URL || envFile.BROWSER_USE_BASE_URL || '',
    BROWSER_USE_HEADLESS:
      process.env.BROWSER_USE_HEADLESS ||
      envFile.BROWSER_USE_HEADLESS ||
      'false',
    BROWSER_USE_MAX_STEPS:
      process.env.BROWSER_USE_MAX_STEPS ||
      envFile.BROWSER_USE_MAX_STEPS ||
      String(DEFAULT_MAX_STEPS),
    BROWSER_USE_USER_DATA_DIR:
      process.env.BROWSER_USE_USER_DATA_DIR ||
      envFile.BROWSER_USE_USER_DATA_DIR ||
      path.join(process.cwd(), 'data', 'browser-use-profile'),
    BROWSER_USE_PROXY_SERVER:
      process.env.BROWSER_USE_PROXY_SERVER ||
      envFile.BROWSER_USE_PROXY_SERVER ||
      process.env.ALL_PROXY ||
      process.env.all_proxy ||
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy ||
      '',
    BROWSER_USE_PROXY_BYPASS:
      process.env.BROWSER_USE_PROXY_BYPASS ||
      envFile.BROWSER_USE_PROXY_BYPASS ||
      process.env.NO_PROXY ||
      process.env.no_proxy ||
      '',
    BROWSER_USE_PROXY_USERNAME:
      process.env.BROWSER_USE_PROXY_USERNAME ||
      envFile.BROWSER_USE_PROXY_USERNAME ||
      '',
    BROWSER_USE_PROXY_PASSWORD:
      process.env.BROWSER_USE_PROXY_PASSWORD ||
      envFile.BROWSER_USE_PROXY_PASSWORD ||
      '',
    BROWSER_USE_PYTHON:
      process.env.BROWSER_USE_PYTHON || envFile.BROWSER_USE_PYTHON || '',
    BROWSER_USE_REFERENCE_DIR:
      process.env.BROWSER_USE_REFERENCE_DIR ||
      envFile.BROWSER_USE_REFERENCE_DIR ||
      path.resolve(process.cwd(), '..', 'browser-use'),
    BROWSER_USE_LOGIN_URL:
      process.env.BROWSER_USE_LOGIN_URL ||
      envFile.BROWSER_USE_LOGIN_URL ||
      'https://www.google.com/',
  };
}

function resolveBrowserUsePython(env: Record<string, string>): string | null {
  const candidates = [
    env.BROWSER_USE_PYTHON,
    path.join(env.BROWSER_USE_REFERENCE_DIR, '.venv', 'bin', 'python'),
    path.join(process.cwd(), '.venv', 'bin', 'python'),
    'python3',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === 'python3') return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function browserUseScriptPath(): string {
  return path.join(
    process.cwd(),
    '.claude',
    'skills',
    'browser-use',
    'scripts',
    'run_browser_use.py',
  );
}

function writeResult(
  dataDir: string,
  sourceGroup: string,
  requestId: string,
  result: BrowserUseResult,
): void {
  const resultsDir = path.join(dataDir, 'ipc', sourceGroup, RESULT_DIR_NAME);
  fs.mkdirSync(resultsDir, { recursive: true });
  const resultPath = path.join(resultsDir, `${requestId}.json`);
  const tmpPath = `${resultPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(result));
  fs.renameSync(tmpPath, resultPath);
}

function ensureStatusDir(): void {
  fs.mkdirSync(STATUS_DIR, { recursive: true });
}

function statusFilePath(requestId: string): string {
  ensureStatusDir();
  return path.join(STATUS_DIR, `${requestId}.json`);
}

function writeStatus(record: BrowserUseStatusRecord): void {
  const filePath = statusFilePath(record.requestId);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(record, null, 2));
  fs.renameSync(tmpPath, filePath);
}

function readStatus(requestId: string): BrowserUseStatusRecord | null {
  const filePath = statusFilePath(requestId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(
      fs.readFileSync(filePath, 'utf-8'),
    ) as BrowserUseStatusRecord;
  } catch {
    return null;
  }
}

function writeHostMessage(
  dataDir: string,
  sourceGroup: string,
  chatJid: string,
  text: string,
): void {
  const messagesDir = path.join(dataDir, 'ipc', sourceGroup, 'messages');
  fs.mkdirSync(messagesDir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filepath = path.join(messagesDir, filename);
  const tmpPath = `${filepath}.tmp`;
  fs.writeFileSync(
    tmpPath,
    JSON.stringify({
      type: 'message',
      chatJid,
      text,
      groupFolder: sourceGroup,
      timestamp: new Date().toISOString(),
    }),
  );
  fs.renameSync(tmpPath, filepath);
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

async function runBrowserUseCommand(
  mode: 'login' | 'research',
  payload: Record<string, unknown>,
  options?: { interactive?: boolean; timeoutMs?: number },
): Promise<BrowserUseResult> {
  const env = readBrowserUseEnv();
  const python = resolveBrowserUsePython(env);
  if (!python) {
    return {
      success: false,
      message:
        'Unable to find a Python interpreter for browser-use. Set BROWSER_USE_PYTHON or install ../browser-use/.venv.',
    };
  }

  const scriptPath = browserUseScriptPath();
  if (!fs.existsSync(scriptPath)) {
    return {
      success: false,
      message: `browser-use script not found: ${scriptPath}`,
    };
  }

  const mergedEnv = {
    ...process.env,
    ...env,
    NANOCLAW_ROOT: process.cwd(),
  };

  return new Promise((resolve) => {
    const argv = [scriptPath, mode];
    if (options?.interactive && typeof payload.startUrl === 'string') {
      argv.push(payload.startUrl);
    }

    const proc = spawn(python, argv, {
      cwd: process.cwd(),
      env: mergedEnv,
      stdio: options?.interactive ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    if (!options?.interactive) {
      proc.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      proc.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.stdin?.write(JSON.stringify(payload));
      proc.stdin?.end();
    }

    const timeoutMs =
      options?.interactive === true ? undefined : options?.timeoutMs;
    const timer =
      timeoutMs != null
        ? setTimeout(() => {
            proc.kill('SIGTERM');
            resolve({
              success: false,
              message: `browser-use ${mode} timed out after ${Math.round(timeoutMs / 1000)}s`,
            });
          }, timeoutMs)
        : null;

    proc.on('close', (code) => {
      if (timer) clearTimeout(timer);

      if (options?.interactive) {
        resolve({
          success: code === 0,
          message:
            code === 0
              ? 'browser-use login flow completed.'
              : `browser-use login flow exited with code ${String(code)}`,
        });
        return;
      }

      if (code !== 0) {
        resolve({
          success: false,
          message:
            stderr.trim() ||
            `browser-use ${mode} exited with code ${String(code)}`,
        });
        return;
      }

      try {
        const lines = stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        const lastLine = lines[lines.length - 1];
        if (!lastLine) {
          resolve({
            success: false,
            message: `browser-use ${mode} produced empty output`,
          });
          return;
        }
        resolve(JSON.parse(lastLine) as BrowserUseResult);
      } catch {
        resolve({
          success: false,
          message: `Failed to parse browser-use output: ${stdout.trim().slice(0, 400)}`,
        });
      }
    });

    proc.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({
        success: false,
        message: `Failed to start browser-use ${mode}: ${err.message}`,
      });
    });
  });
}

function spawnBrowserUseResearchProcess(
  requestId: string,
  payload: Record<string, unknown>,
): { proc: ChildProcess; error?: string } {
  const env = readBrowserUseEnv();
  const python = resolveBrowserUsePython(env);
  if (!python) {
    return {
      proc: null as unknown as ChildProcess,
      error:
        'Unable to find a Python interpreter for browser-use. Set BROWSER_USE_PYTHON or install ../browser-use/.venv.',
    };
  }

  const scriptPath = browserUseScriptPath();
  if (!fs.existsSync(scriptPath)) {
    return {
      proc: null as unknown as ChildProcess,
      error: `browser-use script not found: ${scriptPath}`,
    };
  }

  const mergedEnv = {
    ...process.env,
    ...env,
    NANOCLAW_ROOT: process.cwd(),
  };

  const proc = spawn(python, [scriptPath, 'research'], {
    cwd: process.cwd(),
    env: mergedEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  proc.stdin?.write(JSON.stringify(payload));
  proc.stdin?.end();
  activeBrowserUseProcesses.set(requestId, proc);

  return { proc };
}

function parseBrowserUseStdout(stdout: string): BrowserUseResult {
  try {
    const lines = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const lastLine = lines[lines.length - 1];
    if (!lastLine) {
      return {
        success: false,
        message: 'browser-use research produced empty output',
      };
    }
    return JSON.parse(lastLine) as BrowserUseResult;
  } catch {
    return {
      success: false,
      message: `Failed to parse browser-use output: ${stdout.trim().slice(0, 400)}`,
    };
  }
}

function formatCompletionMessage(
  requestId: string,
  result: BrowserUseResult,
): string {
  const prefix = `browser-use task ${requestId}`;
  if (!result.success) {
    return `${prefix} failed.\n\n${result.message}`;
  }

  if (!isRecord(result.data)) {
    return `${prefix} completed.\n\n${result.message}`;
  }

  const data = result.data as BrowserUseCompletionData;
  const lines: string[] = [`${prefix} completed.`];

  const summary =
    typeof data.summary === 'string' && data.summary.trim()
      ? data.summary.trim()
      : result.message;
  if (summary) {
    lines.push('', summary);
  }

  if (Array.isArray(data.findings) && data.findings.length > 0) {
    lines.push('', 'Key findings:');
    for (const item of data.findings) {
      if (typeof item === 'string' && item.trim()) {
        lines.push(`• ${item.trim()}`);
      }
    }
  }

  if (Array.isArray(data.sources) && data.sources.length > 0) {
    lines.push('', 'Sources:');
    for (const item of data.sources) {
      if (isRecord(item)) {
        const title =
          typeof item.title === 'string' && item.title.trim()
            ? item.title.trim()
            : null;
        const url =
          typeof item.url === 'string' && item.url.trim()
            ? item.url.trim()
            : null;
        if (title && url) {
          lines.push(`• ${title}: ${url}`);
        } else if (url) {
          lines.push(`• ${url}`);
        } else if (title) {
          lines.push(`• ${title}`);
        }
      } else if (typeof item === 'string' && item.trim()) {
        lines.push(`• ${item.trim()}`);
      }
    }
  }

  if (Array.isArray(data.notes) && data.notes.length > 0) {
    lines.push('', 'Notes:');
    for (const item of data.notes) {
      if (typeof item === 'string' && item.trim()) {
        lines.push(`• ${item.trim()}`);
      }
    }
  }

  return lines.join('\n');
}

export async function startBrowserUseLoginSession(
  startUrl?: string,
): Promise<BrowserUseResult> {
  return runBrowserUseCommand(
    'login',
    { startUrl: startUrl || readBrowserUseEnv().BROWSER_USE_LOGIN_URL },
    { interactive: true },
  );
}

export async function handleBrowserUseIpc(
  data: BrowserUseIpcData,
  sourceGroup: string,
  isMain: boolean,
  dataDir: string,
): Promise<boolean> {
  if (
    data.type !== 'browser_use_research' &&
    data.type !== 'browser_use_status' &&
    data.type !== 'browser_use_cancel'
  ) {
    return false;
  }

  const requestId = data.requestId;
  if (!requestId) {
    logger.warn({ sourceGroup }, 'browser-use IPC task missing requestId');
    return true;
  }

  if (!isMain) {
    writeResult(dataDir, sourceGroup, requestId, {
      success: false,
      message: 'Only the main group can use browser-use research.',
    });
    return true;
  }

  if (data.type === 'browser_use_status') {
    const targetRequestId = data.targetRequestId?.trim();
    if (!targetRequestId) {
      writeResult(dataDir, sourceGroup, requestId, {
        success: false,
        message: 'Missing targetRequestId.',
      });
      return true;
    }

    const status = readStatus(targetRequestId);
    writeResult(dataDir, sourceGroup, requestId, {
      success: status != null,
      message:
        status != null
          ? `browser-use task ${targetRequestId} is ${status.status}.`
          : `browser-use task ${targetRequestId} was not found.`,
      data: status ?? undefined,
    });
    return true;
  }

  if (data.type === 'browser_use_cancel') {
    const targetRequestId = data.targetRequestId?.trim();
    if (!targetRequestId) {
      writeResult(dataDir, sourceGroup, requestId, {
        success: false,
        message: 'Missing targetRequestId.',
      });
      return true;
    }

    const proc = activeBrowserUseProcesses.get(targetRequestId);
    const existing = readStatus(targetRequestId);
    if (!proc || !existing || existing.status !== 'running') {
      writeResult(dataDir, sourceGroup, requestId, {
        success: false,
        message: `browser-use task ${targetRequestId} is not running.`,
        data: existing ?? undefined,
      });
      return true;
    }

    proc.kill('SIGTERM');
    activeBrowserUseProcesses.delete(targetRequestId);
    const cancelled: BrowserUseStatusRecord = {
      ...existing,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
      message: 'Cancelled by user request.',
    };
    writeStatus(cancelled);
    writeResult(dataDir, sourceGroup, requestId, {
      success: true,
      message: `Cancellation requested for browser-use task ${targetRequestId}.`,
      data: cancelled,
    });
    return true;
  }

  if (!data.goal || !data.goal.trim()) {
    writeResult(dataDir, sourceGroup, requestId, {
      success: false,
      message: 'Missing research goal.',
    });
    return true;
  }

  const env = readBrowserUseEnv();
  const defaultMaxSteps = parsePositiveInteger(
    env.BROWSER_USE_MAX_STEPS,
    DEFAULT_MAX_STEPS,
  );
  const requestedMaxSteps = parsePositiveInteger(
    data.maxSteps,
    defaultMaxSteps,
  );
  const maxSteps = Math.min(requestedMaxSteps, MAX_ALLOWED_STEPS);

  const initialStatus: BrowserUseStatusRecord = {
    requestId,
    status: 'running',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chatJid: data.chatJid,
    goal: data.goal.trim(),
    startUrl: data.startUrl?.trim() || undefined,
    maxSteps,
  };
  writeStatus(initialStatus);

  const started = spawnBrowserUseResearchProcess(requestId, {
    goal: data.goal.trim(),
    startUrl: data.startUrl?.trim() || undefined,
    maxSteps,
  });

  if (started.error) {
    const failedStatus: BrowserUseStatusRecord = {
      ...initialStatus,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      message: started.error,
    };
    writeStatus(failedStatus);
    writeResult(dataDir, sourceGroup, requestId, {
      success: false,
      message: started.error,
      data: failedStatus,
    });
    return true;
  }

  const proc = started.proc;
  initialStatus.pid = proc.pid ?? undefined;
  writeStatus(initialStatus);

  let stdout = '';
  let stderr = '';
  proc.stdout?.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  proc.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const timeout = setTimeout(() => {
    proc.kill('SIGTERM');
  }, SCRIPT_TIMEOUT_MS);

  proc.on('close', (code) => {
    clearTimeout(timeout);
    activeBrowserUseProcesses.delete(requestId);

    const current = readStatus(requestId) || initialStatus;
    if (current.status === 'cancelled') {
      if (current.chatJid) {
        writeHostMessage(
          dataDir,
          sourceGroup,
          current.chatJid,
          `browser-use task ${requestId} was cancelled.`,
        );
      }
      return;
    }

    const result =
      code === 0
        ? parseBrowserUseStdout(stdout)
        : {
            success: false,
            message:
              stderr.trim() ||
              `browser-use research exited with code ${String(code)}`,
          };

    const finalStatus: BrowserUseStatusRecord = {
      ...current,
      status: result.success ? 'completed' : 'failed',
      updatedAt: new Date().toISOString(),
      message: result.message,
      data: result.data,
    };
    writeStatus(finalStatus);

    if (current.chatJid) {
      writeHostMessage(
        dataDir,
        sourceGroup,
        current.chatJid,
        formatCompletionMessage(requestId, result),
      );
    }

    if (result.success) {
      logger.info(
        { sourceGroup, requestId, maxSteps },
        'browser-use background task completed',
      );
    } else {
      logger.warn(
        { sourceGroup, requestId, maxSteps, message: result.message },
        'browser-use background task failed',
      );
    }
  });

  writeResult(dataDir, sourceGroup, requestId, {
    success: true,
    message: `Started browser-use task ${requestId}. I will send the results when it finishes.`,
    data: {
      request_id: requestId,
      status: 'running',
      max_steps: maxSteps,
    },
  });
  return true;
}
