import type { Agent } from 'https';

import { ProxyAgent } from 'proxy-agent';

import { readEnvFile } from './env.js';

const proxyEnvFromFile = readEnvFile([
  'HTTP_PROXY',
  'http_proxy',
  'HTTPS_PROXY',
  'https_proxy',
  'ALL_PROXY',
  'all_proxy',
  'NO_PROXY',
  'no_proxy',
]);

const PROXY_ENV_PAIRS = [
  ['HTTP_PROXY', 'http_proxy'],
  ['HTTPS_PROXY', 'https_proxy'],
  ['ALL_PROXY', 'all_proxy'],
  ['NO_PROXY', 'no_proxy'],
] as const;

type ProxySummary = Partial<{
  httpProxy: string;
  httpsProxy: string;
  allProxy: string;
  noProxy: string;
}>;

let cachedProxyAgent: ProxyAgent | undefined;

function firstDefined(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim().length > 0)?.trim();
}

function sanitizeProxyUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      parsed.username = '';
      parsed.password = '';
    }
    return parsed.toString();
  } catch {
    return value;
  }
}

export function prepareProxyEnvironment(): ProxySummary | null {
  for (const [upperKey, lowerKey] of PROXY_ENV_PAIRS) {
    const value = firstDefined(
      process.env[upperKey],
      process.env[lowerKey],
      proxyEnvFromFile[upperKey],
      proxyEnvFromFile[lowerKey],
    );
    if (!value) continue;

    process.env[upperKey] ||= value;
    process.env[lowerKey] ||= value;
  }

  if (
    !process.env.NODE_USE_ENV_PROXY &&
    firstDefined(
      process.env.HTTP_PROXY,
      process.env.http_proxy,
      process.env.HTTPS_PROXY,
      process.env.https_proxy,
      process.env.ALL_PROXY,
      process.env.all_proxy,
    )
  ) {
    process.env.NODE_USE_ENV_PROXY = '1';
  }

  const summary: ProxySummary = {
    httpProxy: firstDefined(process.env.HTTP_PROXY, process.env.http_proxy)
      ? sanitizeProxyUrl(
          firstDefined(process.env.HTTP_PROXY, process.env.http_proxy)!,
        )
      : undefined,
    httpsProxy: firstDefined(process.env.HTTPS_PROXY, process.env.https_proxy)
      ? sanitizeProxyUrl(
          firstDefined(process.env.HTTPS_PROXY, process.env.https_proxy)!,
        )
      : undefined,
    allProxy: firstDefined(process.env.ALL_PROXY, process.env.all_proxy)
      ? sanitizeProxyUrl(
          firstDefined(process.env.ALL_PROXY, process.env.all_proxy)!,
        )
      : undefined,
    noProxy: firstDefined(process.env.NO_PROXY, process.env.no_proxy),
  };

  if (
    !summary.httpProxy &&
    !summary.httpsProxy &&
    !summary.allProxy &&
    !summary.noProxy
  ) {
    return null;
  }

  return summary;
}

export function getProxyAgent(): Agent | undefined {
  if (!prepareProxyEnvironment()) return undefined;

  if (!cachedProxyAgent) {
    cachedProxyAgent = new ProxyAgent();
  }

  return cachedProxyAgent as unknown as Agent;
}
