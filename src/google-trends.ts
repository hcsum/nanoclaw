import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { logger } from './logger.js';

interface SkillResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

interface GoogleTrendsIpcData {
  type?: string;
  requestId?: string;
  keywords?: string[];
  geo?: string;
  date?: string;
  exploreUrl?: string;
}

const RESULT_DIR_NAME = 'google_trends_results';
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
  scriptName: 'compare',
  args: Record<string, unknown>,
): Promise<SkillResult> {
  const scriptPath = path.join(
    process.cwd(),
    '.claude',
    'skills',
    'google-trends',
    'scripts',
    `${scriptName}.ts`,
  );

  if (!fs.existsSync(scriptPath)) {
    return {
      success: false,
      message: `Google Trends script not found: ${scriptPath}`,
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
        message: `Google Trends script timed out after ${Math.round(SCRIPT_TIMEOUT_MS / 1000)}s`,
      });
    }, SCRIPT_TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          success: false,
          message:
            stderr.trim() ||
            `Google Trends script exited with code ${String(code)}${
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
            message: 'Google Trends script produced empty output',
          });
          return;
        }
        resolve(JSON.parse(lastLine) as SkillResult);
      } catch {
        resolve({
          success: false,
          message: `Failed to parse Google Trends script output: ${stdout.trim().slice(0, 300)}`,
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        message: `Failed to start Google Trends script: ${err.message}`,
      });
    });
  });
}

export async function handleGoogleTrendsIpc(
  data: GoogleTrendsIpcData,
  sourceGroup: string,
  isMain: boolean,
  dataDir: string,
): Promise<boolean> {
  const type = data.type || '';
  if (!type.startsWith('google_trends_')) return false;

  const requestId = data.requestId;
  if (!requestId) {
    logger.warn(
      { type, sourceGroup },
      'Google Trends IPC task missing requestId',
    );
    return true;
  }

  if (!isMain) {
    writeResult(dataDir, sourceGroup, requestId, {
      success: false,
      message: 'Only the main group can use Google Trends tools.',
    });
    return true;
  }

  let result: SkillResult;

  switch (type) {
    case 'google_trends_compare':
      result = await runScript('compare', {
        keywords: Array.isArray(data.keywords) ? data.keywords : undefined,
        geo: data.geo,
        date: data.date,
        explore_url: data.exploreUrl,
      });
      break;
    default:
      result = {
        success: false,
        message: `Unknown Google Trends task type: ${type}`,
      };
      break;
  }

  writeResult(dataDir, sourceGroup, requestId, result);

  if (result.success) {
    logger.info(
      { type, sourceGroup, requestId },
      'Google Trends IPC task completed',
    );
  } else {
    logger.warn(
      {
        type,
        sourceGroup,
        requestId,
        message:
          result.message || 'No message returned from Google Trends script',
      },
      'Google Trends IPC task failed',
    );
  }

  return true;
}
