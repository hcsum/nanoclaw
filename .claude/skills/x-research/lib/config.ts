import path from 'path';

const PROJECT_ROOT = process.env.NANOCLAW_ROOT || process.cwd();

function firstDefined(
  ...values: Array<string | undefined>
): string | undefined {
  for (const value of values) {
    if (value && value.trim()) return value;
  }
  return undefined;
}

export const config = {
  projectRoot: PROJECT_ROOT,
  webAccessCheckScript: path.join(
    PROJECT_ROOT,
    '.claude',
    'skills',
    'web-access',
    'scripts',
    'check-deps.sh',
  ),
  proxyBaseUrl:
    firstDefined(process.env.CDP_PROXY_BASE_URL) || 'http://127.0.0.1:3456',
  timeouts: {
    pageLoad: 3000,
    proxyRequest: 30000,
    setup: 130000,
  },
};
