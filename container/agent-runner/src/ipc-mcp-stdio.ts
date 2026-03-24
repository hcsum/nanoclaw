/**
 * Stdio MCP Server for NanoClaw
 * Standalone process that agent teams subagents can inherit.
 * Reads context from environment variables, writes IPC files for the host.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { CronExpressionParser } from 'cron-parser';

const IPC_DIR = '/workspace/ipc';
const MESSAGES_DIR = path.join(IPC_DIR, 'messages');
const TASKS_DIR = path.join(IPC_DIR, 'tasks');
const X_RESULTS_DIR = path.join(IPC_DIR, 'x_results');
const BROWSER_USE_RESULTS_DIR = path.join(IPC_DIR, 'browser_use_results');
const WEB_CAFE_RESULTS_DIR = path.join(IPC_DIR, 'web_cafe_results');
const GOOGLE_TRENDS_RESULTS_DIR = path.join(IPC_DIR, 'google_trends_results');
const X_RESULT_POLL_MS = 1000;
const X_RESULT_TIMEOUT_MS = 130000;
const BROWSER_USE_RESULT_TIMEOUT_MS = 30 * 1000;
const WEB_CAFE_RESULT_TIMEOUT_MS = 190000;
const GOOGLE_TRENDS_RESULT_TIMEOUT_MS = 190000;

// Context from environment variables (set by the agent runner)
const chatJid = process.env.NANOCLAW_CHAT_JID!;
const groupFolder = process.env.NANOCLAW_GROUP_FOLDER!;
const isMain = process.env.NANOCLAW_IS_MAIN === '1';

function writeIpcFile(dir: string, data: object): string {
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filepath = path.join(dir, filename);

  // Atomic write: temp file then rename
  const tempPath = `${filepath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filepath);

  return filename;
}

async function waitForXResult(
  requestId: string,
  timeoutMs = X_RESULT_TIMEOUT_MS,
): Promise<{ success: boolean; message: string }> {
  return waitForJsonResult(
    path.join(X_RESULTS_DIR, `${requestId}.json`),
    timeoutMs,
    'X result',
  );
}

async function waitForWebCafeResult(
  requestId: string,
  timeoutMs = WEB_CAFE_RESULT_TIMEOUT_MS,
): Promise<{ success: boolean; message: string; data?: unknown }> {
  return waitForJsonResult(
    path.join(WEB_CAFE_RESULTS_DIR, `${requestId}.json`),
    timeoutMs,
    'Web.Cafe result',
  );
}

async function waitForGoogleTrendsResult(
  requestId: string,
  timeoutMs = GOOGLE_TRENDS_RESULT_TIMEOUT_MS,
): Promise<{ success: boolean; message: string; data?: unknown }> {
  return waitForJsonResult(
    path.join(GOOGLE_TRENDS_RESULTS_DIR, `${requestId}.json`),
    timeoutMs,
    'Google Trends result',
  );
}

async function waitForJsonResult(
  resultFile: string,
  timeoutMs: number,
  label: string,
): Promise<{ success: boolean; message: string; data?: unknown }> {
  let elapsed = 0;

  while (elapsed < timeoutMs) {
    if (fs.existsSync(resultFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(resultFile, 'utf-8')) as {
          success?: boolean;
          message?: string;
          data?: unknown;
        };
        fs.unlinkSync(resultFile);
        return {
          success: parsed.success === true,
          message:
            parsed.message || `No message returned from ${label} handler`,
          data: parsed.data,
        };
      } catch (err) {
        return {
          success: false,
          message: `Failed to parse ${label}: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, X_RESULT_POLL_MS));
    elapsed += X_RESULT_POLL_MS;
  }

  return { success: false, message: `${label} timed out` };
}

const server = new McpServer({
  name: 'nanoclaw',
  version: '1.0.0',
});

server.tool(
  'browser_use_research',
  'Use this for web research that needs a real browser, such as navigating multiple pages, interacting with dynamic sites, handling pagination, or extracting information that simple fetch/search tools may miss. Prefer this over basic web tools when the task requires step-by-step browsing. Main group only. Starts a background task and returns a request ID immediately.',
  {
    goal: z.string().min(1).describe('The research objective to investigate'),
    start_url: z
      .string()
      .url()
      .optional()
      .describe('Optional URL to begin from'),
    max_steps: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Optional cap on browser steps'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use browser-use research.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `browseruse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'browser_use_research',
      requestId,
      goal: args.goal,
      startUrl: args.start_url,
      maxSteps: args.max_steps,
      chatJid,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForJsonResult(
      path.join(BROWSER_USE_RESULTS_DIR, `${requestId}.json`),
      BROWSER_USE_RESULT_TIMEOUT_MS,
      'browser-use result',
    );

    const responseText =
      result.data != null
        ? `${result.message}\n\n${JSON.stringify(result.data, null, 2)}`
        : result.message;

    return {
      content: [{ type: 'text' as const, text: responseText }],
      isError: !result.success,
    };
  },
);

server.tool(
  'browser_use_status',
  'Check the status of a browser-use background task by request ID. Main group only.',
  {
    request_id: z
      .string()
      .min(1)
      .describe('The request ID returned by browser_use_research'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use browser-use research.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `browserusestatus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'browser_use_status',
      requestId,
      targetRequestId: args.request_id,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForJsonResult(
      path.join(BROWSER_USE_RESULTS_DIR, `${requestId}.json`),
      BROWSER_USE_RESULT_TIMEOUT_MS,
      'browser-use status result',
    );

    const responseText =
      result.data != null
        ? `${result.message}\n\n${JSON.stringify(result.data, null, 2)}`
        : result.message;

    return {
      content: [{ type: 'text' as const, text: responseText }],
      isError: !result.success,
    };
  },
);

server.tool(
  'browser_use_cancel',
  'Cancel a running browser-use background task by request ID. Main group only.',
  {
    request_id: z
      .string()
      .min(1)
      .describe('The request ID returned by browser_use_research'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use browser-use research.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `browserusecancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'browser_use_cancel',
      requestId,
      targetRequestId: args.request_id,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForJsonResult(
      path.join(BROWSER_USE_RESULTS_DIR, `${requestId}.json`),
      BROWSER_USE_RESULT_TIMEOUT_MS,
      'browser-use cancel result',
    );

    const responseText =
      result.data != null
        ? `${result.message}\n\n${JSON.stringify(result.data, null, 2)}`
        : result.message;

    return {
      content: [{ type: 'text' as const, text: responseText }],
      isError: !result.success,
    };
  },
);

server.tool(
  'google_trends_compare',
  'Compare keywords on Google Trends with a real browser. Use this to capture the Average interest value for each keyword and the first page of Top queries plus change percentages for each compared keyword. Accepts either direct keywords or a Trends explore URL override. Main group only.',
  {
    keywords: z
      .array(z.string().min(1))
      .min(1)
      .max(5)
      .optional()
      .describe('Keywords to compare on Google Trends'),
    geo: z
      .string()
      .optional()
      .describe('Optional geography, such as Worldwide or US'),
    date: z
      .string()
      .optional()
      .describe('Optional Trends date range, such as today 5-y or today 12-m'),
    explore_url: z
      .string()
      .url()
      .optional()
      .describe('Optional full Google Trends explore URL to open directly'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use Google Trends tools.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `googletrends-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'google_trends_compare',
      requestId,
      keywords: args.keywords,
      geo: args.geo,
      date: args.date,
      exploreUrl: args.explore_url,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForGoogleTrendsResult(requestId);
    const responseText =
      result.data != null
        ? JSON.stringify(result.data, null, 2)
        : result.message;

    return {
      content: [{ type: 'text' as const, text: responseText }],
      isError: !result.success,
    };
  },
);

server.tool(
  'web_cafe_search',
  'Search Web.Cafe with the site UI using a headed host browser and a saved login session. Use this for Web.Cafe-specific topic discovery, keyword research, and community insight mining. The result includes source URLs you can reuse in follow-up calls like web_cafe_visit_page for deeper multi-round exploration. Main group only.',
  {
    query: z.string().min(1).describe('Search query to run inside Web.Cafe'),
    goal: z
      .string()
      .optional()
      .describe('Optional research goal to shape the summary and analysis'),
    max_pages: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .describe('How many representative result pages to open and inspect'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use Web.Cafe tools.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `webcafesearch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'web_cafe_search',
      requestId,
      query: args.query,
      goal: args.goal,
      maxPages: args.max_pages,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForWebCafeResult(requestId);
    const responseText =
      result.data != null
        ? `${result.message}\n\n${JSON.stringify(result.data, null, 2)}`
        : result.message;

    return {
      content: [{ type: 'text' as const, text: responseText }],
      isError: !result.success,
    };
  },
);

server.tool(
  'web_cafe_explore_experiences',
  'Explore https://new.web.cafe/experiences and representative detail pages, then synthesize the content with SEO and indie-developer analysis. Main group only.',
  {
    goal: z
      .string()
      .optional()
      .describe('Optional research goal to focus the experiences analysis'),
    max_pages: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .describe('How many representative experience pages to inspect'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use Web.Cafe tools.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `webcafeexp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'web_cafe_explore_experiences',
      requestId,
      goal: args.goal,
      maxPages: args.max_pages,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForWebCafeResult(requestId);
    const responseText =
      result.data != null
        ? `${result.message}\n\n${JSON.stringify(result.data, null, 2)}`
        : result.message;

    return {
      content: [{ type: 'text' as const, text: responseText }],
      isError: !result.success,
    };
  },
);

server.tool(
  'web_cafe_explore_tutorial_articles',
  'Explore https://new.web.cafe/tutorials?status=article and representative article pages, then synthesize the content with SEO and indie-developer analysis. Main group only.',
  {
    goal: z
      .string()
      .optional()
      .describe(
        'Optional research goal to focus the tutorial article analysis',
      ),
    max_pages: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .describe('How many representative tutorial article pages to inspect'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use Web.Cafe tools.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `webcafearticles-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'web_cafe_explore_tutorial_articles',
      requestId,
      goal: args.goal,
      maxPages: args.max_pages,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForWebCafeResult(requestId);
    const responseText =
      result.data != null
        ? `${result.message}\n\n${JSON.stringify(result.data, null, 2)}`
        : result.message;

    return {
      content: [{ type: 'text' as const, text: responseText }],
      isError: !result.success,
    };
  },
);

server.tool(
  'web_cafe_explore_tutorial_columns',
  'Explore https://new.web.cafe/tutorials?status=column and representative column pages, then synthesize the content with SEO and indie-developer analysis. Main group only.',
  {
    goal: z
      .string()
      .optional()
      .describe('Optional research goal to focus the tutorial column analysis'),
    max_pages: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .describe('How many representative tutorial column pages to inspect'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use Web.Cafe tools.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `webcafecolumns-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'web_cafe_explore_tutorial_columns',
      requestId,
      goal: args.goal,
      maxPages: args.max_pages,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForWebCafeResult(requestId);
    const responseText =
      result.data != null
        ? `${result.message}\n\n${JSON.stringify(result.data, null, 2)}`
        : result.message;

    return {
      content: [{ type: 'text' as const, text: responseText }],
      isError: !result.success,
    };
  },
);

server.tool(
  'web_cafe_visit_page',
  'Visit a specific Web.Cafe page, extract the page content plus nearby internal Web.Cafe links, and synthesize the findings with SEO and indie-developer analysis. Use this after discovering a promising URL from topics pages, search results, or previous Web.Cafe tool outputs. It can be chained across multiple rounds. Only use Web.Cafe URLs. Main group only.',
  {
    url: z
      .string()
      .url()
      .describe(
        'A https://new.web.cafe/... URL to inspect, including URLs discovered from prior Web.Cafe tool outputs',
      ),
    goal: z
      .string()
      .optional()
      .describe('Optional research goal to focus the page analysis'),
    max_pages: z
      .number()
      .int()
      .min(1)
      .max(8)
      .optional()
      .describe('How many nearby related pages to inspect'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use Web.Cafe tools.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `webcafepage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'web_cafe_visit_page',
      requestId,
      url: args.url,
      goal: args.goal,
      maxPages: args.max_pages,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForWebCafeResult(requestId);
    const responseText =
      result.data != null
        ? `${result.message}\n\n${JSON.stringify(result.data, null, 2)}`
        : result.message;

    return {
      content: [{ type: 'text' as const, text: responseText }],
      isError: !result.success,
    };
  },
);

server.tool(
  'send_message',
  "Send a message to the user or group immediately while you're still running. Use this for progress updates or to send multiple messages. You can call this multiple times.",
  {
    text: z.string().describe('The message text to send'),
    sender: z
      .string()
      .optional()
      .describe(
        'Your role/identity name (e.g. "Researcher"). When set, messages appear from a dedicated bot in Telegram.',
      ),
  },
  async (args) => {
    const data: Record<string, string | undefined> = {
      type: 'message',
      chatJid,
      text: args.text,
      sender: args.sender || undefined,
      groupFolder,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(MESSAGES_DIR, data);

    return { content: [{ type: 'text' as const, text: 'Message sent.' }] };
  },
);

server.tool(
  'schedule_task',
  `Schedule a recurring or one-time task. The task will run as a full agent with access to all tools. Returns the task ID for future reference. To modify an existing task, use update_task instead.

CONTEXT MODE - Choose based on task type:
\u2022 "group": Task runs in the group's conversation context, with access to chat history. Use for tasks that need context about ongoing discussions, user preferences, or recent interactions.
\u2022 "isolated": Task runs in a fresh session with no conversation history. Use for independent tasks that don't need prior context. When using isolated mode, include all necessary context in the prompt itself.

If unsure which mode to use, you can ask the user. Examples:
- "Remind me about our discussion" \u2192 group (needs conversation context)
- "Check the weather every morning" \u2192 isolated (self-contained task)
- "Follow up on my request" \u2192 group (needs to know what was requested)
- "Generate a daily report" \u2192 isolated (just needs instructions in prompt)

MESSAGING BEHAVIOR - The task agent's output is sent to the user or group. It can also use send_message for immediate delivery, or wrap output in <internal> tags to suppress it. Include guidance in the prompt about whether the agent should:
\u2022 Always send a message (e.g., reminders, daily briefings)
\u2022 Only send a message when there's something to report (e.g., "notify me if...")
\u2022 Never send a message (background maintenance tasks)

SCHEDULE VALUE FORMAT (all times are LOCAL timezone):
\u2022 cron: Standard cron expression (e.g., "*/5 * * * *" for every 5 minutes, "0 9 * * *" for daily at 9am LOCAL time)
\u2022 interval: Milliseconds between runs (e.g., "300000" for 5 minutes, "3600000" for 1 hour)
\u2022 once: Local time WITHOUT "Z" suffix (e.g., "2026-02-01T15:30:00"). Do NOT use UTC/Z suffix.`,
  {
    prompt: z
      .string()
      .describe(
        'What the agent should do when the task runs. For isolated mode, include all necessary context here.',
      ),
    schedule_type: z
      .enum(['cron', 'interval', 'once'])
      .describe(
        'cron=recurring at specific times, interval=recurring every N ms, once=run once at specific time',
      ),
    schedule_value: z
      .string()
      .describe(
        'cron: "*/5 * * * *" | interval: milliseconds like "300000" | once: local timestamp like "2026-02-01T15:30:00" (no Z suffix!)',
      ),
    context_mode: z
      .enum(['group', 'isolated'])
      .default('group')
      .describe(
        'group=runs with chat history and memory, isolated=fresh session (include context in prompt)',
      ),
    target_group_jid: z
      .string()
      .optional()
      .describe(
        '(Main group only) JID of the group to schedule the task for. Defaults to the current group.',
      ),
  },
  async (args) => {
    // Validate schedule_value before writing IPC
    if (args.schedule_type === 'cron') {
      try {
        CronExpressionParser.parse(args.schedule_value);
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid cron: "${args.schedule_value}". Use format like "0 9 * * *" (daily 9am) or "*/5 * * * *" (every 5 min).`,
            },
          ],
          isError: true,
        };
      }
    } else if (args.schedule_type === 'interval') {
      const ms = parseInt(args.schedule_value, 10);
      if (isNaN(ms) || ms <= 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid interval: "${args.schedule_value}". Must be positive milliseconds (e.g., "300000" for 5 min).`,
            },
          ],
          isError: true,
        };
      }
    } else if (args.schedule_type === 'once') {
      if (
        /[Zz]$/.test(args.schedule_value) ||
        /[+-]\d{2}:\d{2}$/.test(args.schedule_value)
      ) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Timestamp must be local time without timezone suffix. Got "${args.schedule_value}" — use format like "2026-02-01T15:30:00".`,
            },
          ],
          isError: true,
        };
      }
      const date = new Date(args.schedule_value);
      if (isNaN(date.getTime())) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid timestamp: "${args.schedule_value}". Use local time format like "2026-02-01T15:30:00".`,
            },
          ],
          isError: true,
        };
      }
    }

    // Non-main groups can only schedule for themselves
    const targetJid =
      isMain && args.target_group_jid ? args.target_group_jid : chatJid;

    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const data = {
      type: 'schedule_task',
      taskId,
      prompt: args.prompt,
      schedule_type: args.schedule_type,
      schedule_value: args.schedule_value,
      context_mode: args.context_mode || 'group',
      targetJid,
      createdBy: groupFolder,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Task ${taskId} scheduled: ${args.schedule_type} - ${args.schedule_value}`,
        },
      ],
    };
  },
);

server.tool(
  'list_tasks',
  "List all scheduled tasks. From main: shows all tasks. From other groups: shows only that group's tasks.",
  {},
  async () => {
    const tasksFile = path.join(IPC_DIR, 'current_tasks.json');

    try {
      if (!fs.existsSync(tasksFile)) {
        return {
          content: [
            { type: 'text' as const, text: 'No scheduled tasks found.' },
          ],
        };
      }

      const allTasks = JSON.parse(fs.readFileSync(tasksFile, 'utf-8'));

      const tasks = isMain
        ? allTasks
        : allTasks.filter(
            (t: { groupFolder: string }) => t.groupFolder === groupFolder,
          );

      if (tasks.length === 0) {
        return {
          content: [
            { type: 'text' as const, text: 'No scheduled tasks found.' },
          ],
        };
      }

      const formatted = tasks
        .map(
          (t: {
            id: string;
            prompt: string;
            schedule_type: string;
            schedule_value: string;
            status: string;
            next_run: string;
          }) =>
            `- [${t.id}] ${t.prompt.slice(0, 50)}... (${t.schedule_type}: ${t.schedule_value}) - ${t.status}, next: ${t.next_run || 'N/A'}`,
        )
        .join('\n');

      return {
        content: [
          { type: 'text' as const, text: `Scheduled tasks:\n${formatted}` },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error reading tasks: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

server.tool(
  'pause_task',
  'Pause a scheduled task. It will not run until resumed.',
  { task_id: z.string().describe('The task ID to pause') },
  async (args) => {
    const data = {
      type: 'pause_task',
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Task ${args.task_id} pause requested.`,
        },
      ],
    };
  },
);

server.tool(
  'resume_task',
  'Resume a paused task.',
  { task_id: z.string().describe('The task ID to resume') },
  async (args) => {
    const data = {
      type: 'resume_task',
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Task ${args.task_id} resume requested.`,
        },
      ],
    };
  },
);

server.tool(
  'cancel_task',
  'Cancel and delete a scheduled task.',
  { task_id: z.string().describe('The task ID to cancel') },
  async (args) => {
    const data = {
      type: 'cancel_task',
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Task ${args.task_id} cancellation requested.`,
        },
      ],
    };
  },
);

server.tool(
  'update_task',
  'Update an existing scheduled task. Only provided fields are changed; omitted fields stay the same.',
  {
    task_id: z.string().describe('The task ID to update'),
    prompt: z.string().optional().describe('New prompt for the task'),
    schedule_type: z
      .enum(['cron', 'interval', 'once'])
      .optional()
      .describe('New schedule type'),
    schedule_value: z
      .string()
      .optional()
      .describe('New schedule value (see schedule_task for format)'),
  },
  async (args) => {
    // Validate schedule_value if provided
    if (
      args.schedule_type === 'cron' ||
      (!args.schedule_type && args.schedule_value)
    ) {
      if (args.schedule_value) {
        try {
          CronExpressionParser.parse(args.schedule_value);
        } catch {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Invalid cron: "${args.schedule_value}".`,
              },
            ],
            isError: true,
          };
        }
      }
    }
    if (args.schedule_type === 'interval' && args.schedule_value) {
      const ms = parseInt(args.schedule_value, 10);
      if (isNaN(ms) || ms <= 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid interval: "${args.schedule_value}".`,
            },
          ],
          isError: true,
        };
      }
    }

    const data: Record<string, string | undefined> = {
      type: 'update_task',
      taskId: args.task_id,
      groupFolder,
      isMain: String(isMain),
      timestamp: new Date().toISOString(),
    };
    if (args.prompt !== undefined) data.prompt = args.prompt;
    if (args.schedule_type !== undefined)
      data.schedule_type = args.schedule_type;
    if (args.schedule_value !== undefined)
      data.schedule_value = args.schedule_value;

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Task ${args.task_id} update requested.`,
        },
      ],
    };
  },
);

server.tool(
  'register_group',
  `Register a new chat/group so the agent can respond to messages there. Main group only.

Use available_groups.json to find the JID for a group. The folder name must be channel-prefixed: "{channel}_{group-name}" (e.g., "whatsapp_family-chat", "telegram_dev-team", "discord_general"). Use lowercase with hyphens for the group name part.`,
  {
    jid: z
      .string()
      .describe(
        'The chat JID (e.g., "120363336345536173@g.us", "tg:-1001234567890", "dc:1234567890123456")',
      ),
    name: z.string().describe('Display name for the group'),
    folder: z
      .string()
      .describe(
        'Channel-prefixed folder name (e.g., "whatsapp_family-chat", "telegram_dev-team")',
      ),
    trigger: z.string().describe('Trigger word (e.g., "@Andy")'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can register new groups.',
          },
        ],
        isError: true,
      };
    }

    const data = {
      type: 'register_group',
      jid: args.jid,
      name: args.name,
      folder: args.folder,
      trigger: args.trigger,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: 'text' as const,
          text: `Group "${args.name}" registered. It will start receiving messages immediately.`,
        },
      ],
    };
  },
);

server.tool(
  'x_read_home_feed',
  'Read posts from X home feed for research/summarization. Main group only.',
  {
    limit: z
      .number()
      .int()
      .min(5)
      .max(60)
      .default(40)
      .describe('Number of posts to fetch (5-60)'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use X integration tools.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `xread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'x_read_home_feed',
      requestId,
      limit: args.limit,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForXResult(requestId);
    return {
      content: [{ type: 'text' as const, text: result.message }],
      isError: !result.success,
    };
  },
);

server.tool(
  'x_search',
  'Search X (Twitter) for posts matching a query. Main group only. Use for research, trend discovery, or finding posts on a topic.',
  {
    query: z
      .string()
      .describe(
        'Search query (e.g. "AI agents", "#buildinpublic", "from:sama")',
      ),
    limit: z
      .number()
      .int()
      .min(5)
      .max(60)
      .default(20)
      .describe('Number of posts to fetch (5-60)'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use X integration tools.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `xsearch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'x_search',
      requestId,
      query: args.query,
      limit: args.limit,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForXResult(requestId);
    return {
      content: [{ type: 'text' as const, text: result.message }],
      isError: !result.success,
    };
  },
);

server.tool(
  'x_post',
  'Post a tweet on X (Twitter). Main group only.',
  {
    content: z.string().max(280).describe('Tweet content (max 280 characters)'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use X integration tools.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `xpost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'x_post',
      requestId,
      content: args.content,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForXResult(requestId);
    return {
      content: [{ type: 'text' as const, text: result.message }],
      isError: !result.success,
    };
  },
);

server.tool(
  'x_like',
  'Like a tweet on X (Twitter). Main group only.',
  {
    tweet_url: z
      .string()
      .describe('Tweet URL (e.g., https://x.com/user/status/123) or tweet ID'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use X integration tools.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `xlike-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'x_like',
      requestId,
      tweetUrl: args.tweet_url,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForXResult(requestId);
    return {
      content: [{ type: 'text' as const, text: result.message }],
      isError: !result.success,
    };
  },
);

server.tool(
  'x_reply',
  'Reply to a tweet on X (Twitter). Main group only.',
  {
    tweet_url: z
      .string()
      .describe('Tweet URL (e.g., https://x.com/user/status/123) or tweet ID'),
    content: z.string().max(280).describe('Reply content (max 280 characters)'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use X integration tools.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `xreply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'x_reply',
      requestId,
      tweetUrl: args.tweet_url,
      content: args.content,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForXResult(requestId);
    return {
      content: [{ type: 'text' as const, text: result.message }],
      isError: !result.success,
    };
  },
);

server.tool(
  'x_retweet',
  'Retweet a tweet on X (Twitter). Main group only.',
  {
    tweet_url: z
      .string()
      .describe('Tweet URL (e.g., https://x.com/user/status/123) or tweet ID'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use X integration tools.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `xretweet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'x_retweet',
      requestId,
      tweetUrl: args.tweet_url,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForXResult(requestId);
    return {
      content: [{ type: 'text' as const, text: result.message }],
      isError: !result.success,
    };
  },
);

server.tool(
  'x_quote',
  'Quote-tweet on X (Twitter). Main group only.',
  {
    tweet_url: z
      .string()
      .describe('Tweet URL (e.g., https://x.com/user/status/123) or tweet ID'),
    comment: z
      .string()
      .max(280)
      .describe('Quote tweet comment (max 280 characters)'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Only the main group can use X integration tools.',
          },
        ],
        isError: true,
      };
    }

    const requestId = `xquote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpcFile(TASKS_DIR, {
      type: 'x_quote',
      requestId,
      tweetUrl: args.tweet_url,
      comment: args.comment,
      groupFolder,
      timestamp: new Date().toISOString(),
    });

    const result = await waitForXResult(requestId);
    return {
      content: [{ type: 'text' as const, text: result.message }],
      isError: !result.success,
    };
  },
);

// Start the stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
