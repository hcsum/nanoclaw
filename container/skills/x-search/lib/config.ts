function firstDefined(
  ...values: Array<string | undefined>
): string | undefined {
  for (const value of values) {
    if (value && value.trim()) return value;
  }
  return undefined;
}

export const config = {
  proxyBaseUrl:
    firstDefined(process.env.CDP_PROXY_BASE_URL) ||
    'http://host.docker.internal:3456',
  timeouts: {
    proxyRequest: 30_000,
  },
  webAccessHint:
    'The host browser proxy is not reachable. Use Web Access first so the host-side proxy is started, then retry.',
};
