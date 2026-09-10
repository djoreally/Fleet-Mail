# Fleet-Mail regression verification — 2026-09-10

Baseline: `65f2e644812b56feb9c933464cd940f84ff56c67`.

## Reproduced failures

- `npm ci --ignore-scripts --no-audit --no-fund` failed with EUSAGE: the lockfile lacked declared dependencies and contained the wrong Zod version.
- The existing 286 tests passed after dependency installation, but four additional behavioral tests failed: closing a conflicting appointment as cancelled/completed/no_show and editing a cancelled appointment after a replacement was scheduled.
- The appointment update service ran active-slot conflict checks without considering the appointment's resulting status.

## Changes

- Regenerated the lockfile from the existing package manifest.
- Read persisted appointment status and run scheduling conflict checks only when the resulting appointment remains active. Reactivation still checks conflicts.
- Added six service-level behavioral tests using mocked HTTP responses, including two checks that conflicting active bookings remain rejected.
- Updated the existing source contract to include the newly selected status field.

## Executed validation

- Fresh `npm ci --ignore-scripts --no-audit --no-fund`: passed. Peer-dependency and deprecation warnings remain.
- TypeScript: passed.
- Vitest: 67 files, 292 tests passed.
- `npm run build`: verification passed; the local tsx CLI then failed to create an IPC socket (EPERM).
- Remaining build steps executed using `node --import tsx src/db/deployMigrate.ts`, Vite's CLI, and esbuild's CLI: passed. Vite transformed 1,980 modules and emitted the frontend; esbuild emitted the server bundle.
- Production migration was skipped locally by the existing nonproduction guard. No database mutation was performed during local validation.

## Limits

These checks verify clean installation, compilation, and the tested service behavior. They do not certify authenticated production workflows, real database permissions, email delivery, or the chat agent's answers. A successful deployment is not equivalent to those checks. The specific user-observed regression still needs its screen/action identified if it differs from the failures above.
