import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

import { config } from './config.js';

export { config };

export interface ScriptResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface CandidateLink {
  title: string;
  url: string;
  snippet?: string;
}

export interface PageInsight {
  url: string;
  title: string;
  h1: string;
  headings: string[];
  snippet: string;
  bodyExcerpt: string;
  tags: string[];
  date: string;
  internalLinks: CandidateLink[];
}

export interface HomepageSection {
  sectionTitle: string;
  items: Array<{
    title: string;
    url: string;
    meta: string;
  }>;
}

export interface HomepageSnapshot {
  title: string;
  sections: HomepageSection[];
}

const IGNORED_WEB_CAFE_PATHS = new Set([
  '/',
  '/all',
  '/topics',
  '/experiences',
  '/tutorials',
  '/labels',
  '/competition',
  '/messages',
  '/myTopic',
]);

const IGNORED_WEB_CAFE_PATH_PREFIXES = [
  '/label/',
  '/settings',
  '/profile',
  '/user/',
  '/users/',
] as const;

const IGNORED_WEB_CAFE_TITLES = [
  'Home',
  'Open user menu',
  '创建新帖子',
  '我的帖子',
  '群聊',
] as const;

const CONTENT_WEB_CAFE_PATH_PREFIXES = ['/topic/', '/tutorial/'] as const;

export async function readInput<T>(): Promise<T> {
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
  if (!fs.existsSync(config.authPath)) {
    throw new Error(
      'Web.Cafe authentication not configured. Run npx dotenv -e .env -- npx tsx .claude/skills/web-cafe/scripts/setup.ts first.',
    );
  }

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

export async function openPage(
  context: BrowserContext,
  url: string,
): Promise<Page> {
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(url, {
    timeout: config.timeouts.navigation,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(config.timeouts.pageLoad);
  return page;
}

export function clampPageLimit(input: unknown, fallback = 4): number {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized < config.limits.minPages) return config.limits.minPages;
  if (normalized > config.limits.maxPages) return config.limits.maxPages;
  return normalized;
}

export function normalizeWebCafeUrl(url: string): string {
  try {
    const parsed = new URL(url, config.baseUrl);
    if (parsed.hostname !== 'new.web.cafe') {
      throw new Error('Only new.web.cafe URLs are supported');
    }
    parsed.hash = '';
    return parsed.toString();
  } catch (err) {
    throw new Error(
      `Invalid Web.Cafe URL: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function isIgnoredWebCafePath(pathname: string, search = ''): boolean {
  if (IGNORED_WEB_CAFE_PATHS.has(pathname) && !search) {
    return true;
  }

  return IGNORED_WEB_CAFE_PATH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

export function isLikelyWebCafeContentPath(pathname: string): boolean {
  return CONTENT_WEB_CAFE_PATH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

export function shouldKeepWebCafeLinkCandidate(input: {
  pathname: string;
  search?: string;
  title: string;
}): boolean {
  const title = input.title.replace(/\s+/g, ' ').trim();

  if (!title || title.length < 2) return false;
  if (
    IGNORED_WEB_CAFE_TITLES.includes(
      title as (typeof IGNORED_WEB_CAFE_TITLES)[number],
    )
  ) {
    return false;
  }
  if (isIgnoredWebCafePath(input.pathname, input.search || '')) return false;

  return isLikelyWebCafeContentPath(input.pathname);
}

export async function ensureLikelyLoggedIn(page: Page): Promise<void> {
  const loginVisible = await page
    .locator('text=/^登\s*录$/')
    .first()
    .isVisible()
    .catch(() => false);

  const avatarVisible = await page
    .locator(
      'img[alt*="avatar" i], button[aria-label*="account" i], [data-state="open"] img',
    )
    .first()
    .isVisible()
    .catch(() => false);

  if (loginVisible && !avatarVisible) {
    throw new Error(
      'Web.Cafe login appears to be missing or expired. Run the setup script again.',
    );
  }
}

export async function collectCandidateLinks(
  page: Page,
  maxLinks = 20,
): Promise<CandidateLink[]> {
  const links = await page.evaluate((origin) => {
    const items: Array<{ title: string; url: string; snippet: string }> = [];
    const seen = new Set<string>();
    const anchors = Array.from(
      document.querySelectorAll('main a[href], a[href]'),
    ) as HTMLAnchorElement[];

    for (const anchor of anchors) {
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#')) continue;

      const url = new URL(href, origin);
      if (url.hostname !== 'new.web.cafe') continue;

      const title = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
      if (!title || title.length < 2) continue;

      const ignoredTitles = new Set([
        'Home',
        'Open user menu',
        '创建新帖子',
        '我的帖子',
        '群聊',
      ]);
      const ignoredPaths = new Set([
        '/',
        '/all',
        '/topics',
        '/experiences',
        '/tutorials',
        '/labels',
        '/competition',
        '/messages',
        '/myTopic',
      ]);

      if (ignoredTitles.has(title)) continue;
      if (ignoredPaths.has(url.pathname) && !url.search) continue;
      if (
        url.pathname.startsWith('/label/') ||
        url.pathname.startsWith('/settings') ||
        url.pathname.startsWith('/profile') ||
        url.pathname.startsWith('/user/') ||
        url.pathname.startsWith('/users/')
      ) {
        continue;
      }
      if (
        !url.pathname.startsWith('/topic/') &&
        !url.pathname.startsWith('/tutorial/')
      ) {
        continue;
      }

      const card = anchor.closest('article, li, section, div');
      const snippet = (card?.textContent || '').replace(/\s+/g, ' ').trim();
      const key = url.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ title, url: key, snippet });
    }

    return items;
  }, config.baseUrl);

  return links.slice(0, maxLinks);
}

export async function extractHomepageSnapshot(
  page: Page,
): Promise<HomepageSnapshot> {
  return page.evaluate((origin) => {
    const sections = [] as Array<{
      sectionTitle: string;
      items: Array<{ title: string; url: string; meta: string }>;
    }>;
    const containers = Array.from(document.querySelectorAll('section'));

    for (const container of containers) {
      const heading = (
        (container.querySelector('li')?.textContent || '') as string
      )
        .replace(/\s+/g, ' ')
        .trim();
      if (!heading) continue;
      if (!/最新帖子|最新经验|最新教程|教程专栏|标签/.test(heading)) continue;

      const items = [] as Array<{ title: string; url: string; meta: string }>;
      const seen = new Set();

      const rows = Array.from(
        container.querySelectorAll(
          'div[class*="hover:"], a[href], li, p, span',
        ),
      );

      for (const row of rows) {
        const raw = ((row.textContent as string) || '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!raw || raw === heading || /查看所有/.test(raw)) continue;

        let title = raw;
        const titleSpan = row.querySelector('span');
        if (titleSpan && titleSpan.textContent) {
          title = titleSpan.textContent.replace(/\s+/g, ' ').trim();
        }

        if (!title || title.length < 4) continue;
        if (/^\d{4}-\d{2}-\d{2}/.test(title)) continue;
        if (/^#/.test(title)) continue;
        if (!/[ - - - - - - - -]/.test(title) && title.length < 6) continue;
        if (seen.has(title)) continue;
        seen.add(title);

        const anchor = row.querySelector('a[href]');
        const url = anchor
          ? new URL(anchor.getAttribute('href') || '', origin).toString()
          : '';

        const meta = raw.replace(/\s+/g, ' ').trim().slice(0, 160);
        items.push({ title, url, meta });
        if (items.length >= 5) break;
      }

      if (items.length > 0) {
        sections.push({ sectionTitle: heading, items });
      }
      if (sections.length >= 5) break;
    }

    return {
      title: (document.title || '').replace(/\s+/g, ' ').trim(),
      sections,
    };
  }, config.baseUrl);
}

export async function collectHomepageCandidateLinks(
  page: Page,
  maxLinks = 20,
): Promise<CandidateLink[]> {
  const links = await page.evaluate((origin) => {
    const buckets = [] as Array<{
      title: string;
      url: string;
      snippet: string;
      score: number;
    }>;
    const seen = new Set();
    const sections = Array.from(document.querySelectorAll('section'));

    const fixedLinks = [
      ['最新帖子', '/topics', 20],
      ['最新经验', '/experiences', 18],
      ['最新教程', '/tutorials?status=article', 18],
      ['教程专栏', '/tutorials?status=column', 17],
    ] as Array<[string, string, number]>;

    for (const [title, href, score] of fixedLinks) {
      const url = new URL(href, origin).toString();
      seen.add(url);
      buckets.push({
        title,
        url,
        snippet: `Homepage section: ${title}`,
        score,
      });
    }

    for (const section of sections) {
      const sectionTitle = (section.querySelector('li')?.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!sectionTitle) continue;
      const sectionBoost =
        /最新帖子|最新经验|最新教程|教程专栏|热门|推荐/i.test(sectionTitle)
          ? 10
          : 3;
      const anchors = Array.from(section.querySelectorAll('a[href]'));

      for (const anchor of anchors) {
        const href = anchor.getAttribute('href') || '';
        if (!href || href.startsWith('#')) continue;
        const url = new URL(href, origin);
        if (url.hostname !== 'new.web.cafe') continue;
        if (seen.has(url.toString())) continue;

        const pathname = url.pathname;
        if (
          [
            '/',
            '/all',
            '/topics',
            '/experiences',
            '/tutorials',
            '/labels',
            '/competition',
          ].includes(pathname) &&
          !url.search
        ) {
          continue;
        }
        if (pathname.startsWith('/label/')) continue;

        const title = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
        if (!title || title.length < 4) continue;

        const card = anchor.closest('article, li, div');
        const snippet = ((card && card.textContent) || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 180);

        let score = sectionBoost;
        if (/查看所有/.test(title)) score -= 5;
        if (/^#/.test(title)) score += 2;
        if (/tutorial|topic|experience/.test(pathname)) score += 4;
        if (/群聊|我的帖子/.test(title)) score -= 6;

        seen.add(url.toString());
        buckets.push({ title, url: url.toString(), snippet, score });
      }
    }

    buckets.sort((a, b) => b.score - a.score);
    return buckets;
  }, config.baseUrl);

  return links.slice(0, maxLinks).map(({ title, url, snippet }) => ({
    title,
    url,
    snippet,
  }));
}

export async function extractHomepageBuzzSnapshot(
  page: Page,
): Promise<HomepageSnapshot> {
  return page.evaluate(() => {
    const sections = [] as Array<{
      sectionTitle: string;
      items: Array<{ title: string; url: string; meta: string }>;
    }>;
    const containers = Array.from(document.querySelectorAll('section'));

    for (const container of containers) {
      const heading = String(container.querySelector('li')?.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!/最新帖子|最新经验|最新教程|教程专栏|标签/.test(heading)) continue;

      const items = [] as Array<{ title: string; url: string; meta: string }>;
      const seen = new Set<string>();
      const rows = Array.from(
        container.querySelectorAll('div[class*="hover:"], a[href]'),
      );

      for (const row of rows) {
        const raw = String(row.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!raw || raw === heading || /查看所有/.test(raw)) continue;

        let title = raw;
        const titleSpan = row.querySelector('span');
        if (titleSpan?.textContent) {
          title = titleSpan.textContent.replace(/\s+/g, ' ').trim();
        }

        const meta = raw.slice(0, 160);
        if (!title || title.length < 4) continue;
        if (/^\d{4}-\d{2}-\d{2}/.test(title)) continue;
        if (/^#/.test(title)) continue;
        if (title === meta && title.length <= 8) continue;
        if (seen.has(title)) continue;
        seen.add(title);

        const anchor = row.querySelector('a[href]');
        const href = anchor?.getAttribute('href') || '';
        items.push({
          title,
          url: href ? new URL(href, window.location.origin).toString() : '',
          meta,
        });
        if (items.length >= 5) break;
      }

      if (items.length > 0) {
        sections.push({ sectionTitle: heading, items });
      }
      if (sections.length >= 5) break;
    }

    return {
      title: String(document.title || '')
        .replace(/\s+/g, ' ')
        .trim(),
      sections,
    };
  });
}

export async function collectHomepageBuzzLinks(
  page: Page,
  maxLinks = 20,
): Promise<CandidateLink[]> {
  const links = await page.evaluate((origin) => {
    const out = [] as Array<{
      title: string;
      url: string;
      snippet: string;
      score: number;
    }>;
    const seen = new Set<string>();

    const fixedLinks = [
      ['最新帖子', '/topics', 20],
      ['最新经验', '/experiences', 18],
      ['最新教程', '/tutorials?status=article', 18],
      ['教程专栏', '/tutorials?status=column', 17],
    ] as Array<[string, string, number]>;

    for (const [title, href, score] of fixedLinks) {
      const url = new URL(href, origin).toString();
      seen.add(url);
      out.push({ title, url, snippet: `Homepage section: ${title}`, score });
    }

    const anchors = Array.from(document.querySelectorAll('section a[href]'));
    for (const anchor of anchors) {
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#')) continue;
      const url = new URL(href, origin);
      if (url.hostname !== 'new.web.cafe') continue;
      if (seen.has(url.toString())) continue;
      if (url.pathname.startsWith('/label/')) continue;

      const title = String(anchor.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!title || title.length < 4) continue;
      if (/群聊|我的帖子|查看所有/.test(title)) continue;

      let score = 4;
      if (/^#/.test(title)) score += 4;
      if (/tutorial|topic|experience/.test(url.pathname)) score += 4;

      seen.add(url.toString());
      out.push({ title, url: url.toString(), snippet: title, score });
    }

    out.sort((a, b) => b.score - a.score);
    return out;
  }, config.baseUrl);

  return links.slice(0, maxLinks).map(({ title, url, snippet }) => ({
    title,
    url,
    snippet,
  }));
}

export async function extractPageInsight(page: Page): Promise<PageInsight> {
  return page.evaluate((origin) => {
    const title = (document.title || '').replace(/\s+/g, ' ').trim();
    const h1Element = document.querySelector('h1');
    const h1 = (h1Element && h1Element.textContent ? h1Element.textContent : '')
      .replace(/\s+/g, ' ')
      .trim();

    const headings = [] as string[];
    for (const el of Array.from(document.querySelectorAll('h2, h3'))) {
      const value = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (value) headings.push(value);
      if (headings.length >= 8) break;
    }

    const tags = [] as string[];
    for (const el of Array.from(
      document.querySelectorAll('a[href*="/label/"], a[href*="/tutorial/"]'),
    )) {
      const value = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (value.length > 1) tags.push(value);
      if (tags.length >= 10) break;
    }

    const timeEl = document.querySelector('time');
    const date = (
      timeEl ? timeEl.getAttribute('datetime') || timeEl.textContent : ''
    )
      .replace(/\s+/g, ' ')
      .trim();

    const bodySource = document.querySelector('main');
    const bodyRaw = bodySource
      ? (bodySource as HTMLElement).innerText || bodySource.textContent || ''
      : document.body.innerText || document.body.textContent || '';
    const bodyText = bodyRaw.replace(/\s+/g, ' ').trim().slice(0, 2400);
    const snippet = bodyText.slice(0, 260);

    const internalLinks = [] as Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
    for (const anchor of Array.from(
      document.querySelectorAll('main a[href], a[href]'),
    )) {
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#')) continue;
      const url = new URL(href, origin);
      if (url.hostname !== 'new.web.cafe') continue;
      const text = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
      const ignoredTitles = new Set([
        'Home',
        'Open user menu',
        '创建新帖子',
        '我的帖子',
        '群聊',
      ]);
      const ignoredPaths = new Set([
        '/',
        '/all',
        '/topics',
        '/experiences',
        '/tutorials',
        '/labels',
        '/competition',
        '/messages',
        '/myTopic',
      ]);
      if (ignoredTitles.has(text)) {
        continue;
      }
      if (ignoredPaths.has(url.pathname) && !url.search) {
        continue;
      }
      if (
        url.pathname.startsWith('/label/') ||
        url.pathname.startsWith('/settings') ||
        url.pathname.startsWith('/profile') ||
        url.pathname.startsWith('/user/') ||
        url.pathname.startsWith('/users/')
      ) {
        continue;
      }
      if (
        !url.pathname.startsWith('/topic/') &&
        !url.pathname.startsWith('/tutorial/')
      ) {
        continue;
      }
      internalLinks.push({
        title: text,
        url: url.toString(),
        snippet: '',
      });
      if (internalLinks.length >= 20) break;
    }

    return {
      url: window.location.href,
      title,
      h1,
      headings,
      snippet,
      bodyExcerpt: bodyText,
      tags,
      date,
      internalLinks,
    };
  }, config.baseUrl);
}

export async function visitRepresentativePages(
  context: BrowserContext,
  links: CandidateLink[],
  maxPages: number,
): Promise<PageInsight[]> {
  const insights: PageInsight[] = [];
  const uniqueUrls = Array.from(new Set(links.map((link) => link.url))).slice(
    0,
    maxPages,
  );

  for (const url of uniqueUrls) {
    const page = await openPage(context, url);
    await page.waitForTimeout(900);
    insights.push(await extractPageInsight(page));
  }

  return insights;
}

export function buildResearchReport(input: {
  title: string;
  listingSummary: string[];
  pages: PageInsight[];
  sources: string[];
}): ScriptResult {
  const pages = input.pages;
  const tagCounts = new Map<string, number>();
  const headingFragments: string[] = [];
  const dates = pages.map((page) => page.date).filter(Boolean);

  for (const page of pages) {
    for (const tag of page.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
    headingFragments.push(...page.headings.slice(0, 2));
  }

  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, count]) => `${tag} (${count})`);

  const lines: string[] = [];
  lines.push(input.title);
  lines.push('Summary');
  for (const item of input.listingSummary) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('Key Content');
  if (pages.length === 0) {
    lines.push('- No representative detail pages were captured.');
  } else {
    for (const page of pages) {
      const headingPart = page.headings.slice(0, 3).join(' | ');
      const tagPart = page.tags.slice(0, 4).join(', ');
      lines.push(`- ${page.title || page.h1 || page.url}: ${page.snippet}`);
      if (headingPart) lines.push(`  headings: ${headingPart}`);
      if (tagPart) lines.push(`  tags: ${tagPart}`);
    }
  }
  lines.push('');
  lines.push('SEO Analysis');
  lines.push(
    `- Content cluster signals: ${topTags.length > 0 ? topTags.join(', ') : 'tag clustering is weak or not obvious from sampled pages'}.`,
  );
  lines.push(
    `- Internal linking posture: pages heavily cross-link through section lists, tags, and tutorial collections, which supports topical authority if anchor text stays specific.`,
  );
  lines.push(
    `- Editorial pattern: titles emphasize concrete workflows, examples, and platform-specific terms, which is good for intent matching and long-tail SEO.`,
  );
  lines.push(
    `- Freshness cues: ${dates.length > 0 ? `sampled pages expose publication timestamps (${dates.slice(0, 4).join(', ')}), which helps communicate recency.` : 'publication timing was not consistently visible in the sample.'}`,
  );
  if (headingFragments.length > 0) {
    lines.push(
      `- Topical depth: sampled headings suggest the site often expands one problem into detailed subtopics: ${headingFragments.slice(0, 5).join(' | ')}.`,
    );
  }
  lines.push('');
  lines.push('Indie Dev Analysis');
  lines.push(
    '- The site appears to compound value through niche operational knowledge, community curation, and reusable tactical content rather than broad generic education.',
  );
  lines.push(
    '- This is a strong indie moat because each page can attract search traffic, reinforce community identity, and funnel readers into deeper archives or paid/owned channels.',
  );
  lines.push(
    '- The most reusable founder lesson is to turn repeated questions, case studies, and tool comparisons into linked content hubs with clear audience intent.',
  );
  lines.push('');
  lines.push('Notable Opportunities');
  lines.push(
    '- Expand consistent title formulas and summary intros on every detail page to improve SERP clarity and CTR.',
  );
  lines.push(
    '- Add stronger internal links from high-traffic overview pages into evergreen conversion or signup destinations.',
  );
  lines.push(
    '- Consider clearer entity/tag normalization where the same idea appears with multiple overlapping labels.',
  );
  lines.push('');
  lines.push('Sources');
  for (const source of input.sources) {
    lines.push(`- ${source}`);
  }

  return {
    success: true,
    message: lines.join('\n'),
    data: {
      sourceCount: input.sources.length,
      pageCount: pages.length,
      topTags,
    },
  };
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
