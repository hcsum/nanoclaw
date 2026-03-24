import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { logger } from './logger.js';

interface SkillResult {
  success: boolean;
  message: string;
  data?: unknown;
}

interface WebCafeIpcData {
  type?: string;
  requestId?: string;
  query?: string;
  url?: string;
  goal?: string;
  maxPages?: number;
}

const RESULT_DIR_NAME = 'web_cafe_results';
const SCRIPT_TIMEOUT_MS = 180_000;

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

async function runScript(
  scriptName:
    | 'search'
    | 'explore-experiences'
    | 'explore-tutorial-articles'
    | 'explore-tutorial-columns'
    | 'visit-page',
  args: Record<string, unknown>,
): Promise<SkillResult> {
  const scriptPath = path.join(
    process.cwd(),
    '.claude',
    'skills',
    'web-cafe',
    'scripts',
    `${scriptName}.ts`,
  );

  if (!fs.existsSync(scriptPath)) {
    return {
      success: false,
      message: `Web.Cafe script not found: ${scriptPath}`,
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
        message: `Web.Cafe script timed out after ${Math.round(SCRIPT_TIMEOUT_MS / 1000)}s`,
      });
    }, SCRIPT_TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          success: false,
          message:
            stderr.trim() ||
            `Web.Cafe script exited with code ${String(code)}${
              stdout.trim() ? `: ${stdout.trim().slice(0, 300)}` : ''
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
            message: 'Web.Cafe script produced empty output',
          });
          return;
        }
        resolve(JSON.parse(lastLine) as SkillResult);
      } catch {
        resolve({
          success: false,
          message: `Failed to parse Web.Cafe script output: ${stdout.trim().slice(0, 300)}`,
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        message: `Failed to start Web.Cafe script: ${err.message}`,
      });
    });
  });
}

export async function handleWebCafeIpc(
  data: WebCafeIpcData,
  sourceGroup: string,
  isMain: boolean,
  dataDir: string,
): Promise<boolean> {
  const type = data.type || '';
  if (!type.startsWith('web_cafe_')) return false;

  const requestId = data.requestId;
  if (!requestId) {
    logger.warn({ type, sourceGroup }, 'Web.Cafe IPC task missing requestId');
    return true;
  }

  if (!isMain) {
    writeResult(dataDir, sourceGroup, requestId, {
      success: false,
      message: 'Only the main group can use Web.Cafe tools.',
    });
    return true;
  }

  let result: SkillResult;
  switch (type) {
    case 'web_cafe_search':
      if (!data.query) {
        result = { success: false, message: 'Missing query' };
        break;
      }
      result = await runScript('search', {
        query: data.query,
        goal: data.goal,
        max_pages: Number.isFinite(data.maxPages) ? data.maxPages : 4,
      });
      break;
    case 'web_cafe_explore_experiences':
      result = await runScript('explore-experiences', {
        goal: data.goal,
        max_pages: Number.isFinite(data.maxPages) ? data.maxPages : 5,
      });
      break;
    case 'web_cafe_explore_tutorial_articles':
      result = await runScript('explore-tutorial-articles', {
        goal: data.goal,
        max_pages: Number.isFinite(data.maxPages) ? data.maxPages : 5,
      });
      break;
    case 'web_cafe_explore_tutorial_columns':
      result = await runScript('explore-tutorial-columns', {
        goal: data.goal,
        max_pages: Number.isFinite(data.maxPages) ? data.maxPages : 5,
      });
      break;
    case 'web_cafe_visit_page':
      if (!data.url) {
        result = { success: false, message: 'Missing url' };
        break;
      }
      result = await runScript('visit-page', {
        url: data.url,
        goal: data.goal,
        max_pages: Number.isFinite(data.maxPages) ? data.maxPages : 3,
      });
      break;
    default:
      result = {
        success: false,
        message: `Unknown Web.Cafe task type: ${type}`,
      };
      break;
  }

  writeResult(dataDir, sourceGroup, requestId, result);

  if (result.success) {
    logger.info(
      { type, sourceGroup, requestId },
      'Web.Cafe IPC task completed',
    );
  } else {
    logger.warn(
      { type, sourceGroup, requestId, message: result.message },
      'Web.Cafe IPC task failed',
    );
  }

  return true;
}
