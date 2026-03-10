/**
 * Web.Cafe Integration - MCP Tool Definitions (Agent/Container Side)
 *
 * These tools run inside the container and communicate with the host via IPC.
 */

// @ts-ignore - SDK available in container environment only
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// IPC directories (inside container)
const IPC_DIR = '/workspace/ipc';
const TASKS_DIR = path.join(IPC_DIR, 'tasks');
const RESULTS_DIR = path.join(IPC_DIR, 'web_cafe_results');

function writeIpcFile(dir: string, data: object): string {
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filepath = path.join(dir, filename);
  const tempPath = `${filepath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filepath);
  return filename;
}

async function waitForResult(
  requestId: string,
  maxWait = 60000,
): Promise<{ success: boolean; message: string }> {
  const resultFile = path.join(RESULTS_DIR, `${requestId}.json`);
  const pollInterval = 1000;
  let elapsed = 0;

  while (elapsed < maxWait) {
    if (fs.existsSync(resultFile)) {
      try {
        const result = JSON.parse(fs.readFileSync(resultFile, 'utf-8'));
        fs.unlinkSync(resultFile);
        return result;
      } catch (err) {
        return { success: false, message: `Failed to read result: ${err}` };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    elapsed += pollInterval;
  }

  return { success: false, message: 'Request timed out' };
}

export interface SkillToolsContext {
  groupFolder: string;
  isMain: boolean;
}

/**
 * Create Web.Cafe integration MCP tools
 */
export function createWebCafeTools(ctx: SkillToolsContext) {
  const { groupFolder, isMain } = ctx;

  return [
    tool(
      'web_cafe_search',
      `Search Web.Cafe (哥飞的朋友们) for posts, tutorials, and experiences about SEO, keywords, and overseas entrepreneurship.

Main group only. Use this to research SEO strategies, keyword opportunities, monetization tactics, and tools mentioned by the community.`,
      {
        query: z.string().describe('Search query (e.g. "keyword research", "SEO tools", "Adsense")'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe('Number of results to fetch (1-50)'),
      },
      async (args: { query: string; limit: number }) => {
        if (!isMain) {
          return {
            content: [
              { type: 'text', text: 'Only the main group can use Web.Cafe integration tools.' },
            ],
            isError: true,
          };
        }

        const requestId = `webcafe-search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        writeIpcFile(TASKS_DIR, {
          type: 'web_cafe_search',
          requestId,
          query: args.query,
          limit: args.limit,
          groupFolder,
          timestamp: new Date().toISOString(),
        });

        const result = await waitForResult(requestId);
        return {
          content: [{ type: 'text', text: result.message }],
          isError: !result.success,
        };
      },
    ),

    tool(
      'web_cafe_read',
      `Read full content from a specific Web.Cafe URL (post, tutorial, or experience).

Main group only. Use this to extract detailed information from a specific article or discussion.`,
      {
        url: z.string().describe('Full URL to the Web.Cafe post/tutorial/experience'),
      },
      async (args: { url: string }) => {
        if (!isMain) {
          return {
            content: [
              { type: 'text', text: 'Only the main group can use Web.Cafe integration tools.' },
            ],
            isError: true,
          };
        }

        const requestId = `webcafe-read-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        writeIpcFile(TASKS_DIR, {
          type: 'web_cafe_read',
          requestId,
          url: args.url,
          groupFolder,
          timestamp: new Date().toISOString(),
        });

        const result = await waitForResult(requestId);
        return {
          content: [{ type: 'text', text: result.message }],
          isError: !result.success,
        };
      },
    ),

    tool(
      'web_cafe_browse',
      `Browse recent posts from a specific Web.Cafe section.

Main group only. Use this to monitor what the community is discussing, discover trending topics, or explore tutorials and experiences.`,
      {
        section: z
          .enum(['topics', 'tutorials', 'experiences', 'all'])
          .default('all')
          .describe('Section to browse: topics (posts), tutorials, experiences, or all'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe('Number of posts to fetch (1-50)'),
      },
      async (args: { section: string; limit: number }) => {
        if (!isMain) {
          return {
            content: [
              { type: 'text', text: 'Only the main group can use Web.Cafe integration tools.' },
            ],
            isError: true,
          };
        }

        const requestId = `webcafe-browse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        writeIpcFile(TASKS_DIR, {
          type: 'web_cafe_browse',
          requestId,
          section: args.section,
          limit: args.limit,
          groupFolder,
          timestamp: new Date().toISOString(),
        });

        const result = await waitForResult(requestId);
        return {
          content: [{ type: 'text', text: result.message }],
          isError: !result.success,
        };
      },
    ),
  ];
}
