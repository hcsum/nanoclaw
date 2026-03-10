/**
 * Web.Cafe Integration - Browser Utilities
 */

import { chromium, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

export interface ScriptResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Launch browser with persistent profile
 */
export async function getBrowserContext(): Promise<BrowserContext> {
  // Clean up lock files if they exist
  cleanupLockFiles();

  const context = await chromium.launchPersistentContext(config.profileDir, {
    headless: false,
    executablePath: config.chromePath,
    viewport: config.viewport,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  });

  return context;
}

/**
 * Remove Chrome lock files that can prevent browser launch
 */
export function cleanupLockFiles(): void {
  const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
  for (const file of lockFiles) {
    const lockPath = path.join(config.profileDir, file);
    if (fs.existsSync(lockPath)) {
      try {
        fs.unlinkSync(lockPath);
      } catch (err) {
        // Ignore errors
      }
    }
  }
}

/**
 * Read input from stdin
 */
export async function readInput<T>(): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error(`Failed to parse input: ${err}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

/**
 * Write result to stdout
 */
export function writeResult(result: ScriptResult): void {
  console.log(JSON.stringify(result));
}

/**
 * Run a script with input/output handling
 */
export async function runScript<T>(
  handler: (input: T) => Promise<ScriptResult>,
): Promise<void> {
  try {
    const input = await readInput<T>();
    const result = await handler(input);
    writeResult(result);
    process.exit(0);
  } catch (err) {
    writeResult({
      success: false,
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}
