/**
 * Browser Automation - Host IPC Handler
 * Handles browser automation requests from container via IPC
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

interface BrowserIpcData {
  type: string;
  script?: string;
  input?: unknown;
  taskId?: string;
}

interface BrowserResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export async function handleBrowserIpc(
  data: BrowserIpcData,
  sourceGroup: string,
  isMain: boolean,
  dataDir: string,
): Promise<boolean> {
  // Check if this is a browser task
  if (!data.type || !data.type.startsWith('browser_')) {
    return false;
  }

  const script = data.type.replace('browser_', '');
  const input = data.input || {};
  const taskId = data.taskId || Date.now().toString();

  const PROJECT_ROOT = process.cwd();
  const SCRIPTS_DIR = path.join(PROJECT_ROOT, '.claude/skills/browser/scripts');
  const resultPath = path.join(dataDir, 'ipc', sourceGroup, `browser_result_${taskId}.json`);

  try {
    const result = await executeBrowserScript(SCRIPTS_DIR, script, input);
    fs.writeFileSync(resultPath, JSON.stringify(result));
    return true;
  } catch (err) {
    const errorResult: BrowserResult = {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
    fs.writeFileSync(resultPath, JSON.stringify(errorResult));
    return true;
  }
}

async function executeBrowserScript(
  scriptsDir: string,
  script: string,
  input: unknown,
): Promise<BrowserResult> {
  const scriptPath = path.join(scriptsDir, `${script}.ts`);

  if (!fs.existsSync(scriptPath)) {
    return {
      success: false,
      message: `Script not found: ${script}`,
    };
  }

  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', scriptPath], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          message: stderr || `Script exited with code ${code}`,
        });
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (err) {
        resolve({
          success: false,
          message: `Failed to parse script output: ${err}`,
        });
      }
    });

    // Send input to script
    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}
