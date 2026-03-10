/**
 * Browser Automation - Host IPC Handler
 * Handles browser automation requests from container via IPC
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const SCRIPTS_DIR = path.join(PROJECT_ROOT, '.claude/skills/browser/scripts');

interface BrowserTask {
  id: string;
  script: string;
  input: unknown;
}

interface BrowserResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export async function handleBrowserIpc(next: () => Promise<void>): Promise<void> {
  const tasksDir = path.join(PROJECT_ROOT, 'data/ipc/tasks');
  const messagesDir = path.join(PROJECT_ROOT, 'data/ipc/messages');

  // Ensure directories exist
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.mkdirSync(messagesDir, { recursive: true });

  // Watch for browser tasks
  fs.watch(tasksDir, async (eventType, filename) => {
    if (!filename || !filename.startsWith('browser_')) return;

    const taskPath = path.join(tasksDir, filename);
    if (!fs.existsSync(taskPath)) return;

    try {
      const taskData = fs.readFileSync(taskPath, 'utf-8');
      const task: BrowserTask = JSON.parse(taskData);

      // Execute the script
      const result = await executeBrowserScript(task.script, task.input);

      // Write result
      const resultPath = path.join(messagesDir, `browser_result_${task.id}.json`);
      fs.writeFileSync(resultPath, JSON.stringify(result));

      // Clean up task file
      fs.unlinkSync(taskPath);
    } catch (err) {
      console.error('Browser IPC error:', err);
    }
  });

  // Continue to next handler
  await next();
}

async function executeBrowserScript(script: string, input: unknown): Promise<BrowserResult> {
  const scriptPath = path.join(SCRIPTS_DIR, `${script}.ts`);

  if (!fs.existsSync(scriptPath)) {
    return {
      success: false,
      message: `Script not found: ${script}`,
    };
  }

  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', scriptPath], {
      cwd: PROJECT_ROOT,
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
