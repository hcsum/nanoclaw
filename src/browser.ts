/**
 * Browser Automation - Host IPC Handler
 * Handles browser automation requests from container via IPC
 */

import fs from 'fs';
import path from 'path';

import { executeUiBrowserTask } from './browser-ui-session.js';

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
  const resultPath = path.join(
    dataDir,
    'ipc',
    sourceGroup,
    `browser_result_${taskId}.json`,
  );

  try {
    const result = await executeUiBrowserTask(script, input);
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
