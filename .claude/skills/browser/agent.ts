/**
 * Browser Automation - MCP Tool Definitions
 * Defines MCP tools for container agent to use
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const IPC_TASKS_DIR = '/workspace/ipc/tasks';
const IPC_MESSAGES_DIR = '/workspace/ipc/messages';

/**
 * Register browser automation MCP tools
 */
export function registerBrowserTools(server: Server): void {
  // browser_open - Navigate to URL
  server.tool(
    'browser_open',
    'Navigate to a URL in the browser',
    {
      url: {
        type: 'string',
        description: 'The URL to navigate to',
        required: true,
      },
    },
    async ({ url }) => {
      return await executeBrowserTask('open', { url });
    },
  );

  // browser_snapshot - Get page state
  server.tool(
    'browser_snapshot',
    'Get current page state with interactive elements. Returns element references (@e1, @e2, etc.) that can be used with browser_action.',
    {
      interactive: {
        type: 'boolean',
        description: 'Only show interactive elements (default: true)',
        required: false,
      },
      limit: {
        type: 'number',
        description: 'Max elements to return (default: 50)',
        required: false,
      },
    },
    async ({ interactive, limit }) => {
      return await executeBrowserTask('snapshot', { interactive, limit });
    },
  );

  // browser_action - Perform action
  server.tool(
    'browser_action',
    'Perform an action on the page (click, fill, scroll, press, wait)',
    {
      action: {
        type: 'string',
        description: 'Action type: click, fill, scroll, press, wait',
        required: true,
      },
      selector: {
        type: 'string',
        description: 'CSS selector or @ref from snapshot (for click/fill)',
        required: false,
      },
      value: {
        type: 'string',
        description: 'Value for fill or press actions',
        required: false,
      },
      direction: {
        type: 'string',
        description: 'Scroll direction: up or down (default: down)',
        required: false,
      },
      amount: {
        type: 'number',
        description: 'Scroll amount in pixels or wait time in ms',
        required: false,
      },
    },
    async ({ action, selector, value, direction, amount }) => {
      return await executeBrowserTask('action', {
        action,
        selector,
        value,
        direction,
        amount,
      });
    },
  );

  // browser_read - Extract page content
  server.tool(
    'browser_read',
    'Extract text content from the current page',
    {
      selector: {
        type: 'string',
        description: 'Optional CSS selector to scope reading',
        required: false,
      },
    },
    async ({ selector }) => {
      return await executeBrowserTask('read', { selector });
    },
  );
}

async function executeBrowserTask(script: string, input: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
  const taskId = randomUUID();
  const taskPath = path.join(IPC_TASKS_DIR, `browser_${taskId}.json`);
  const resultPath = path.join(IPC_MESSAGES_DIR, `browser_result_${taskId}.json`);

  // Write task
  fs.writeFileSync(
    taskPath,
    JSON.stringify({
      id: taskId,
      script,
      input,
    }),
  );

  // Wait for result
  const result = await waitForBrowserResult(resultPath);

  return {
    content: [
      {
        type: 'text',
        text: result.message,
      },
    ],
  };
}

async function waitForBrowserResult(resultPath: string): Promise<{ success: boolean; message: string; data?: unknown }> {
  const timeout = 30000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (fs.existsSync(resultPath)) {
      const data = fs.readFileSync(resultPath, 'utf-8');
      fs.unlinkSync(resultPath);
      return JSON.parse(data);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return {
    success: false,
    message: 'Browser task timed out',
  };
}
