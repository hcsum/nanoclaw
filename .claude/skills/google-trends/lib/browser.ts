import { chromium, BrowserContext, Locator, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

import { config } from './config.js';

export { config };

export interface ScriptResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

export interface TrendQueryRow {
  query: string;
  change: string;
}

export interface TrendKeywordResult {
  keyword: string;
  averageInterest: number | null;
  topQueries: TrendQueryRow[];
  risingQueries: TrendQueryRow[];
}

export interface TrendComparisonData {
  url: string;
  geo: string;
  date: string;
  keywords: TrendKeywordResult[];
}

const AVG_HEADING_PATTERNS = ['Average interest'];
const QUERY_HEADING_PATTERNS = ['Commonly searched queries', 'Related queries'];
const QUERY_CHANGE_PATTERN = /^(?:Breakout|[+-]?\d[\d,]*%)$/i;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeRepeatedly(value: string): string {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

export function readInput<T>(): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error(`Invalid JSON input: ${String(err)}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

export function writeResult(result: ScriptResult): void {
  console.log(JSON.stringify(result));
}

export function cleanupLockFiles(): void {
  for (const lockFile of [
    'SingletonLock',
    'SingletonSocket',
    'SingletonCookie',
  ]) {
    const lockPath = path.join(config.browserDataDir, lockFile);
    if (fs.existsSync(lockPath)) {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // ignore
      }
    }
  }
}

export async function getBrowserContext(): Promise<BrowserContext> {
  cleanupLockFiles();

  return chromium.launchPersistentContext(config.browserDataDir, {
    executablePath: config.chromePath,
    headless: false,
    viewport: config.viewport,
    args: config.chromeArgs,
    ignoreDefaultArgs: config.chromeIgnoreDefaultArgs,
    proxy: config.browserProxy,
  });
}

export function normalizeKeyword(keyword: string): string {
  return normalizeText(keyword).slice(0, config.limits.maxKeywordLength);
}

export function normalizeKeywords(input: string[]): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const raw of input) {
    const keyword = normalizeKeyword(raw);
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
    if (keywords.length >= config.limits.maxKeywords) break;
  }

  return keywords;
}

export function extractKeywordsFromExploreUrl(exploreUrl: string): string[] {
  let parsed: URL;

  try {
    parsed = new URL(exploreUrl);
  } catch {
    return [];
  }

  const query = parsed.searchParams.get('q');
  if (!query) return [];

  return normalizeKeywords(
    decodeRepeatedly(query)
      .split(',')
      .map((value) => decodeRepeatedly(value)),
  );
}

export function buildExploreUrl(input: {
  keywords: string[];
  geo?: string;
  date?: string;
}): string {
  const url = new URL(config.baseUrl);
  url.searchParams.set('q', input.keywords.join(','));
  url.searchParams.set('date', input.date || config.defaults.date);
  url.searchParams.set('geo', input.geo || config.defaults.geo);
  return url.toString();
}

export async function dismissConsentDialogs(page: Page): Promise<void> {
  const selectors = [
    'button:has-text("Got it")',
    'button:has-text("I agree")',
    'button:has-text("Accept all")',
    'button:has-text("Accept")',
    '[role="button"]:has-text("Got it")',
    '[role="button"]:has-text("I agree")',
    '[role="button"]:has-text("Accept all")',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click().catch(() => undefined);
      await page.waitForTimeout(config.timeouts.afterClick);
      break;
    }
  }
}

export async function openExplorePage(
  context: BrowserContext,
  url: string,
): Promise<Page> {
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(url, {
    timeout: config.timeouts.navigation,
    waitUntil: 'domcontentloaded',
  });
  await dismissConsentDialogs(page);
  await page.waitForTimeout(config.timeouts.pageLoad);
  return page;
}

async function collectSectionLines(
  page: Page,
  _headingPatterns: string[],
): Promise<string[]> {
  const bodyText = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  return bodyText
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function parseNumber(value: string): number | null {
  const match = value.match(/\b(100|[1-9]?\d)\b/);
  if (!match) return null;
  return Number(match[1]);
}

export function parseAverageInterestFromLines(
  lines: string[],
  keywords: string[],
): Record<string, number | null> {
  const normalizedLines = lines.map(normalizeText);
  const result: Record<string, number | null> = {};

  for (const keyword of keywords) {
    result[keyword] = null;
    const keywordPattern = new RegExp(`^${escapeRegex(keyword)}$`, 'i');

    for (let index = 0; index < normalizedLines.length; index += 1) {
      const line = normalizedLines[index];
      if (!keywordPattern.test(line)) continue;

      for (
        let lookahead = index;
        lookahead < Math.min(index + 5, normalizedLines.length);
        lookahead += 1
      ) {
        const maybeNumber = parseNumber(normalizedLines[lookahead]);
        if (maybeNumber != null) {
          result[keyword] = maybeNumber;
          break;
        }
      }

      if (result[keyword] != null) break;
    }

    if (result[keyword] != null) continue;

    for (const line of normalizedLines) {
      if (!line.toLowerCase().includes(keyword.toLowerCase())) continue;
      const maybeNumber = parseNumber(line);
      if (maybeNumber != null) {
        result[keyword] = maybeNumber;
        break;
      }
    }
  }

  if (keywords.some((keyword) => result[keyword] == null)) {
    const headingIndex = normalizedLines.findIndex(
      (line) => line.toLowerCase() === 'average interest',
    );

    if (headingIndex >= 0) {
      const trailingNumbers = normalizedLines
        .slice(headingIndex + 1)
        .map((line) => parseNumber(line))
        .filter((value): value is number => value != null);

      if (trailingNumbers.length >= keywords.length) {
        const values = trailingNumbers.slice(-keywords.length);
        keywords.forEach((keyword, index) => {
          result[keyword] = values[index] ?? null;
        });
      }
    }
  }

  return result;
}

function shouldIgnoreQueryLine(line: string, keyword: string): boolean {
  const normalized = normalizeText(line);
  if (!normalized) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (/^(north|south|east|west)$/i.test(normalized)) return true;
  if (
    QUERY_HEADING_PATTERNS.some(
      (pattern) => pattern.toLowerCase() === normalized.toLowerCase(),
    )
  ) {
    return true;
  }
  if (
    /^(Top|Rising|Queries|Searches for|Query|More query actions)$/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    /^People who searched for .* also searched for these queries$/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (normalized.toLowerCase() === keyword.toLowerCase()) return true;
  return false;
}

function sliceRelevantQueryLines(lines: string[], keyword: string): string[] {
  const normalizedLines = lines.map(normalizeText).filter(Boolean);
  const marker = `people who searched for ${keyword.toLowerCase()} also searched for these queries`;
  const markerIndex = normalizedLines.findIndex(
    (line) => line.toLowerCase() === marker,
  );

  if (markerIndex < 0) {
    return normalizedLines;
  }

  const sliced = normalizedLines.slice(markerIndex + 1);
  const stopIndex = sliced.findIndex((line) =>
    /^(Privacy|Terms|Send feedback|About|help|Gemini in Google Trends)/i.test(
      line,
    ),
  );

  return stopIndex >= 0 ? sliced.slice(0, stopIndex) : sliced;
}

function parseQueryRows(lines: string[], keyword: string): TrendQueryRow[] {
  const rows: TrendQueryRow[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    if (shouldIgnoreQueryLine(current, keyword)) continue;

    const inlineMatch = current.match(/^(.*?)(Breakout|[+-]?\d[\d,]*%)$/i);
    if (inlineMatch) {
      const query = normalizeText(inlineMatch[1]);
      const change = normalizeText(inlineMatch[2]);
      if (query) rows.push({ query, change });
      continue;
    }

    const next = lines[index + 1] || '';
    const nextNext = lines[index + 2] || '';
    if (
      /^(north|south|east|west)$/i.test(next) &&
      QUERY_CHANGE_PATTERN.test(nextNext)
    ) {
      rows.push({ query: current, change: nextNext });
      index += 2;
      continue;
    }

    if (QUERY_CHANGE_PATTERN.test(next)) {
      rows.push({ query: current, change: next });
      index += 1;
    }
  }

  const uniqueRows: TrendQueryRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.query.toLowerCase()}|${row.change.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
    if (uniqueRows.length >= config.limits.maxTopQueries) break;
  }

  return uniqueRows;
}

export function parseQueriesFromLines(
  lines: string[],
  keyword: string,
): { topQueries: TrendQueryRow[]; risingQueries: TrendQueryRow[] } {
  const normalizedLines = sliceRelevantQueryLines(lines, keyword);
  const queryIndexes: number[] = [];

  normalizedLines.forEach((line, index) => {
    if (line.toLowerCase() === 'query') {
      queryIndexes.push(index);
    }
  });

  const firstQueryIndex = queryIndexes[0] ?? -1;
  const secondQueryIndex = queryIndexes[1] ?? normalizedLines.length;
  const topLines =
    firstQueryIndex >= 0
      ? normalizedLines.slice(firstQueryIndex + 1, secondQueryIndex)
      : normalizedLines;
  const risingLines =
    secondQueryIndex < normalizedLines.length
      ? normalizedLines.slice(secondQueryIndex + 1)
      : [];

  return {
    topQueries: parseQueryRows(topLines, keyword),
    risingQueries: parseQueryRows(risingLines, keyword),
  };
}

async function firstVisible(locators: Locator[]): Promise<Locator | null> {
  for (const locator of locators) {
    const target = locator.first();
    if (await target.isVisible().catch(() => false)) {
      return target;
    }
  }
  return null;
}

export async function waitForTrendsContent(page: Page): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < config.timeouts.navigation) {
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => '');
    const hasAverage = AVG_HEADING_PATTERNS.some((pattern) =>
      text.includes(pattern),
    );
    const hasQueries = QUERY_HEADING_PATTERNS.some((pattern) =>
      text.includes(pattern),
    );

    if (hasAverage && hasQueries) {
      return;
    }

    await page.waitForTimeout(config.timeouts.contentPoll);
  }
}

export async function clickKeywordChip(
  page: Page,
  keyword: string,
): Promise<boolean> {
  const escapedKeyword = keyword.replace(/"/g, '\\"');
  const locator = await firstVisible([
    page.locator(`button:has-text("${escapedKeyword}")`),
    page.locator(`[role="button"]:has-text("${escapedKeyword}")`),
    page.locator(`text="${escapedKeyword}"`),
  ]);

  if (!locator) return false;

  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await locator.click().catch(() => undefined);
  await page.waitForTimeout(config.timeouts.afterClick);
  return true;
}

async function waitForKeywordQueries(
  page: Page,
  keyword: string,
): Promise<void> {
  const marker = `People who searched for ${keyword} also searched for these queries`;
  const startedAt = Date.now();

  while (Date.now() - startedAt < config.timeouts.navigation) {
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => '');
    if (text.includes(marker)) {
      return;
    }
    await page.waitForTimeout(config.timeouts.contentPoll);
  }
}

export async function extractAverageInterest(
  page: Page,
  keywords: string[],
): Promise<Record<string, number | null>> {
  const lines = await collectSectionLines(page, AVG_HEADING_PATTERNS);
  return parseAverageInterestFromLines(lines, keywords);
}

export async function extractTopQueriesForKeyword(
  page: Page,
  keyword: string,
): Promise<{ topQueries: TrendQueryRow[]; risingQueries: TrendQueryRow[] }> {
  await clickKeywordChip(page, keyword);
  await waitForKeywordQueries(page, keyword);
  await page.waitForTimeout(config.timeouts.afterClick);
  const lines = await collectSectionLines(page, QUERY_HEADING_PATTERNS);
  return parseQueriesFromLines(lines, keyword);
}

export function formatTrendComparisonMessage(
  data: TrendComparisonData,
): string {
  const lines: string[] = [];
  lines.push(
    `Google Trends comparison for ${data.keywords.map((item) => item.keyword).join(', ')}`,
  );
  lines.push(`Range: ${data.date}`);
  lines.push(`Geo: ${data.geo}`);
  lines.push(`URL: ${data.url}`);
  lines.push('');
  lines.push('Average interest');

  for (const item of data.keywords) {
    lines.push(
      `- ${item.keyword}: ${item.averageInterest != null ? String(item.averageInterest) : 'not captured'}`,
    );
  }

  for (const item of data.keywords) {
    lines.push('');
    lines.push(`Top queries for ${item.keyword}`);
    if (item.topQueries.length === 0) {
      lines.push('- No top queries captured.');
      continue;
    }
    for (const row of item.topQueries) {
      lines.push(`- ${row.query} (${row.change})`);
    }
  }

  return lines.join('\n');
}

export async function runScript<T>(
  handler: (input: T) => Promise<ScriptResult>,
): Promise<void> {
  try {
    const input = await readInput<T>();
    const result = await handler(input);
    writeResult(result);
  } catch (err) {
    writeResult({
      success: false,
      message: `Script execution failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    process.exit(1);
  }
}
