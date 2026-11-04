# RecruitFlow — Automated Test Report

**Run date:** 5 Nov 2026 · **Command:** `cd testing && npm test` · **Browser:** Chromium 131 (Playwright 1.49.1)
**Target:** local app on isolated MySQL database `recruitflow_e2e` (dev database `recruitflow` checked afterwards: 0 test records)

## Result

| Total | Passed | Failed | Skipped | Pass rate | Duration |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 47 | 47 | 0 | 0 | 100% | 3.7 min |

Browser problems across the whole run: **0** console errors, **0** uncaught exceptions, **0** API 5xx responses, **0** failed network requests. The per-run auto-generated details are in [`SUMMARY.md`](SUMMARY.md).

| Module | Tests | Covers |
| :--- | ---: | :--- |
| Workflow | 1 (35 steps) | HR creates & publishes job → candidate registers, completes profile, applies → HR screens, shortlists → schedules interview → candidate sees it → HR passes it, selects → sends offer → candidate accepts → HR hires; both portals and MySQL checked at every stage |
| Auth | 12 + 4 | Valid/invalid HR login, logout, protected routes, tampered/expired JWTs, candidate blocked from staff login, registration, duplicate registration, signup validation, invalid candidate login, candidate blocked from HR pages/APIs, HR blocked from candidate APIs; login/logout smoke on iPad and Pixel 5 emulation |
| Dashboard | 5 | Every stat card equals a live MySQL count, widgets render, sidebar reaches every module, stat-card links filter lists, empty states |
| Jobs | 5 | Create, list, details, edit (persisted), draft hidden, publish, search, filter, sort, close (applications blocked), reopen, delete with confirmation, form validation, write-API authorization |
| Candidate portal | 1 (7 steps) | Two registrations, profile update persisted, invalid resume URL rejected, location/type/keyword filters, apply, dashboard/list show it, duplicate blocked (UI + API), candidate 1 cannot see candidate 2's application |
| Interviews & offers | 9 | Reschedule, cancel, past/invalid dates, FAIL blocks selection and offers, invalid transitions (evaluate twice, reschedule/cancel evaluated, rating 11, candidate evaluating), interview times stored in UTC and shown in Asia/Kolkata to a browser set to New York time, offer form validation, offer details, decline (both portals + MySQL, hire blocked), duplicate/early offers, candidates cannot act on offers |
| Negative | 6 | Duplicate/closed/draft/expired/missing-job applications, skipped or repeated pipeline steps, missing fields and invalid values (400), cross-candidate access, identity spoofing via request body, HR-only endpoints vs anonymous/candidate, no stack traces or SQL in errors |
| Responsive | 4 | 18 screens at 1440/1280/768/375 px: no page overflow, no clipped controls, text ≥ 11 px, sidebar inline vs toggle, modal fits viewport; full-page screenshots saved |

## Bugs found and fixed

| # | Bug | Severity | Fix |
| ---: | :--- | :--- | :--- |
| 1 | 136 decorative Bootstrap icons lacked `aria-hidden`, so Chromium included the icon glyph in button/link accessible names (e.g. the "Cancel" button's name was not "Cancel"). Screen readers could announce garbage before labels. | Medium (accessibility) | Added `aria-hidden="true"` to every decorative icon in `client/src`; verified no icon-only control is left without an `aria-label`. |
| 2 | Candidates page search box had no label or `aria-label` (unnamed text field for assistive tech). | Low (accessibility) | Added `aria-label="Search candidates"` and `type="search"` in `Candidates.jsx`. |

No functional or security defects were found in the workflow, business rules or access control. All earlier backend suites (243 checks) also still pass.

## Test-side issues found and corrected (not app bugs)

These were mistakes in my first drafts of the tests, found by inspecting the failure screenshot/trace and the page code. No assertion was relaxed to hide an app problem.

- Required-field labels render as "Password *", so exact-name selectors missed them → anchored regex selectors.
- Public careers page has no app shell → logout helper navigates to the role home page first.
- Off-canvas sidebar counts as "visible" to Playwright while translated off-screen → logout helper checks the viewport.
- Stat-card text "Applications" also appears in "Closed applications" → match the card's label element exactly.
- Duplicate offer returns **400** (the application is already `OFFER_SENT`, so the state rule fires first), not 409 as I guessed. The duplicate is still blocked: the test now also asserts exactly one offer row in MySQL.
- "Reject application" is correctly hidden while an offer is active → responsive modal check uses the job's close dialog.
- Filter tab strips are intentional horizontal scrollers (`overflow-x: auto`) → layout check skips controls inside scroll containers, as it already did for tables.

## Remaining issues and limits

- **Mobile tables:** on phones, list tables (e.g. Applications) show only the first column; other columns are behind a horizontal swipe with no visual hint, and rows are tall. Usable, but a card layout on small screens would be better. Not fixed (design change).
- **Not automated:** resume *file* upload (not implemented; only a resume URL exists), email delivery (none exists), the interviewer role's own login journey (covered only by the backend suites), and real Safari/Firefox (Chromium only; tablet/mobile are device emulation, not physical devices).
- **Expired jobs/offers** are simulated by moving a test job's deadline into the past in the E2E database; the app has no clock injection.
- The suite runs with one worker (≈3.6 min) because dashboard tests compare UI numbers against live database counts.
