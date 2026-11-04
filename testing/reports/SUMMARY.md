# RecruitFlow — Automated E2E Test Summary

Generated: 2026-11-04T18:22:17.896Z  
Overall status: **PASSED**

| Total | Passed | Failed | Skipped | Pass rate | Duration |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 46 | 46 | 0 | 0 | 100.0% | 214.3 s |

## Results by module

| Module (project) | Passed | Failed | Skipped | Time |
| :--- | ---: | ---: | ---: | ---: |
| auth (desktop) | 12 | 0 | 0 | 21.9 s |
| candidate (desktop) | 1 | 0 | 0 | 7.1 s |
| dashboard (desktop) | 5 | 0 | 0 | 9.5 s |
| interview-offer (desktop) | 8 | 0 | 0 | 20.6 s |
| jobs (desktop) | 5 | 0 | 0 | 14.4 s |
| negative (desktop) | 6 | 0 | 0 | 5.1 s |
| workflow (desktop) | 1 | 0 | 0 | 17.7 s |
| responsive (responsive) | 4 | 0 | 0 | 79.8 s |
| auth (tablet) | 2 | 0 | 0 | 6.5 s |
| auth (mobile) | 2 | 0 | 0 | 6.9 s |

## Failures

None.

## Browser console errors and uncaught exceptions

Any entry here fails its test.

None.

## Failed API requests — server errors (5xx) and network failures

Any entry here fails its test.

None.

## API 4xx responses seen in the browser

Expected for negative tests (invalid login, blocked actions, permission checks). Each one is asserted by its test.

- auth › HR authentication › invalid HR password is rejected in the UI and API: POST http://127.0.0.1:5100/api/auth/login → 401
- auth › HR authentication › candidate account cannot sign in through the HR portal: POST http://127.0.0.1:5100/api/auth/login → 403
- auth › Candidate authentication › duplicate registration is prevented: POST http://127.0.0.1:5100/api/auth/candidate/signup → 409
- auth › Candidate authentication › invalid candidate credentials are rejected: POST http://127.0.0.1:5100/api/auth/candidate/login → 401
- candidate › Candidate portal › two candidates register; candidate 1 completes profile, searches, applies and is blocked from duplicates: GET http://127.0.0.1:5100/api/candidate/applications/68 → 403

## All tests

| Module | Test | Project | Result | Time |
| :--- | :--- | :--- | :--- | ---: |
| auth | HR authentication › valid HR login reaches dashboard and logout clears the session @smoke | desktop | passed | 3.7 s |
| auth | HR authentication › invalid HR password is rejected in the UI and API | desktop | passed | 1.1 s |
| auth | HR authentication › HR routes redirect to login without a session and the API returns 401 | desktop | passed | 2.0 s |
| auth | HR authentication › tampered and expired tokens are rejected and the UI asks to sign in again | desktop | passed | 1.4 s |
| auth | HR authentication › candidate account cannot sign in through the HR portal | desktop | passed | 1.7 s |
| auth | Candidate authentication › registration logs the candidate in and logout ends the session @smoke | desktop | passed | 2.6 s |
| auth | Candidate authentication › duplicate registration is prevented | desktop | passed | 1.4 s |
| auth | Candidate authentication › signup form validates required fields and password rules | desktop | passed | 1.6 s |
| auth | Candidate authentication › invalid candidate credentials are rejected | desktop | passed | 2.0 s |
| auth | Candidate authentication › candidate routes require a candidate session | desktop | passed | 1.6 s |
| auth | Candidate authentication › candidate cannot open HR pages or call HR APIs | desktop | passed | 2.7 s |
| auth | Candidate authentication › HR cannot use candidate-only APIs | desktop | passed | 0.1 s |
| candidate | Candidate portal › two candidates register; candidate 1 completes profile, searches, applies and is blocked from duplicates | desktop | passed | 7.1 s |
| dashboard | HR dashboard › statistics load from the API and match database counts | desktop | passed | 2.1 s |
| dashboard | HR dashboard › pipeline, outcome and activity widgets render | desktop | passed | 1.6 s |
| dashboard | HR dashboard › every HR module is reachable from the sidebar | desktop | passed | 2.2 s |
| dashboard | HR dashboard › stat cards link to filtered lists | desktop | passed | 1.4 s |
| dashboard | HR dashboard › empty states show when nothing matches | desktop | passed | 2.2 s |
| interview-offer | Interviews › reschedule a pending interview | desktop | passed | 2.7 s |
| interview-offer | Interviews › cancel a pending interview returns the candidate to the shortlist | desktop | passed | 2.5 s |
| interview-offer | Interviews › past interview dates are rejected (UI and API) | desktop | passed | 2.4 s |
| interview-offer | Interviews › failed interview blocks selection and offers; candidate sees the result | desktop | passed | 3.6 s |
| interview-offer | Interviews › invalid interview transitions are rejected by the API | desktop | passed | 1.7 s |
| interview-offer | Offers › offer form validates dates; a valid offer shows its details | desktop | passed | 3.3 s |
| interview-offer | Offers › candidate declines an offer; both portals and MySQL agree and hiring is blocked | desktop | passed | 2.9 s |
| interview-offer | Offers › duplicate and ineligible offers are rejected; candidates cannot change offers | desktop | passed | 1.4 s |
| jobs | Job management › create → list → details → edit → publish → search/filter → close → reopen | desktop | passed | 5.6 s |
| jobs | Job management › closed job shows as closed to a signed-in candidate | desktop | passed | 2.5 s |
| jobs | Job management › delete a dedicated draft job with confirmation | desktop | passed | 3.3 s |
| jobs | Job management › job form validates required fields and salary range | desktop | passed | 2.5 s |
| jobs | Job management › job write APIs require HR authorization | desktop | passed | 0.6 s |
| negative | Business rules › applications: duplicates, closed jobs, draft jobs and expired jobs are rejected | desktop | passed | 2.4 s |
| negative | Business rules › pipeline steps cannot be skipped or repeated | desktop | passed | 0.7 s |
| negative | Business rules › missing fields and invalid values are rejected with 400 | desktop | passed | 0.4 s |
| negative | Access control › candidates cannot read or act on another candidate's records | desktop | passed | 0.9 s |
| negative | Access control › HR-only endpoints reject candidates and anonymous callers | desktop | passed | 0.4 s |
| negative | Access control › error responses never leak stack traces or SQL | desktop | passed | 0.3 s |
| workflow | full recruitment workflow: job → application → interview → offer → hire | desktop | passed | 17.7 s |
| responsive | all major screens render cleanly at desktop 1440px | responsive | passed | 21.7 s |
| responsive | all major screens render cleanly at laptop 1280px | responsive | passed | 20.6 s |
| responsive | all major screens render cleanly at tablet 768px | responsive | passed | 19.0 s |
| responsive | all major screens render cleanly at mobile 375px | responsive | passed | 18.5 s |
| auth | HR authentication › valid HR login reaches dashboard and logout clears the session @smoke | tablet | passed | 3.5 s |
| auth | Candidate authentication › registration logs the candidate in and logout ends the session @smoke | tablet | passed | 3.0 s |
| auth | HR authentication › valid HR login reaches dashboard and logout clears the session @smoke | mobile | passed | 2.5 s |
| auth | Candidate authentication › registration logs the candidate in and logout ends the session @smoke | mobile | passed | 4.5 s |
