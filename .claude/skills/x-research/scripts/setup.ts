#!/usr/bin/env npx tsx

import {
  closeBackgroundTab,
  ensureProxyReady,
  evalInTab,
  openBackgroundTab,
} from '../lib/browser.js';

async function setup(): Promise<void> {
  console.log('=== X Research Current-Chrome Check ===\n');
  console.log('This verifies that Web Access can reach your current Chrome.');
  console.log(
    'x_search and x_read_home_feed now use your live Chrome session.\n',
  );

  await ensureProxyReady();

  let targetId: string | null = null;
  try {
    targetId = await openBackgroundTab('https://x.com/home');
    const isLoggedIn = await evalInTab<boolean>(
      targetId,
      `(() => {
        const hasAccountSwitcher = Boolean(document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]'));
        const onLoginPage = Boolean(document.querySelector('input[autocomplete="username"]'));
        return hasAccountSwitcher && !onLoginPage;
      })()`,
    );

    if (isLoggedIn) {
      console.log('Chrome remote debugging is ready.');
      console.log('X appears to be logged in in your current Chrome session.');
      return;
    }

    console.log(
      'Chrome remote debugging is ready, but X is not logged in in the current Chrome session.',
    );
    console.log(
      'Please log in to X in your normal Chrome, then re-run this check if needed.',
    );
  } finally {
    if (targetId) await closeBackgroundTab(targetId);
  }
}

setup().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
