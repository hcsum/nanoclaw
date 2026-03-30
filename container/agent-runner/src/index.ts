/**
 * NanoClaw Agent Runner
 * Runs inside a container, receives config via stdin, outputs result to stdout
 *
 * Input protocol:
 *   Stdin: Full ContainerInput JSON (read until EOF, like before)
 *   IPC:   Follow-up messages written as JSON files to /workspace/ipc/input/
 *          Files: {type:"message", text:"..."}.json — polled and consumed
 *          Sentinel: /workspace/ipc/input/_close — signals session end
 *
 * Stdout protocol:
 *   Each result is wrapped in OUTPUT_START_MARKER / OUTPUT_END_MARKER pairs.
 *   Multiple results may be emitted (one per agent teams result).
 *   Final marker after loop ends signals completion.
 */

import fs from 'fs';
import path from 'path';
import {
  query,
  HookCallback,
  PreCompactHookInput,
  Options,
} from '@anthropic-ai/claude-agent-sdk';
import { fileURLToPath } from 'url';

interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
}

interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

interface SessionEntry {
  sessionId: string;
  fullPath: string;
  summary: string;
  firstPrompt: string;
}

interface SessionsIndex {
  entries: SessionEntry[];
}

interface SDKUserMessage {
  type: 'user';
  message: { role: 'user'; content: string };
  parent_tool_use_id: null;
  session_id: string;
}

const IPC_INPUT_DIR = '/workspace/ipc/input';
const IPC_INPUT_CLOSE_SENTINEL = path.join(IPC_INPUT_DIR, '_close');
const IPC_POLL_MS = 500;
const LOCAL_SEO_MCP_DIR = '/workspace/tools/seo-mcp';

function createSeoMcpServerConfig(): {
  command: string;
  args: string[];
  env: Record<string, string>;
} {
  const env = {
    CAPSOLVER_API_KEY: process.env.CAPSOLVER_API_KEY || '',
    UV_CACHE_DIR: '/tmp/uv-cache',
    UV_TOOL_DIR: '/tmp/uv-tools',
  };

  if (fs.existsSync(path.join(LOCAL_SEO_MCP_DIR, 'pyproject.toml'))) {
    return {
      command: '/usr/local/bin/uvx',
      args: ['--from', LOCAL_SEO_MCP_DIR, 'seo-mcp'],
      env,
    };
  }

  return {
    command: '/usr/local/bin/uvx',
    args: ['--python', '3.11', 'seo-mcp'],
    env,
  };
}

/**
 * Push-based async iterable for streaming user messages to the SDK.
 * Keeps the iterable alive until end() is called, preventing isSingleUserTurn.
 */
class MessageStream {
  private queue: SDKUserMessage[] = [];
  private waiting: (() => void) | null = null;
  private done = false;

  push(text: string): void {
    this.queue.push({
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
      session_id: '',
    });
    this.waiting?.();
  }

  end(): void {
    this.done = true;
    this.waiting?.();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
    while (true) {
      while (this.queue.length > 0) {
        yield this.queue.shift()!;
      }
      if (this.done) return;
      await new Promise<void>((r) => {
        this.waiting = r;
      });
      this.waiting = null;
    }
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';

function writeOutput(output: ContainerOutput): void {
  console.log(OUTPUT_START_MARKER);
  console.log(JSON.stringify(output));
  console.log(OUTPUT_END_MARKER);
}

function log(message: string): void {
  console.error(`[agent-runner] ${message}`);
}

function redactSecret(value: string | undefined): string {
  if (!value) return 'unset';
  if (value.length <= 8) return `${value[0] ?? ''}***(${value.length})`;
  return `${value.slice(0, 4)}...${value.slice(-4)} (${value.length})`;
}

interface ToolUseBlock {
  id?: string;
  type?: string;
  name?: string;
  input?: unknown;
}

interface SkillInvocationRecord {
  timestamp: string;
  sessionId: string | null;
  assistantUuid: string | null;
  parentToolUseId: string | null;
  toolUseId: string | null;
  skillName: string;
  input: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function truncateForLog(value: string, max = 200): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function summarizeUnknown(value: unknown): string {
  if (typeof value === 'string') return truncateForLog(value);
  try {
    return truncateForLog(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function extractToolUseBlocks(message: unknown): ToolUseBlock[] {
  if (!isRecord(message)) return [];
  const assistantMessage = message.message;
  if (!isRecord(assistantMessage)) return [];
  const content = assistantMessage.content;
  if (!Array.isArray(content)) return [];

  return content.filter(
    (block): block is ToolUseBlock =>
      isRecord(block) &&
      block.type === 'tool_use' &&
      typeof block.name === 'string',
  );
}

function extractSkillName(input: unknown): string | null {
  if (typeof input === 'string' && input.trim().length > 0) {
    return input.trim();
  }

  if (!isRecord(input)) return null;

  const candidates = ['skill_name', 'skillName', 'name', 'skill', 'command'];
  for (const key of candidates) {
    const value = input[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  const firstStringEntry = Object.entries(input).find(
    ([, value]) => typeof value === 'string' && value.trim().length > 0,
  );
  return firstStringEntry ? (firstStringEntry[1] as string).trim() : null;
}

function appendSkillInvocationRecord(record: SkillInvocationRecord): void {
  const logsDir = '/workspace/group/logs';
  const logFile = path.join(logsDir, 'skill-invocations.jsonl');
  fs.mkdirSync(logsDir, { recursive: true });
  fs.appendFileSync(logFile, `${JSON.stringify(record)}\n`);
}

function logSkillInvocation(
  message: unknown,
  sessionId: string | undefined,
  seenToolUseIds: Set<string>,
  usedSkills: Set<string>,
): void {
  for (const block of extractToolUseBlocks(message)) {
    if (block.name !== 'Skill') continue;

    const toolUseId =
      typeof block.id === 'string' && block.id.trim().length > 0
        ? block.id.trim()
        : null;
    if (toolUseId && seenToolUseIds.has(toolUseId)) continue;
    if (toolUseId) seenToolUseIds.add(toolUseId);

    const skillName = extractSkillName(block.input) || '<unknown>';
    usedSkills.add(skillName);

    const assistantUuid =
      isRecord(message) && typeof message.uuid === 'string'
        ? message.uuid
        : null;
    const parentToolUseId =
      isRecord(message) && typeof message.parent_tool_use_id === 'string'
        ? message.parent_tool_use_id
        : null;

    appendSkillInvocationRecord({
      timestamp: new Date().toISOString(),
      sessionId: sessionId || null,
      assistantUuid,
      parentToolUseId,
      toolUseId,
      skillName,
      input: block.input ?? null,
    });

    log(
      `Skill invoked: ${skillName}${
        toolUseId ? ` toolUseId=${toolUseId}` : ''
      } input=${summarizeUnknown(block.input ?? null)}`,
    );
  }
}

/**
 * Packy and other Anthropic-compatible gateways commonly expect API-key auth.
 * When a custom base URL is configured, force key mode and drop token auth vars.
 */
function forceApiKeyModeForCustomBaseUrl(
  sdkEnv: Record<string, string | undefined>,
): void {
  if (!sdkEnv.ANTHROPIC_BASE_URL || !sdkEnv.ANTHROPIC_API_KEY) return;
  if (sdkEnv.ANTHROPIC_AUTH_TOKEN || sdkEnv.CLAUDE_CODE_OAUTH_TOKEN) {
    log(
      'Custom ANTHROPIC_BASE_URL detected; forcing API-key auth (dropping token-based auth env vars)',
    );
  }
  delete sdkEnv.ANTHROPIC_AUTH_TOKEN;
  delete sdkEnv.CLAUDE_CODE_OAUTH_TOKEN;
}

function isRedactedThinkingResumeError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('redacted_thinking') && message.includes('Invalid data')
  );
}

function getSessionSummary(
  sessionId: string,
  transcriptPath: string,
): string | null {
  const projectDir = path.dirname(transcriptPath);
  const indexPath = path.join(projectDir, 'sessions-index.json');

  if (!fs.existsSync(indexPath)) {
    log(`Sessions index not found at ${indexPath}`);
    return null;
  }

  try {
    const index: SessionsIndex = JSON.parse(
      fs.readFileSync(indexPath, 'utf-8'),
    );
    const entry = index.entries.find((e) => e.sessionId === sessionId);
    if (entry?.summary) {
      return entry.summary;
    }
  } catch (err) {
    log(
      `Failed to read sessions index: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return null;
}

/**
 * Archive the full transcript to conversations/ before compaction.
 */
function createPreCompactHook(assistantName?: string): HookCallback {
  return async (
    input: unknown,
    _toolUseId: string | undefined,
    _context: unknown,
  ) => {
    const preCompact = input as PreCompactHookInput;
    const transcriptPath = preCompact.transcript_path;
    const sessionId = preCompact.session_id;

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      log('No transcript found for archiving');
      return {};
    }

    try {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      const messages = parseTranscript(content);

      if (messages.length === 0) {
        log('No messages to archive');
        return {};
      }

      const summary = getSessionSummary(sessionId, transcriptPath);
      const name = summary ? sanitizeFilename(summary) : generateFallbackName();

      const conversationsDir = '/workspace/group/conversations';
      fs.mkdirSync(conversationsDir, { recursive: true });

      const date = new Date().toISOString().split('T')[0];
      const filename = `${date}-${name}.md`;
      const filePath = path.join(conversationsDir, filename);

      const markdown = formatTranscriptMarkdown(
        messages,
        summary,
        assistantName,
      );
      fs.writeFileSync(filePath, markdown);

      log(`Archived conversation to ${filePath}`);
    } catch (err) {
      log(
        `Failed to archive transcript: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {};
  };
}

function sanitizeFilename(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function generateFallbackName(): string {
  const time = new Date();
  return `conversation-${time.getHours().toString().padStart(2, '0')}${time.getMinutes().toString().padStart(2, '0')}`;
}

interface ParsedMessage {
  role: 'user' | 'assistant';
  content: string;
}

function parseTranscript(content: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'user' && entry.message?.content) {
        const text =
          typeof entry.message.content === 'string'
            ? entry.message.content
            : entry.message.content
                .map((c: { text?: string }) => c.text || '')
                .join('');
        if (text) messages.push({ role: 'user', content: text });
      } else if (entry.type === 'assistant' && entry.message?.content) {
        const textParts = entry.message.content
          .filter((c: { type: string }) => c.type === 'text')
          .map((c: { text: string }) => c.text);
        const text = textParts.join('');
        if (text) messages.push({ role: 'assistant', content: text });
      }
    } catch {}
  }

  return messages;
}

function formatTranscriptMarkdown(
  messages: ParsedMessage[],
  title?: string | null,
  assistantName?: string,
): string {
  const now = new Date();
  const formatDateTime = (d: Date) =>
    d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  const lines: string[] = [];
  lines.push(`# ${title || 'Conversation'}`);
  lines.push('');
  lines.push(`Archived: ${formatDateTime(now)}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of messages) {
    const sender = msg.role === 'user' ? 'User' : assistantName || 'Assistant';
    const content =
      msg.content.length > 2000
        ? msg.content.slice(0, 2000) + '...'
        : msg.content;
    lines.push(`**${sender}**: ${content}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Check for _close sentinel.
 */
function shouldClose(): boolean {
  if (fs.existsSync(IPC_INPUT_CLOSE_SENTINEL)) {
    try {
      fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL);
    } catch {
      /* ignore */
    }
    return true;
  }
  return false;
}

/**
 * Drain all pending IPC input messages.
 * Returns messages found, or empty array.
 */
function drainIpcInput(): string[] {
  try {
    fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });
    const files = fs
      .readdirSync(IPC_INPUT_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort();

    const messages: string[] = [];
    for (const file of files) {
      const filePath = path.join(IPC_INPUT_DIR, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        fs.unlinkSync(filePath);
        if (data.type === 'message' && data.text) {
          messages.push(data.text);
        }
      } catch (err) {
        log(
          `Failed to process input file ${file}: ${err instanceof Error ? err.message : String(err)}`,
        );
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore */
        }
      }
    }
    return messages;
  } catch (err) {
    log(`IPC drain error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/**
 * Wait for a new IPC message or _close sentinel.
 * Returns the messages as a single string, or null if _close.
 */
function waitForIpcMessage(): Promise<string | null> {
  return new Promise((resolve) => {
    const poll = () => {
      if (shouldClose()) {
        resolve(null);
        return;
      }
      const messages = drainIpcInput();
      if (messages.length > 0) {
        resolve(messages.join('\n'));
        return;
      }
      setTimeout(poll, IPC_POLL_MS);
    };
    poll();
  });
}

/**
 * Run a single query and stream results via writeOutput.
 * Uses MessageStream (AsyncIterable) to keep isSingleUserTurn=false,
 * allowing agent teams subagents to run to completion.
 * Also pipes IPC messages into the stream during the query.
 */
async function runQuery(
  prompt: string,
  sessionId: string | undefined,
  mcpServerPath: string,
  containerInput: ContainerInput,
  sdkEnv: Record<string, string | undefined>,
  resumeAt?: string,
): Promise<{
  newSessionId?: string;
  lastAssistantUuid?: string;
  closedDuringQuery: boolean;
}> {
  const stream = new MessageStream();
  stream.push(prompt);

  // Poll IPC for follow-up messages and _close sentinel during the query
  let ipcPolling = true;
  let closedDuringQuery = false;
  const pollIpcDuringQuery = () => {
    if (!ipcPolling) return;
    if (shouldClose()) {
      log('Close sentinel detected during query, ending stream');
      closedDuringQuery = true;
      stream.end();
      ipcPolling = false;
      return;
    }
    const messages = drainIpcInput();
    for (const text of messages) {
      log(`Piping IPC message into active query (${text.length} chars)`);
      stream.push(text);
    }
    setTimeout(pollIpcDuringQuery, IPC_POLL_MS);
  };
  setTimeout(pollIpcDuringQuery, IPC_POLL_MS);

  let newSessionId: string | undefined;
  let lastAssistantUuid: string | undefined;
  let messageCount = 0;
  let resultCount = 0;
  const seenSkillToolUseIds = new Set<string>();
  const usedSkills = new Set<string>();
  const selectedModel =
    process.env.ANTHROPIC_MODEL || process.env.MODEL || undefined;

  // Load global CLAUDE.md as additional system context (shared across all groups)
  const globalClaudeMdPath = '/workspace/global/CLAUDE.md';
  let globalClaudeMd: string | undefined;
  if (!containerInput.isMain && fs.existsSync(globalClaudeMdPath)) {
    globalClaudeMd = fs.readFileSync(globalClaudeMdPath, 'utf-8');
  }

  // Discover additional directories mounted at /workspace/extra/*
  // These are passed to the SDK so their CLAUDE.md files are loaded automatically
  const extraDirs: string[] = [];
  const extraBase = '/workspace/extra';
  if (fs.existsSync(extraBase)) {
    for (const entry of fs.readdirSync(extraBase)) {
      const fullPath = path.join(extraBase, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        extraDirs.push(fullPath);
      }
    }
  }
  if (extraDirs.length > 0) {
    log(`Additional directories: ${extraDirs.join(', ')}`);
  }

  const seoMcpServer = createSeoMcpServerConfig();

  const queryOptions: Options = {
    cwd: '/workspace/group',
    additionalDirectories: extraDirs.length > 0 ? extraDirs : undefined,
    resume: sessionId,
    resumeSessionAt: resumeAt,
    systemPrompt: globalClaudeMd
      ? {
          type: 'preset' as const,
          preset: 'claude_code' as const,
          append: globalClaudeMd,
        }
      : undefined,
    model: selectedModel,
    allowedTools: [
      'Bash',
      'Read',
      'Write',
      'Edit',
      'Glob',
      'Grep',
      'WebSearch',
      'WebFetch',
      'Task',
      'TaskOutput',
      'TaskStop',
      'TeamCreate',
      'TeamDelete',
      'SendMessage',
      'TodoWrite',
      'ToolSearch',
      'Skill',
      'NotebookEdit',
      'mcp__nanoclaw__*',
      'mcp__seo__*',
    ],
    env: sdkEnv,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    settingSources: ['project', 'user'],
    mcpServers: {
      nanoclaw: {
        command: 'node',
        args: [mcpServerPath],
        env: {
          NANOCLAW_CHAT_JID: containerInput.chatJid,
          NANOCLAW_GROUP_FOLDER: containerInput.groupFolder,
          NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
        },
      },
      seo: {
        command: seoMcpServer.command,
        args: seoMcpServer.args,
        env: seoMcpServer.env,
      },
    },
    hooks: {
      PreCompact: [
        { hooks: [createPreCompactHook(containerInput.assistantName)] },
      ],
    },
  };

  for await (const message of query({
    prompt: stream,
    options: queryOptions,
  })) {
    messageCount++;
    const msgType =
      message.type === 'system'
        ? `system/${(message as { subtype?: string }).subtype}`
        : message.type;
    log(`[msg #${messageCount}] type=${msgType}`);

    if (message.type === 'assistant' && 'uuid' in message) {
      lastAssistantUuid = (message as { uuid: string }).uuid;
      logSkillInvocation(
        message,
        newSessionId || sessionId,
        seenSkillToolUseIds,
        usedSkills,
      );
    }

    if (message.type === 'system' && message.subtype === 'init') {
      newSessionId = (message as { session_id: string }).session_id;
      log(`Session initialized: ${newSessionId}`);
    }

    if (
      message.type === 'system' &&
      (message as { subtype?: string }).subtype === 'task_notification'
    ) {
      const tn = message as {
        task_id: string;
        status: string;
        summary: string;
      };
      log(
        `Task notification: task=${tn.task_id} status=${tn.status} summary=${tn.summary}`,
      );
    }

    if (message.type === 'result') {
      resultCount++;
      const textResult =
        'result' in message ? (message as { result?: string }).result : null;
      log(
        `Result #${resultCount}: subtype=${message.subtype}${textResult ? ` text=${textResult.slice(0, 200)}` : ''}`,
      );
      writeOutput({
        status: 'success',
        result: textResult || null,
        newSessionId,
      });
    }
  }

  ipcPolling = false;
  if (usedSkills.size > 0) {
    log(
      `Skills used during query: ${Array.from(usedSkills).sort().join(', ')}`,
    );
  } else {
    log('Skills used during query: none');
  }
  log(
    `Query done. Messages: ${messageCount}, results: ${resultCount}, lastAssistantUuid: ${lastAssistantUuid || 'none'}, closedDuringQuery: ${closedDuringQuery}`,
  );
  return { newSessionId, lastAssistantUuid, closedDuringQuery };
}

async function main(): Promise<void> {
  let containerInput: ContainerInput;

  try {
    const stdinData = await readStdin();
    containerInput = JSON.parse(stdinData);
    try {
      fs.unlinkSync('/tmp/input.json');
    } catch {
      /* may not exist */
    }
    log(`Received input for group: ${containerInput.groupFolder}`);
  } catch (err) {
    writeOutput({
      status: 'error',
      result: null,
      error: `Failed to parse input: ${err instanceof Error ? err.message : String(err)}`,
    });
    process.exit(1);
  }

  // Credentials are injected by the host's credential proxy via ANTHROPIC_BASE_URL.
  // No real secrets exist in the container environment.
  const sdkEnv: Record<string, string | undefined> = { ...process.env };
  forceApiKeyModeForCustomBaseUrl(sdkEnv);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');

  let sessionId = containerInput.sessionId;
  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });

  // Clean up stale _close sentinel from previous container runs
  try {
    fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL);
  } catch {
    /* ignore */
  }

  // Build initial prompt (drain any pending IPC messages too)
  let prompt = containerInput.prompt;
  if (containerInput.isScheduledTask) {
    prompt = `[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]\n\n${prompt}`;
  }
  const pending = drainIpcInput();
  if (pending.length > 0) {
    log(`Draining ${pending.length} pending IPC messages into initial prompt`);
    prompt += '\n' + pending.join('\n');
  }

  // --- Slash command handling ---
  // Only known session slash commands are handled here. This prevents
  // accidental interception of user prompts that happen to start with '/'.
  const KNOWN_SESSION_COMMANDS = new Set(['/compact']);
  const trimmedPrompt = prompt.trim();
  const isSessionSlashCommand = KNOWN_SESSION_COMMANDS.has(trimmedPrompt);

  if (isSessionSlashCommand) {
    log(`Handling session command: ${trimmedPrompt}`);
    let slashSessionId: string | undefined;
    let compactBoundarySeen = false;
    let hadError = false;
    let resultEmitted = false;

    try {
      for await (const message of query({
        prompt: trimmedPrompt,
        options: {
          cwd: '/workspace/group',
          resume: sessionId,
          systemPrompt: undefined,
          allowedTools: [],
          env: sdkEnv,
          permissionMode: 'bypassPermissions' as const,
          allowDangerouslySkipPermissions: true,
          settingSources: ['project', 'user'] as const,
          hooks: {
            PreCompact: [
              { hooks: [createPreCompactHook(containerInput.assistantName)] },
            ],
          },
        },
      })) {
        const msgType =
          message.type === 'system'
            ? `system/${(message as { subtype?: string }).subtype}`
            : message.type;
        log(`[slash-cmd] type=${msgType}`);

        if (message.type === 'system' && message.subtype === 'init') {
          slashSessionId = message.session_id;
          log(`Session after slash command: ${slashSessionId}`);
        }

        // Observe compact_boundary to confirm compaction completed
        if (
          message.type === 'system' &&
          (message as { subtype?: string }).subtype === 'compact_boundary'
        ) {
          compactBoundarySeen = true;
          log('Compact boundary observed — compaction completed');
        }

        if (message.type === 'result') {
          const resultSubtype = (message as { subtype?: string }).subtype;
          const textResult =
            'result' in message
              ? (message as { result?: string }).result
              : null;

          if (resultSubtype?.startsWith('error')) {
            hadError = true;
            writeOutput({
              status: 'error',
              result: null,
              error: textResult || 'Session command failed.',
              newSessionId: slashSessionId,
            });
          } else {
            writeOutput({
              status: 'success',
              result: textResult || 'Conversation compacted.',
              newSessionId: slashSessionId,
            });
          }
          resultEmitted = true;
        }
      }
    } catch (err) {
      hadError = true;
      const errorMsg = err instanceof Error ? err.message : String(err);
      log(`Slash command error: ${errorMsg}`);
      writeOutput({ status: 'error', result: null, error: errorMsg });
    }

    log(
      `Slash command done. compactBoundarySeen=${compactBoundarySeen}, hadError=${hadError}`,
    );

    // Warn if compact_boundary was never observed — compaction may not have occurred
    if (!hadError && !compactBoundarySeen) {
      log(
        'WARNING: compact_boundary was not observed. Compaction may not have completed.',
      );
    }

    // Only emit final session marker if no result was emitted yet and no error occurred
    if (!resultEmitted && !hadError) {
      writeOutput({
        status: 'success',
        result: compactBoundarySeen
          ? 'Conversation compacted.'
          : 'Compaction requested but compact_boundary was not observed.',
        newSessionId: slashSessionId,
      });
    } else if (!hadError) {
      // Emit session-only marker so host updates session tracking
      writeOutput({
        status: 'success',
        result: null,
        newSessionId: slashSessionId,
      });
    }
    return;
  }
  // --- End slash command handling ---

  log(
    `Agent config: model=${process.env.ANTHROPIC_MODEL || process.env.MODEL || 'default'}, baseUrl=${process.env.ANTHROPIC_BASE_URL || 'unset'}, apiKey=${redactSecret(process.env.ANTHROPIC_API_KEY)}, authToken=${redactSecret(process.env.ANTHROPIC_AUTH_TOKEN || process.env.CLAUDE_CODE_OAUTH_TOKEN)}`,
  );

  // Query loop: run query → wait for IPC message → run new query → repeat
  let resumeAt: string | undefined;
  try {
    while (true) {
      log(
        `Starting query (session: ${sessionId || 'new'}, resumeAt: ${resumeAt || 'latest'}, resumeRequested: ${sessionId || resumeAt ? 'yes' : 'no'})...`,
      );

      let queryResult;
      try {
        queryResult = await runQuery(
          prompt,
          sessionId,
          mcpServerPath,
          containerInput,
          sdkEnv,
          resumeAt,
        );
      } catch (err) {
        // Best-effort resume: if resume fails, retry once with a fresh session.
        // This keeps the run alive even when a provider/gateway rejects resume payloads.
        if (!sessionId && !resumeAt) {
          throw err;
        }
        const reason = err instanceof Error ? err.message : String(err);
        if (isRedactedThinkingResumeError(err)) {
          log(
            'Provider rejected redacted_thinking during resume. Retrying once without resume context.',
          );
        } else {
          log(
            `Resume attempt failed (${reason}). Retrying once without resume context.`,
          );
        }
        sessionId = undefined;
        resumeAt = undefined;
        queryResult = await runQuery(
          prompt,
          undefined,
          mcpServerPath,
          containerInput,
          sdkEnv,
          undefined,
        );
      }

      if (queryResult.newSessionId) {
        sessionId = queryResult.newSessionId;
      }
      if (queryResult.lastAssistantUuid) {
        resumeAt = queryResult.lastAssistantUuid;
      }

      // If _close was consumed during the query, exit immediately.
      // Don't emit a session-update marker (it would reset the host's
      // idle timer and cause a 30-min delay before the next _close).
      if (queryResult.closedDuringQuery) {
        log('Close sentinel consumed during query, exiting');
        break;
      }

      // Emit session update so host can track it
      writeOutput({ status: 'success', result: null, newSessionId: sessionId });

      log('Query ended, waiting for next IPC message...');

      // Wait for the next message or _close sentinel
      const nextMessage = await waitForIpcMessage();
      if (nextMessage === null) {
        log('Close sentinel received, exiting');
        break;
      }

      log(`Got new message (${nextMessage.length} chars), starting new query`);
      prompt = nextMessage;
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Agent error: ${errorMessage}`);
    writeOutput({
      status: 'error',
      result: null,
      newSessionId: sessionId,
      error: errorMessage,
    });
    process.exit(1);
  }
}

main();
