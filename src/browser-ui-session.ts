import fs from 'fs';
import path from 'path';

import { BrowserContext, Page, chromium } from 'playwright';

export interface BrowserResult {
  success: boolean;
  message: string;
  data?: unknown;
}

interface SnapshotInput {
  interactive?: boolean;
  limit?: number;
}

interface ActionInput {
  action: 'click' | 'fill' | 'scroll' | 'press' | 'wait';
  selector?: string;
  value?: string;
  direction?: 'up' | 'down';
  amount?: number;
}

interface ReadInput {
  selector?: string;
}

const DEFAULT_CHROME_PATH =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE_DIR =
  process.env.NANOCLAW_BROWSER_PROFILE_DIR ||
  `${process.env.HOME}/.nanoclaw/browser-profile`;
const CHROME_PATH =
  process.env.NANOCLAW_BROWSER_CHROME_PATH || DEFAULT_CHROME_PATH;

const TIMEOUTS = {
  navigation: 30000,
  pageLoad: 2000,
  action: 5000,
};

let context: BrowserContext | null = null;
let activePage: Page | null = null;
let operationQueue: Promise<void> = Promise.resolve();

function queueOperation<T>(fn: () => Promise<T>): Promise<T> {
  const run = operationQueue.then(fn, fn);
  operationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function cleanupLockFiles(): void {
  const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
  for (const file of lockFiles) {
    const lockPath = path.join(PROFILE_DIR, file);
    if (fs.existsSync(lockPath)) {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // Ignore stale lock cleanup errors.
      }
    }
  }
}

async function ensureContext(): Promise<BrowserContext> {
  if (context) return context;

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  cleanupLockFiles();

  const launchOptions: Parameters<typeof chromium.launchPersistentContext>[1] =
    {
      headless: false,
      viewport: { width: 1280, height: 720 },
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    };

  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  context = await chromium.launchPersistentContext(PROFILE_DIR, launchOptions);
  context.on('page', (page) => {
    activePage = page;
  });

  return context;
}

async function ensureActivePage(): Promise<Page> {
  const ctx = await ensureContext();

  if (activePage && !activePage.isClosed()) {
    return activePage;
  }

  const pages = ctx.pages().filter((page) => !page.isClosed());
  if (pages.length > 0) {
    activePage = pages[pages.length - 1];
    return activePage;
  }

  activePage = await ctx.newPage();
  return activePage;
}

function resolveSelector(selector: string): string {
  if (selector.startsWith('@e')) {
    return `[data-nc-ref="${selector.slice(1)}"]`;
  }
  return selector;
}

async function openUrl(input: { url?: string }): Promise<BrowserResult> {
  if (!input.url || input.url.trim().length === 0) {
    return { success: false, message: 'URL cannot be empty' };
  }

  const page = await ensureActivePage();
  await page.bringToFront();
  await page.goto(input.url, {
    timeout: TIMEOUTS.navigation,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(TIMEOUTS.pageLoad);

  const title = await page.title();
  const currentUrl = page.url();

  return {
    success: true,
    message: `Navigated to: ${title || currentUrl}`,
    data: { title, url: currentUrl },
  };
}

async function snapshot(input: SnapshotInput): Promise<BrowserResult> {
  const interactive = input.interactive !== false;
  const limit = input.limit || 50;

  const page = await ensureActivePage();
  await page.bringToFront();

  const title = await page.title();
  const url = page.url();

  const elements = await page.evaluate(
    ({ interactive, limit }) => {
      type Element = {
        ref: string;
        tag: string;
        type?: string;
        text?: string;
        href?: string;
        placeholder?: string;
      };

      const results: Element[] = [];
      let refCounter = 1;
      const doc = (globalThis as { document?: unknown }).document as {
        querySelectorAll: (selector: string) => unknown[];
      };
      const win = (globalThis as { window?: unknown }).window as {
        getComputedStyle: (el: unknown) => {
          display?: string;
          visibility?: string;
        };
      };

      for (const current of Array.from(doc.querySelectorAll('[data-nc-ref]'))) {
        (
          current as { removeAttribute: (name: string) => void }
        ).removeAttribute('data-nc-ref');
      }

      const selectors = interactive
        ? 'a, button, input, textarea, select, [role="button"], [onclick]'
        : 'a, button, input, textarea, select, h1, h2, h3, p, div, span';

      for (const node of Array.from(doc.querySelectorAll(selectors))) {
        if (results.length >= limit) break;

        const el = node as {
          tagName: string;
          textContent?: string;
          href?: string;
          placeholder?: string;
          type?: string;
          setAttribute: (name: string, value: string) => void;
          getBoundingClientRect: () => { width: number; height: number };
        };
        const style = win.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;

        const text = el.textContent?.trim() || '';
        const href = el.href || '';
        const placeholder = el.placeholder || '';
        if (!text && !href && !placeholder) continue;

        const refValue = `e${refCounter++}`;
        el.setAttribute('data-nc-ref', refValue);

        const item: Element = {
          ref: `@${refValue}`,
          tag: el.tagName.toLowerCase(),
        };
        if (el.tagName === 'INPUT') {
          item.type = el.type;
        }
        if (text && text.length < 100) {
          item.text = text;
        }
        if (href) {
          item.href = href;
        }
        if (placeholder) {
          item.placeholder = placeholder;
        }

        results.push(item);
      }

      return results;
    },
    { interactive, limit },
  );

  const lines: string[] = [];
  lines.push(`Page: ${title}`);
  lines.push(`URL: ${url}`);
  lines.push(`Elements: ${elements.length}`);
  lines.push('');

  for (const el of elements as Array<Record<string, string>>) {
    let desc = `${el.ref} ${el.tag}`;
    if (el.type) desc += ` type="${el.type}"`;
    if (el.text) desc += ` "${el.text}"`;
    if (el.href) desc += ` href="${el.href}"`;
    if (el.placeholder) desc += ` placeholder="${el.placeholder}"`;
    lines.push(desc);
  }

  return {
    success: true,
    message: lines.join('\n'),
    data: { title, url, elements },
  };
}

async function performAction(input: ActionInput): Promise<BrowserResult> {
  if (!input.action) {
    return { success: false, message: 'Action type is required' };
  }

  const ctx = await ensureContext();
  const page = await ensureActivePage();
  await page.bringToFront();

  switch (input.action) {
    case 'click': {
      if (!input.selector) {
        return { success: false, message: 'Selector is required for click' };
      }
      await page.click(resolveSelector(input.selector), {
        timeout: TIMEOUTS.action,
      });
      await page.waitForTimeout(TIMEOUTS.pageLoad);

      const pages = ctx.pages().filter((p) => !p.isClosed());
      if (pages.length > 0) activePage = pages[pages.length - 1];

      return { success: true, message: `Clicked: ${input.selector}` };
    }
    case 'fill': {
      if (!input.selector || input.value === undefined) {
        return {
          success: false,
          message: 'Selector and value are required for fill',
        };
      }
      await page.fill(resolveSelector(input.selector), input.value, {
        timeout: TIMEOUTS.action,
      });
      return {
        success: true,
        message: `Filled: ${input.selector} with "${input.value}"`,
      };
    }
    case 'scroll': {
      const direction = input.direction || 'down';
      const amount = input.amount || 500;
      const delta = direction === 'down' ? amount : -amount;
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(1000);
      return { success: true, message: `Scrolled ${direction} ${amount}px` };
    }
    case 'press': {
      if (!input.value) {
        return { success: false, message: 'Key value is required for press' };
      }
      await page.keyboard.press(input.value);
      await page.waitForTimeout(TIMEOUTS.pageLoad);
      return { success: true, message: `Pressed: ${input.value}` };
    }
    case 'wait': {
      const ms = input.amount || 2000;
      await page.waitForTimeout(ms);
      return { success: true, message: `Waited ${ms}ms` };
    }
  }
}

async function readPage(input: ReadInput): Promise<BrowserResult> {
  const page = await ensureActivePage();
  await page.bringToFront();

  const title = await page.title();
  const url = page.url();
  const selector = input.selector ? resolveSelector(input.selector) : undefined;

  const content = await page.evaluate((currentSelector) => {
    const doc = (globalThis as { document?: unknown }).document as {
      querySelector: (selector: string) => unknown;
      body: unknown;
    };
    const root = currentSelector
      ? doc.querySelector(currentSelector)
      : doc.body;
    if (!root) return '';

    const clone = (root as { cloneNode: (deep: boolean) => unknown }).cloneNode(
      true,
    ) as {
      querySelectorAll: (selector: string) => unknown[];
      textContent?: string;
    };
    clone
      .querySelectorAll('script, style, nav, header, footer')
      .forEach((el: unknown) => (el as { remove: () => void }).remove());
    return clone.textContent?.trim() || '';
  }, selector);

  if (!content) {
    return { success: false, message: 'No content found on page' };
  }

  const maxLength = 5000;
  const truncated = content.length > maxLength;
  const text = truncated ? `${content.slice(0, maxLength)}...` : content;

  return {
    success: true,
    message: `${title}\n\n${text}${truncated ? '\n\n(Content truncated)' : ''}`,
    data: { title, url, content: text, truncated },
  };
}

export async function executeUiBrowserTask(
  script: string,
  input: unknown,
): Promise<BrowserResult> {
  return queueOperation(async () => {
    try {
      switch (script) {
        case 'open':
          return await openUrl(input as { url?: string });
        case 'snapshot':
          return await snapshot((input || {}) as SnapshotInput);
        case 'action':
          return await performAction(input as ActionInput);
        case 'read':
          return await readPage((input || {}) as ReadInput);
        default:
          return {
            success: false,
            message: `Unknown browser script: ${script}`,
          };
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });
}
