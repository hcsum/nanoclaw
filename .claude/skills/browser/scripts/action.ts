#!/usr/bin/env npx tsx
/**
 * Browser Automation - Action
 * Perform actions like click, fill, scroll
 */

import { getBrowserContext, runScript, ScriptResult } from '../lib/browser.js';
import { config } from '../lib/config.js';

interface ActionInput {
  action: 'click' | 'fill' | 'scroll' | 'press' | 'wait';
  selector?: string; // CSS selector or @ref
  value?: string; // For fill, press
  direction?: 'up' | 'down'; // For scroll
  amount?: number; // For scroll (pixels)
}

async function performAction(input: ActionInput): Promise<ScriptResult> {
  if (!input.action) {
    return { success: false, message: 'Action type is required' };
  }

  let context = null;

  try {
    context = await getBrowserContext();
    const page = context.pages()[0];

    if (!page) {
      return { success: false, message: 'No active page. Use browser_open first.' };
    }

    switch (input.action) {
      case 'click': {
        if (!input.selector) {
          return { success: false, message: 'Selector is required for click' };
        }
        const selector = convertRef(input.selector);
        await page.click(selector, { timeout: config.timeouts.action });
        await page.waitForTimeout(config.timeouts.pageLoad);
        return { success: true, message: `Clicked: ${input.selector}` };
      }

      case 'fill': {
        if (!input.selector || !input.value) {
          return { success: false, message: 'Selector and value are required for fill' };
        }
        const selector = convertRef(input.selector);
        await page.fill(selector, input.value, { timeout: config.timeouts.action });
        return { success: true, message: `Filled: ${input.selector} with "${input.value}"` };
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
        await page.waitForTimeout(config.timeouts.pageLoad);
        return { success: true, message: `Pressed: ${input.value}` };
      }

      case 'wait': {
        const ms = input.amount || 2000;
        await page.waitForTimeout(ms);
        return { success: true, message: `Waited ${ms}ms` };
      }

      default:
        return { success: false, message: `Unknown action: ${input.action}` };
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (context) await context.close();
  }
}

/**
 * Convert @ref to CSS selector
 */
function convertRef(selector: string): string {
  // If it's a @ref like @e1, @e2, convert to data attribute selector
  if (selector.startsWith('@e')) {
    const num = selector.slice(2);
    return `[data-ref="e${num}"]`;
  }
  return selector;
}

runScript<ActionInput>(performAction);
