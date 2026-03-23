import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { logger } from './logger.js';

interface SkillResult {
  success: boolean;
  message: string;
  data?: unknown;
}

interface XIpcData {
  type?: string;
  requestId?: string;
  content?: string;
  tweetUrl?: string;
  comment?: string;
  limit?: number;
  query?: string;
}

const SCRIPT_TIMEOUT_MS = 120_000;

function writeResult(
  dataDir: string,
  sourceGroup: string,
  requestId: string,
  result: SkillResult,
): void {
  const resultsDir = path.join(dataDir, 'ipc', sourceGroup, 'x_results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const resultPath = path.join(resultsDir, `${requestId}.json`);
  const tmpPath = `${resultPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(result));
  fs.renameSync(tmpPath, resultPath);
}

async function runScript(
  scriptName:
    | 'post'
    | 'like'
    | 'reply'
    | 'retweet'
    | 'quote'
    | 'read-home'
    | 'search',
  args: Record<string, unknown>,
): Promise<SkillResult> {
  const scriptPath = path.join(
    process.cwd(),
    '.claude',
    'skills',
    'x-integration',
    'scripts',
    `${scriptName}.ts`,
  );

  if (!fs.existsSync(scriptPath)) {
    return {
      success: false,
      message: `X script not found: ${scriptPath}`,
    };
  }

  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env, NANOCLAW_ROOT: process.cwd() },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.stdin.write(JSON.stringify(args));
    proc.stdin.end();

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        success: false,
        message: `X script timed out after ${SCRIPT_TIMEOUT_MS / 1000}s`,
      });
    }, SCRIPT_TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          success: false,
          message:
            stderr.trim() ||
            `X script exited with code ${String(code)}${
              stdout.trim() ? `: ${stdout.trim().slice(0, 200)}` : ''
            }`,
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
            message: 'X script produced empty output',
          });
          return;
        }
        resolve(JSON.parse(lastLine) as SkillResult);
      } catch {
        resolve({
          success: false,
          message: `Failed to parse X script output: ${stdout.trim().slice(0, 200)}`,
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        message: `Failed to start X script: ${err.message}`,
      });
    });
  });
}

/**
 * Handle x_* IPC tasks.
 * Returns true when the task type belongs to X integration.
 */
export async function handleXIpc(
  data: XIpcData,
  sourceGroup: string,
  isMain: boolean,
  dataDir: string,
): Promise<boolean> {
  const type = data.type || '';
  if (!type.startsWith('x_')) return false;

  const requestId = data.requestId;
  if (!requestId) {
    logger.warn({ type, sourceGroup }, 'X IPC task missing requestId');
    return true;
  }

  if (!isMain) {
    writeResult(dataDir, sourceGroup, requestId, {
      success: false,
      message: 'Only the main group can use X integration tools.',
    });
    return true;
  }

  let result: SkillResult;

  switch (type) {
    case 'x_post':
      if (!data.content) {
        result = { success: false, message: 'Missing content' };
        break;
      }
      result = await runScript('post', { content: data.content });
      break;
    case 'x_like':
      if (!data.tweetUrl) {
        result = { success: false, message: 'Missing tweetUrl' };
        break;
      }
      result = await runScript('like', { tweetUrl: data.tweetUrl });
      break;
    case 'x_reply':
      if (!data.tweetUrl || !data.content) {
        result = { success: false, message: 'Missing tweetUrl or content' };
        break;
      }
      result = await runScript('reply', {
        tweetUrl: data.tweetUrl,
        content: data.content,
      });
      break;
    case 'x_retweet':
      if (!data.tweetUrl) {
        result = { success: false, message: 'Missing tweetUrl' };
        break;
      }
      result = await runScript('retweet', { tweetUrl: data.tweetUrl });
      break;
    case 'x_quote':
      if (!data.tweetUrl || !data.comment) {
        result = { success: false, message: 'Missing tweetUrl or comment' };
        break;
      }
      result = await runScript('quote', {
        tweetUrl: data.tweetUrl,
        comment: data.comment,
      });
      break;
    case 'x_read_home_feed':
      result = await runScript('read-home', {
        limit: Number.isFinite(data.limit) ? data.limit : 25,
      });
      break;
    case 'x_search':
      if (!data.query) {
        result = { success: false, message: 'Missing query' };
        break;
      }
      result = await runScript('search', {
        query: data.query,
        limit: Number.isFinite(data.limit) ? data.limit : 40,
      });
      break;
    default:
      result = { success: false, message: `Unknown X task type: ${type}` };
      break;
  }

  writeResult(dataDir, sourceGroup, requestId, result);

  if (result.success) {
    logger.info({ type, sourceGroup, requestId }, 'X IPC task completed');
  } else {
    logger.warn(
      { type, sourceGroup, requestId, message: result.message },
      'X IPC task failed',
    );
  }

  return true;
}
