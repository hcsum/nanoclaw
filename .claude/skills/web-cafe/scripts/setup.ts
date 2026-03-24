#!/usr/bin/env npx tsx

import { chromium } from 'playwright';
import * as readline from 'readline';
import fs from 'fs';
import path from 'path';

import { config, cleanupLockFiles } from '../lib/browser.js';

async function setup(): Promise<void> {
  console.log('=== Web.Cafe Authentication Setup ===\n');
  console.log('This will open Chrome so you can log in to Web.Cafe.');
  console.log('The session will be saved for future automated browsing.\n');
  console.log(`Chrome path: ${config.chromePath}`);
  console.log(`Profile dir: ${config.browserDataDir}\n`);

  fs.mkdirSync(path.dirname(config.authPath), { recursive: true });
  fs.mkdirSync(config.browserDataDir, { recursive: true });

  cleanupLockFiles();

  const context = await chromium.launchPersistentContext(
    config.browserDataDir,
    {
      executablePath: config.chromePath,
      headless: false,
      viewport: config.viewport,
      args: config.chromeArgs.slice(0, 3),
      ignoreDefaultArgs: config.chromeIgnoreDefaultArgs,
      proxy: config.browserProxy,
    },
  );

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded' });

  console.log('Please complete login in the browser window.');
  console.log(
    'After login is finished and the site is usable, come back here and press Enter.\n',
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question('Press Enter when logged in... ', () => {
      rl.close();
      resolve();
    });
  });

  await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(config.timeouts.pageLoad);

  const stillShowsLogin = await page
    .locator('text=/^登\s*录$/')
    .first()
    .isVisible()
    .catch(() => false);

  fs.writeFileSync(
    config.authPath,
    JSON.stringify(
      {
        authenticated: !stillShowsLogin,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  if (!stillShowsLogin) {
    console.log('\nAuthenticated successfully.');
    console.log(`Session saved to: ${config.browserDataDir}`);
  } else {
    console.log('\nLogin could not be verified automatically.');
    console.log(
      'The auth marker was still saved; rerun setup if browsing later reports auth problems.',
    );
  }

  await context.close();
}

setup().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
