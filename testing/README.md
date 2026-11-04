# RecruitFlow — Automated End-to-End Tests (Playwright)

Real browser tests that drive the React UI against the real Express API and a **separate local MySQL database**. One command runs everything.

## Quick start

Prerequisites: MySQL 8 running locally, `server/.env` configured (the same file the app uses), and `npm install` already run in `server/` and `client/`.

```bash
cd testing
npm install
npx playwright install chromium
npm test
```

Then open the report:

```bash
npm run report
```

You do **not** need to start the app yourself: Playwright starts its own API on port 5100 and frontend on port 5174, and stops them afterwards. Your dev servers on 5000/5173 can keep running.

## Commands (run inside `testing/`)

| Command | What it runs |
| :--- | :--- |
| `npm test` | Everything: all modules on desktop, responsive checks at 4 widths, auth smoke on tablet and mobile emulation |
| `npm run test:workflow` | The complete recruitment workflow (35 steps, HR ↔ candidate) |
| `npm run test:auth` | HR and candidate authentication and authorization |
| `npm run test:dashboard` | HR dashboard numbers vs MySQL, widgets, navigation, empty states |
| `npm run test:jobs` | Job lifecycle: create, edit, publish, search, filter, sort, close, reopen, delete |
| `npm run test:candidate` | Candidate registration, profile, job board, applying, duplicates, privacy |
| `npm run test:interview-offer` | Reschedule, cancel, pass, fail, offer create/accept/decline, duplicates |
| `npm run test:negative` | Business-rule and security violations (API) |
| `npm run test:responsive` | All major screens at 1440, 1280, 768 and 375 px with screenshots |
| `npm run report` | Opens the HTML report |
| `npx playwright test --ui` | Interactive runner for debugging |

## Data safety

- Tests only ever use the database named by `E2E_DB_NAME` (default `recruitflow_e2e`). The run **refuses to start** if that name doesn't end in `_e2e`/`_test`, equals your dev `DB_NAME`, `DB_HOST` is not local, or `NODE_ENV=production`.
- Each run (re)creates the schema in the test database with the project's own `npm run db:setup` logic, including demo seed data, so dashboards have realistic numbers. Nothing is dropped.
- The HR test account (`E2E_HR_EMAIL`) gets a **fresh random password every run** unless you set `E2E_HR_PASSWORD`. Candidate test accounts are registered through the UI with a random per-run password. Credentials are written only to `testing/.auth/run.json` (git-ignored).
- Every record a run creates is tagged (`E2E <runId> …` job titles, `e2e.<runId>.…@example.test` emails) and removed afterwards; set `E2E_KEEP=1` to keep them.
- User actions are performed through the UI or the HTTP API. MySQL is only *read* to verify results, with one exception: the "expired job" test moves its own test job's deadline into the past to simulate time passing.

## Reports

| File | Contents |
| :--- | :--- |
| `reports/TEST-REPORT.md` | Human-written report for the latest verified run: results, bugs found/fixed, remaining issues |
| `reports/SUMMARY.md` | Auto-generated after every run: totals, pass rate, duration, per-module results, failures with screenshots, console errors, failed API calls |
| `reports/html/` | Playwright HTML report (traces, screenshots, videos for failures) |
| `reports/screenshots/<width>/` | Screenshots of every major screen from the responsive run |
| `reports/results.json` | Machine-readable results |

## What fails a test automatically

Every test also watches the browser. Any of these fails the test even if its own assertions passed:

- uncaught JavaScript exceptions / unhandled promise rejections,
- `console.error` output,
- API responses with status 5xx,
- network failures (refused connections, missing assets).

API 4xx responses are expected in negative tests, so they are listed in `SUMMARY.md` but don't fail a test on their own; each one is asserted explicitly by its test.

## Layout

```
testing/
  playwright.config.js     projects, servers, reporters
  support/env.js           settings + safety guard
  support/global-setup.js  prepares the E2E database and run credentials
  support/global-teardown.js removes this run's records
  support/fixtures.js      fixtures (api, db, browser-error monitor) and login helpers
  support/ui.js            UI actions: job form, schedule, evaluate, offer, dialogs
  support/summary-reporter.js writes reports/SUMMARY.md
  tests/*.spec.js          test modules
```
