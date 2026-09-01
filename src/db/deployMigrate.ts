import { runDrizzleMigration } from './migrate.js';

async function main() {
  if (process.env.VERCEL_ENV !== 'production') {
    console.log(JSON.stringify({ migration: 'skipped', reason: 'not a production deployment' }));
    return;
  }
  const report = await runDrizzleMigration(undefined, { allowRuntime: true });
  console.log(JSON.stringify({ migration: 'complete', ...report }));
}

main().catch((error) => {
  console.error('Production migration failed:', error);
  process.exitCode = 1;
});
