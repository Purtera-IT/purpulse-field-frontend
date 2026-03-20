# Audit command results (Iteration 13 / deep audit plan)

Recorded when executing the plan to-do **run-commands** (repo root).

**Last re-verified:** 2026-03-20 (audit debt fix: hooks, ESLint scope, IDB/jsdom tests, JobsTable/TimerPanel tests, CI gate).

| Command | Result | Notes |
|---------|--------|--------|
| `npm run validate:canonical-manifest` | **PASS** | 11 families + ingestion_pipeline |
| `npm run lint` | **PASS** | `eslint . --quiet`; Storybook preview ignored; `src/hooks` + `react-hooks/exhaustive-deps` (warn); `JobStateTransitioner` hooks order fixed |
| `npm run test:iteration13` | **PASS** | 9 tests across `iteration13Qa.test.js`, `iteration13TelemetryQueue.test.js` |
| `npx vitest run` / `npm test` (full suite) | **PASS** | 17 files / 138 tests — upload queue + job repo use jsdom + `fake-indexeddb/auto`; Dexie `uploadQueue` store indexes aligned |

**CI gate:** `.github/workflows/fieldapp-contracts.yml` runs `validate:canonical-manifest`, `lint`, `test:iteration13`, and `npm test`.
