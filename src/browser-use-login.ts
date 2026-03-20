import { startBrowserUseLoginSession } from './browser-use.js';

async function main(): Promise<void> {
  const startUrl = process.argv[2];
  const result = await startBrowserUseLoginSession(startUrl);
  if (!result.success) {
    console.error(result.message);
    process.exit(1);
  }

  console.log(result.message);
}

main().catch((err) => {
  console.error(
    err instanceof Error ? err.message : `Unknown error: ${String(err)}`,
  );
  process.exit(1);
});
