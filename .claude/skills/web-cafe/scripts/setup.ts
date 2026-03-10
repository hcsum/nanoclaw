#!/usr/bin/env npx tsx
/**
 * Web.Cafe Integration - Setup (Google OAuth)
 * Interactive script to authenticate with Google and save session
 */

import { getBrowserContext } from '../lib/browser.js';
import { config } from '../lib/config.js';
import fs from 'fs';

async function setup() {
  console.log('Web.Cafe Authentication Setup');
  console.log('==============================\n');
  console.log('This will open Chrome for you to log in with Google OAuth.');
  console.log('Your session will be saved for future use.\n');
  console.log('Press Ctrl+C to cancel, or press Enter to continue...');

  await new Promise((resolve) => {
    process.stdin.once('data', resolve);
  });

  console.log('\nLaunching browser...');
  const context = await getBrowserContext();
  const page = context.pages()[0] || (await context.newPage());

  // Navigate to web.cafe
  await page.goto(config.baseUrl, {
    timeout: config.timeouts.navigation,
    waitUntil: 'domcontentloaded',
  });

  console.log('\n✓ Browser opened');
  console.log('\nPlease complete these steps:');
  console.log('1. Click the "登 录" (Login) button');
  console.log('2. Sign in with your Google account');
  console.log('3. Wait for the page to fully load after login');
  console.log('4. Come back here and press Enter when done\n');

  await new Promise((resolve) => {
    process.stdin.once('data', resolve);
  });

  // Check if logged in by looking for user-specific elements
  const isLoggedIn = await page
    .locator('text=/退出|个人中心|我的/i')
    .first()
    .isVisible()
    .catch(() => false);

  if (!isLoggedIn) {
    console.log('\n✗ Login not detected. Please try again.');
    await context.close();
    process.exit(1);
  }

  // Save auth marker
  fs.writeFileSync(
    config.authFile,
    JSON.stringify(
      {
        authenticated: true,
        timestamp: new Date().toISOString(),
        method: 'google_oauth',
      },
      null,
      2,
    ),
  );

  console.log('\n✓ Authentication successful!');
  console.log(`✓ Session saved to: ${config.profileDir}`);
  console.log(`✓ Auth marker: ${config.authFile}\n`);

  await context.close();
  process.exit(0);
}

setup().catch((err) => {
  console.error('\n✗ Setup failed:', err.message);
  process.exit(1);
});
