# RecruitFlow — Automated E2E Test Summary

Generated: 2026-11-04T20:02:24.304Z  
Overall status: **PASSED**

| Total | Passed | Failed | Skipped | Pass rate | Duration |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 47 | 47 | 0 | 0 | 100.0% | 220.6 s |

## Results by module

| Module (project) | Passed | Failed | Skipped | Time |
| :--- | ---: | ---: | ---: | ---: |
| auth (desktop) | 12 | 0 | 0 | 22.8 s |
| candidate (desktop) | 1 | 0 | 0 | 6.7 s |
| dashboard (desktop) | 5 | 0 | 0 | 9.1 s |
| interview-offer (desktop) | 9 | 0 | 0 | 24.6 s |
| jobs (desktop) | 5 | 0 | 0 | 12.8 s |
| negative (desktop) | 6 | 0 | 0 | 5.2 s |
| workflow (desktop) | 1 | 0 | 0 | 16.9 s |
| responsive (responsive) | 4 | 0 | 0 | 83.2 s |
| auth (tablet) | 2 | 0 | 0 | 5.6 s |
| auth (mobile) | 2 | 0 | 0 | 7.7 s |

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
- candidate › Candidate portal › two candidates register; candidate 1 completes profile, searches, applies and is blocked from duplicates: GET http://127.0.0.1:5100/api/candidate/applications/102 → 403

## All tests

| Module | Test | Project | Result | Time |
| :--- | :--- | :--- | :--- | ---: |
| auth | HR authentication › valid HR login reaches dashboard and logout clears the session @smoke | desktop | passed | 4.2 s |
| auth | HR authentication › invalid HR password is rejected in the UI and API | desktop | passed | 1.6 s |
| auth | HR authentication › HR routes redirect to login without a session and the API returns 401 | desktop | passed | 1.8 s |
| auth | HR authentication › tampered and expired tokens are rejected and the UI asks to sign in again | desktop | passed | 1.5 s |
| auth | HR authentication › candidate account cannot sign in through the HR portal | desktop | passed | 1.7 s |
| auth | Candidate authentication › registration logs the candidate in and logout ends the session @smoke | desktop | passed | 2.7 s |
| auth | Candidate authentication › duplicate registration is prevented | desktop | passed | 1.5 s |
| auth | Candidate authentication › signup form validates required fields and password rules | desktop | passed | 1.4 s |
| auth | Candidate authentication › invalid candidate credentials are rejected | desktop | passed | 2.0 s |
| auth | Candidate authentication › candidate routes require a candidate session | desktop | passed | 1.5 s |
| auth | Candidate authentication › candidate cannot open HR pages or call HR APIs | desktop | passed | 2.8 s |
| auth | Candidate authentication › HR cannot use candidate-only APIs | desktop | passed | 0.2 s |
| candidate | Candidate portal › two candidates register; candidate 1 completes profile, searches, applies and is blocked from duplicates | desktop | passed | 6.7 s |
| dashboard | HR dashboard › statistics load from the API and match database counts | desktop | passed | 1.8 s |
| dashboard | HR dashboard › pipeline, outcome and activity widgets render | desktop | passed | 1.6 s |
| dashboard | HR dashboard › every HR module is reachable from the sidebar | desktop | passed | 2.3 s |
| dashboard | HR dashboard › stat cards link to filtered lists | desktop | passed | 1.6 s |
| dashboard | HR dashboard › empty states show when nothing matches | desktop | passed | 1.8 s |
| interview-offer | Interviews › reschedule a pending interview | desktop | passed | 2.5 s |
| interview-offer | Interviews › cancel a pending interview returns the candidate to the shortlist | desktop | passed | 2.5 s |
| interview-offer | Interviews › past interview dates are rejected (UI and API) | desktop | passed | 3.0 s |
| interview-offer | Interviews › failed interview blocks selection and offers; candidate sees the result | desktop | passed | 3.9 s |
| interview-offer | Interviews › invalid interview transitions are rejected by the API | desktop | passed | 1.8 s |
| interview-offer | Interview time zone › times are stored in UTC and shown in Asia/Kolkata whatever the browser time zone | desktop | passed | 3.7 s |
| interview-offer | Offers › offer form validates dates; a valid offer shows its details | desktop | passed | 2.9 s |
| interview-offer | Offers › candidate declines an offer; both portals and MySQL agree and hiring is blocked | desktop | passed | 3.0 s |
| interview-offer | Offers › duplicate and ineligible offers are rejected; candidates cannot change offers | desktop | passed | 1.3 s |
| jobs | Job management › create → list → details → edit → publish → search/filter → close → reopen | desktop | passed | 5.3 s |
| jobs | Job management › closed job shows as closed to a signed-in candidate | desktop | passed | 1.8 s |
| jobs | Job management › delete a dedicated draft job with confirmation | desktop | passed | 2.7 s |
| jobs | Job management › job form validates required fields and salary range | desktop | passed | 2.5 s |
| jobs | Job management › job write APIs require HR authorization | desktop | passed | 0.4 s |
| negative | Business rules › applications: duplicates, closed jobs, draft jobs and expired jobs are rejected | desktop | passed | 2.4 s |
| negative | Business rules › pipeline steps cannot be skipped or repeated | desktop | passed | 0.7 s |
| negative | Business rules › missing fields and invalid values are rejected with 400 | desktop | passed | 0.4 s |
| negative | Access control › candidates cannot read or act on another candidate's records | desktop | passed | 1.0 s |
| negative | Access control › HR-only endpoints reject candidates and anonymous callers | desktop | passed | 0.4 s |
| negative | Access control › error responses never leak stack traces or SQL | desktop | passed | 0.2 s |
| workflow | full recruitment workflow: job → application → interview → offer → hire | desktop | passed | 16.9 s |
| responsive | all major screens render cleanly at desktop 1440px | responsive | passed | 22.1 s |
| responsive | all major screens render cleanly at laptop 1280px | responsive | passed | 21.7 s |
| responsive | all major screens render cleanly at tablet 768px | responsive | passed | 20.8 s |
| responsive | all major screens render cleanly at mobile 375px | responsive | passed | 18.6 s |
| auth | HR authentication › valid HR login reaches dashboard and logout clears the session @smoke | tablet | passed | 2.7 s |
| auth | Candidate authentication › registration logs the candidate in and logout ends the session @smoke | tablet | passed | 2.9 s |
| auth | HR authentication › valid HR login reaches dashboard and logout clears the session @smoke | mobile | passed | 3.0 s |
| auth | Candidate authentication › registration logs the candidate in and logout ends the session @smoke | mobile | passed | 4.8 s |
