import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import type http from 'http';

const { createServerMock, spawnMock } = vi.hoisted(() => ({
  createServerMock: vi.fn(),
  spawnMock: vi.fn(),
}));

vi.mock('http', () => ({
  default: {
    createServer: createServerMock,
  },
}));

vi.mock('child_process', () => ({
  spawn: spawnMock,
}));

vi.mock('./logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { startBrowserProxy } from './browser-proxy.js';

function createFakeProcess() {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
  };
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  return proc;
}

function createMockServer() {
  let handler: http.RequestListener | undefined;

  const server = {
    listen: vi.fn(
      (_port: number, _host: string, callback: () => void) => callback(),
    ),
    on: vi.fn(),
    close: vi.fn((callback?: () => void) => callback?.()),
    address: vi.fn(() => ({ port: 3002 })),
    setHandler(next: http.RequestListener) {
      handler = next;
    },
    getHandler(): http.RequestListener {
      if (!handler) throw new Error('Missing request handler');
      return handler;
    },
  };

  createServerMock.mockImplementation((next: http.RequestListener) => {
    server.setHandler(next);
    return server;
  });

  return server;
}

async function invokeHandler(
  handler: http.RequestListener,
  reqOptions: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  },
): Promise<{ statusCode: number; body: string }> {
  const req = new EventEmitter() as EventEmitter & {
    method: string;
    url: string;
    headers: Record<string, string>;
    setEncoding: (encoding: string) => void;
  };
  req.method = reqOptions.method;
  req.url = reqOptions.url;
  req.headers = reqOptions.headers;
  req.setEncoding = vi.fn();

  let statusCode = 200;
  const responseDone = new Promise<{ statusCode: number; body: string }>(
    (resolve) => {
      const res = {
        writeHead: vi.fn((code: number) => {
          statusCode = code;
        }),
        end: vi.fn((chunk?: string) => {
          resolve({ statusCode, body: chunk || '' });
        }),
      } as unknown as http.ServerResponse;

      void handler(
        req as unknown as http.IncomingMessage,
        res as unknown as http.ServerResponse,
      );
    },
  );

  if (reqOptions.body) req.emit('data', reqOptions.body);
  req.emit('end');

  return responseDone;
}

describe('browser-proxy', () => {
  beforeEach(() => {
    createServerMock.mockReset();
    spawnMock.mockReset();
  });

  it('forwards commands to host agent-browser in headed mode', async () => {
    const server = createMockServer();
    const child = createFakeProcess();
    spawnMock.mockReturnValue(child);

    const handle = await startBrowserProxy(0);
    const request = invokeHandler(server.getHandler(), {
      method: 'POST',
      url: '/exec',
      headers: {
        'content-type': 'application/json',
        'x-nanoclaw-browser-token': handle.token,
      },
      body: JSON.stringify({
        argv: ['open', 'https://example.com'],
        cwd: '/tmp/group',
      }),
    });

    await Promise.resolve();
    child.stdout.write('ok\n');
    child.emit('close', 0);

    const response = await request;
    const payload = JSON.parse(response.body) as {
      code: number;
      stdout: string;
      stderr: string;
    };

    expect(response.statusCode).toBe(200);
    expect(payload).toEqual({ code: 0, stdout: 'ok\n', stderr: '' });
    expect(spawnMock).toHaveBeenCalledWith(
      expect.any(String),
      ['open', 'https://example.com'],
      expect.objectContaining({
        cwd: '/tmp/group',
        env: expect.objectContaining({
          AGENT_BROWSER_HEADED: 'true',
        }),
      }),
    );

    expect(handle.port).toBe(3002);
  });

  it('rejects requests with the wrong token', async () => {
    const server = createMockServer();
    const handle = await startBrowserProxy(0);

    const response = await invokeHandler(server.getHandler(), {
      method: 'POST',
      url: '/exec',
      headers: {
        'content-type': 'application/json',
        'x-nanoclaw-browser-token': 'wrong-token',
      },
      body: JSON.stringify({ argv: ['snapshot'] }),
    });

    expect(response.statusCode).toBe(401);
    expect(spawnMock).not.toHaveBeenCalled();
    expect(handle.port).toBe(3002);
  });
});
