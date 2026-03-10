/**
 * Web.Cafe Integration IPC Handler
 *
 * Handles all web_cafe_* IPC messages from container agents.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: { target: 'pino-pretty', options: { colorize: true } },
});

interface SkillResult {
  success: boolean;
  message: string;
  data?: unknown;
}

// Run a skill script as subprocess
async function runScript(script: string, args: object): Promise<SkillResult> {
  const scriptPath = path.join(
    process.cwd(),
    '.claude',
    'skills',
    'web-cafe',
    'scripts',
    `${script}.ts`,
  );

  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env, NANOCLAW_ROOT: process.cwd() },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stdin.write(JSON.stringify(args));
    proc.stdin.end();

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({ success: false, message: 'Script timed out (120s)' });
    }, 120000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ success: false, message: `Script exited with code: ${code}` });
        return;
      }
      try {
        const lines = stdout.trim().split('\n');
        resolve(JSON.parse(lines[lines.length - 1]));
      } catch {
        resolve({ success: false, message: `Failed to parse output: ${stdout.slice(0, 200)}` });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, message: `Failed to spawn: ${err.message}` });
    });
  });
}

// Write result to IPC results directory
function writeResult(
  dataDir: string,
  sourceGroup: string,
  requestId: string,
  result: SkillResult,
): void {
  const resultsDir = path.join(dataDir, 'ipc', sourceGroup, 'web_cafe_results');
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(resultsDir, `${requestId}.json`), JSON.stringify(result));
}

/**
 * Handle Web.Cafe integration IPC messages
 *
 * @returns true if message was handled, false if not a web_cafe message
 */
export async function handleWebCafeIpc(
  data: Record<string, unknown>,
  sourceGroup: string,
  isMain: boolean,
  dataDir: string,
): Promise<boolean> {
  const type = data.type as string;

  // Only handle web_cafe_* types
  if (!type?.startsWith('web_cafe_')) {
    return false;
  }

  // Only main group can use Web.Cafe integration
  if (!isMain) {
    logger.warn({ sourceGroup, type }, 'Web.Cafe integration blocked: not main group');
    return true;
  }

  const requestId = data.requestId as string;
  if (!requestId) {
    logger.warn({ type }, 'Web.Cafe integration blocked: missing requestId');
    return true;
  }

  logger.info({ type, requestId }, 'Processing Web.Cafe request');

  let result: SkillResult;

  switch (type) {
    case 'web_cafe_search':
      if (!data.query) {
        result = { success: false, message: 'Missing query' };
        break;
      }
      result = await runScript('search', {
        query: data.query,
        limit: Number.isFinite(data.limit) ? data.limit : 10,
      });
      break;

    case 'web_cafe_read':
      if (!data.url) {
        result = { success: false, message: 'Missing url' };
        break;
      }
      result = await runScript('read', { url: data.url });
      break;

    case 'web_cafe_browse':
      result = await runScript('browse', {
        section: data.section || 'all',
        limit: Number.isFinite(data.limit) ? data.limit : 20,
      });
      break;

    default:
      result = { success: false, message: `Unknown Web.Cafe task type: ${type}` };
      break;
  }

  writeResult(dataDir, sourceGroup, requestId, result);

  if (result.success) {
    logger.info({ type, sourceGroup, requestId }, 'Web.Cafe IPC task completed');
  } else {
    logger.warn(
      { type, sourceGroup, requestId, message: result.message },
      'Web.Cafe IPC task failed',
    );
  }

  return true;
}
