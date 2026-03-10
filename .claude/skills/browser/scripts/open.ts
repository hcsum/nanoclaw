#!/usr/bin/env npx tsx
/**
 * Browser Automation - Open URL
 * Navigate to a specified URL
 */

import { getBrowserContext, runScript, ScriptResult } from '../lib/browser.js';
import { config } from '../lib/config.js';

interface OpenInput {
  url: string;
}

async function openUrl(input: OpenInput): Promise<ScriptResult> {
  if (!input.url || input.url.trim().length === 0) {
    return { success: false, message: 'URL cannot be empty' };
  }

  let context = null;

  try {
    context = await getBrowserContext();
    const page = context.pages()[0] || (await context.newPage());

    await page.goto(input.url, {
      timeout: config.timeouts.navigation,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(config.timeouts.pageLoad);

    const title = await page.title();
    const currentUrl = page.url();

    return {
      success: true,
      message: `Navigated to: ${title}`,
      data: { url: currentUrl, title },
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (context) await context.close();
  }
}

runScript<OpenInput>(openUrl);
