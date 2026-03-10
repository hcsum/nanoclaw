/**
 * Browser Automation - Configuration
 */

export const config = {
  // Chrome executable path (macOS)
  chromePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',

  // Browser profile directory for persistent sessions
  profileDir: `${process.env.HOME}/.nanoclaw/browser-profile`,

  // Timeouts
  timeouts: {
    navigation: 30000,
    pageLoad: 2000,
    action: 5000,
  },
};
