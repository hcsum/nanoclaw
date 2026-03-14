import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';

import { logger } from './logger.js';

export interface BrowserProxyHandle {
  port: number;
  server: http.Server;
  token: string;
}

interface BrowserProxyRequest {
  argv?: unknown;
  cwd?: unknown;
}

interface BrowserProxyResponse {
  code: number;
  stdout: string;
  stderr: string;
}

function getCommandCandidates(): string[] {
  const configured = process.env.AGENT_BROWSER_HOST_COMMAND?.trim();
  const nodeSibling = path.join(path.dirname(process.execPath), 'agent-browser');

  return [configured, nodeSibling, 'agent-browser'].filter(
    (value): value is string => Boolean(value),
  );
}

function resolveAgentBrowserCommand(): string {
  for (const candidate of getCommandCandidates()) {
    if (candidate.includes(path.sep) && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return 'agent-browser';
}

function isValidArgv(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function readJsonBody(req: http.IncomingMessage): Promise<BrowserProxyRequest> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Browser proxy request too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? (JSON.parse(body) as BrowserProxyRequest) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function writeJson(
  res: http.ServerResponse,
  statusCode: number,
  body: BrowserProxyResponse | { error: string },
): void {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function executeBrowserCommand(
  command: string,
  argv: string[],
  cwd: string | undefined,
): Promise<BrowserProxyResponse> {
  return new Promise((resolve) => {
    const child = spawn(command, argv, {
      cwd,
      env: {
        ...process.env,
        AGENT_BROWSER_HEADED: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      resolve({
        code: 1,
        stdout,
        stderr: `${stderr}Failed to start host agent-browser: ${error.message}\n`,
      });
    });

    child.on('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

export async function startBrowserProxy(
  requestedPort: number,
): Promise<BrowserProxyHandle> {
  const command = resolveAgentBrowserCommand();
  const token = randomBytes(24).toString('hex');

  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/exec') {
      writeJson(res, 404, { error: 'Not found' });
      return;
    }

    if (req.headers['x-nanoclaw-browser-token'] !== token) {
      writeJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    try {
      const body = await readJsonBody(req);
      if (!isValidArgv(body.argv)) {
        writeJson(res, 400, { error: 'argv must be an array of strings' });
        return;
      }

      const cwd = typeof body.cwd === 'string' ? body.cwd : undefined;
      const result = await executeBrowserCommand(command, body.argv, cwd);

      logger.debug(
        {
          argv: body.argv,
          cwd,
          code: result.code,
        },
        'Host browser command completed',
      );

      writeJson(res, 200, result);
    } catch (error) {
      logger.warn({ error }, 'Host browser proxy request failed');
      writeJson(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(requestedPort, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine browser proxy port');
  }

  logger.info(
    {
      command,
      port: address.port,
    },
    'Host browser proxy started',
  );

  return {
    port: address.port,
    server,
    token,
  };
}
