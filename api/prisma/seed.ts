/**
 * SEED-1 entrypoint (registered in package.json as `prisma.seed`).
 *
 * The full restaurant seed lives in ./seed/* and bootstraps a Nest application
 * context so it can drive the REAL use-cases (opening balances, process runs,
 * orders that deplete inventory through the ledger). This file just delegates to
 * the orchestrator so the existing entrypoint is reused, not competed with.
 *
 * Run with: `pnpm db:seed`
 */
import { main } from './seed/index';

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('SEED-1 failed:', err);
    process.exitCode = 1;
  });
