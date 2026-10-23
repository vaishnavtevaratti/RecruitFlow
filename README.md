# RecruitFlow — Recruitment Management System

RecruitFlow is a full-stack, enterprise-grade Recruitment Management System (RMS) designed to streamline and automate the entire hiring lifecycle — from job opening management, applicant screening, and interview scheduling to structured evaluations, candidate selection, offer generation, candidate offer acceptance, and hiring.

---

## 1. System Architecture

```
React.js + Vite Frontend (Port 5173)
              ↓
    REST API / JSON (Axios)
              ↓
Node.js + Express.js Backend (Port 5000)
              ↓
     mysql2 Connection Pool
              ↓
  MySQL 8.0 Relational Database (Port 3306)
```

- **Frontend**: React 18, Vite, React Router v6, Bootstrap 5 / Vanilla CSS, Axios.
- **Backend**: Node.js, Express.js, JWT Authentication, bcryptjs password hashing.
- **Database**: MySQL 8.0 with transactional safety and foreign key relational constraints.

---

## 2. Directory Structure

```
RecruitFlow/
├── AGENTS.md                          # Mandatory agent guidelines and constraints
├── README.md                          # Comprehensive project documentation
├── client/                            # React frontend (Vite)
│   ├── src/
│   │   ├── components/                # Reusable UI components (Sidebar, Navbar, StatusBadge, etc.)
│   │   ├── context/                   # AuthContext with role-aware session state
│   │   ├── pages/                     # HR & Candidate Portal pages
│   │   │   ├── CandidateLogin.jsx     # Candidate sign in
│   │   │   ├── CandidateSignup.jsx    # Candidate self-registration
│   │   │   ├── CandidateDashboard.jsx # Real-time candidate metrics and recent activity
│   │   │   ├── CandidateJobs.jsx      # Portal job exploration
│   │   │   ├── CandidateApplications.jsx # Candidate application history
│   │   │   ├── CandidateApplicationDetails.jsx # Visual timeline, interview & offer acceptance
│   │   │   ├── CandidateProfile.jsx   # Candidate profile management
│   │   │   ├── Dashboard.jsx          # HR metrics and funnel overview
│   │   │   ├── Jobs.jsx               # HR job requisitions
│   │   │   ├── Candidates.jsx         # Candidate talent pool
│   │   │   ├── Applications.jsx       # HR application pipeline
│   │   │   ├── Interviews.jsx         # Interview scheduling & scoring
│   │   │   ├── Offers.jsx             # Offer management & hiring records
│   │   │   ├── PublicJobs.jsx         # Public careers board
│   │   │   └── ApplyJob.jsx           # Public & authenticated job application
│   │   └── services/                  # Axios API service layer
├── server/                            # Node.js + Express backend
│   ├── src/
│   │   ├── config/db.js               # mysql2 connection pool
│   │   ├── controllers/               # Business workflow controllers
│   │   ├── middleware/                # JWT auth, RBAC authorization, and input validation
│   │   ├── routes/                    # REST API route definitions
│   │   ├── services/                  # recruitmentService (transactional workflow) + skillMatchService
│   │   └── utils/                     # workflow.js state machine, dates.js, jwt.js
│   └── scripts/
│       ├── setupDatabase.js           # Creates schema + seed data (idempotent)
│       ├── verifyDatabase.js          # Database verification (20 checks)
│       ├── migratePhase4.js           # Safe Phase 4 migration script
│       ├── testApi.js                 # HR API regression suite
│       ├── testCandidateApi.js        # Candidate portal + workflow suite
│       ├── testSecurity.js            # Authorization, IDOR, validation, concurrency, rollback suite
│       ├── testSkillMatch.js          # Skill-matching unit tests (no DB needed)
│       └── e2eWorkflow.js             # End-to-end hire + declined-offer scenarios
└── database/
    ├── schema.sql                     # Complete MySQL relational schema
    └── seed.sql                       # Demo seed data
```

---

## 3. Recruitment Lifecycle & State Model

```
Job:          DRAFT ──publish──▶ PUBLISHED ──close──▶ CLOSED

Application:  APPLIED ─screen─▶ SCREENING ─shortlist─▶ SHORTLISTED ─schedule interview─▶ INTERVIEW_SCHEDULED
              ─evaluate─▶ INTERVIEWED ─select (needs PASS)─▶ SELECTED ─create offer─▶ OFFER_SENT
              ─candidate accepts─▶ OFFER_ACCEPTED ─HR confirms hire─▶ HIRED

              REJECTED (terminal): HR rejection, or the candidate declines the offer.
Offer:        SENT ─▶ ACCEPTED | REJECTED (declined) | EXPIRED
```

Rules enforced in the backend (`server/src/utils/workflow.js`, `recruitmentService.js`):

- Only `PUBLISHED` jobs whose deadline has not passed accept applications and appear on job boards.
- A candidate can apply to a job once (checked in code and by the `UNIQUE(candidate_id, job_id)` constraint).
- Screening must happen before shortlisting; only shortlisted candidates can be interviewed.
- Interviews must be scheduled in the future, with an HR/Admin/Interviewer account as interviewer. Pending interviews can be rescheduled.
- An interview can be evaluated once; selection requires the latest interview result to be `PASS`.
- Only `SELECTED` applications can receive an offer (one per application). Expiry must not be in the past, and joining/expiry dates cannot precede the offer date.
- **Accepting an offer moves the application to `OFFER_ACCEPTED`. HR then confirms with "Mark as hired" (`PATCH /api/applications/:id/hire`).** Hiring never happens automatically.
- An offer past its expiry date is reported as `EXPIRED` everywhere (computed on read; stored rows are not rewritten) and can no longer be accepted or declined. HR can then reject the application, which records the offer as `EXPIRED`.
- HR cannot reject an application while an unexpired offer awaits the candidate, or after the candidate accepted.
- `REJECTED` and `HIRED` are terminal.
- Every status change runs in a MySQL transaction that locks the application row (`SELECT … FOR UPDATE`), so double clicks and concurrent requests cannot both pass a state check.

---

## 4. Roles & Access Control

| Role | Can do |
| :--- | :--- |
| **HR / ADMIN** | Jobs (create, edit, publish, close), applications pipeline, candidates, interviews (schedule, reschedule, evaluate), offers, hiring, dashboard, skill matching. |
| **INTERVIEWER** | Sees and evaluates only interviews assigned to them, and only the applications behind those interviews. |
| **CANDIDATE** | Own profile, browse open jobs, apply, track own applications and interviews, accept/decline own offers. |

- Every API route checks the JWT and role on the server; UI hiding is only a convenience.
- Candidate endpoints derive identity from the JWT. `candidate_id`/email in request bodies are ignored, and other candidates' applications return `403`.
- The public application form refuses emails that belong to a registered account (those users must sign in), so nobody can add applications to someone else's account.

---

## 5. Features

**HR portal:** live dashboard (open jobs, awaiting screening, pending interviews, active/expired offers, ready to hire, hired); job management with validation and confirm dialogs; application pipeline with stage tabs, search and job filter; application page with stage stepper, interview scheduling/rescheduling/evaluation, offer creation, hire and reject actions; interviews and offers lists with status filters; rule-based skill matching.

**Candidate portal:** signup/login, dashboard, job board (marks jobs already applied to), apply flow that saves profile edits, application list with filters, application page with progress timeline, interview details, and offer accept/decline with confirmation; profile editing.

**Public pages:** careers board, guest application form, application status lookup (application ID + email).

### Skill matching (rule-based, advisory)

`GET /api/applications/:id/skill-match` (HR/Admin) compares the job's required skills with the candidate's skills, experience and education text.

- **Score** = required skills found in the profile ÷ required skills × 100. Matching uses exact names, common aliases (e.g. "NodeJS" = "Node.js") and a few related-skill rules (e.g. MySQL counts as SQL).
- Output lists matched skills with their evidence, skills **not mentioned (unverified, not confirmed missing)**, other candidate skills, and suggested interview questions.
- **Limitations:** keyword matching cannot judge depth or recency; linked resumes are not read; the score is not a prediction of job performance.
- It is advisory only. It never shortlists, rejects, selects or hires, and it does not use or infer sensitive personal attributes.
- **No external AI provider is used, and no data leaves the server.** An optional LLM-generated summary is not installed; see Known Limitations.

---

## 6. Environment Variables (`server/.env`, template in `server/.env.example`)

| Variable | Purpose |
| :--- | :--- |
| `PORT` | API port (default 5000) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL` | MySQL connection |
| `JWT_SECRET` | **Required.** The server refuses to start without it (there is no built-in fallback). |
| `DEMO_HR_EMAIL`, `DEMO_HR_PASSWORD` | Demo HR account created/updated by `db:setup`, used by test scripts |
| `CORS_ORIGIN` | Optional comma-separated allowed origins; empty allows all (auth uses Bearer tokens, not cookies) |

Frontend: `client/.env` → `VITE_API_URL` (default `http://localhost:5000/api`). Never put secrets in client env files; they are bundled into the browser.

---

## 7. Accounts for Local Demo

| Account | Email | Password | Source |
| :--- | :--- | :--- | :--- |
| HR Manager | `hr@recruitflow.com` | `Admin@123` | `seed.sql` / `DEMO_HR_*` |
| Interviewer | `interviewer@recruitflow.com` | `Admin@123` | `seed.sql` |
| Admin | `admin@recruitflow.com` | `Admin@123` | `seed.sql` |
| Candidate | `marcus.vance@example.com` | `Password@123` | Exists in the current local database only (not in `seed.sql`) |

On a fresh database, register a candidate at `/candidate/signup`. These are demo credentials for local use only.

---

## 8. Running Locally (Windows PowerShell)

```powershell
# 0. MySQL 8 must be running (service MySQL80)
Get-Service MySQL80

# 1. First time only: install deps and create schema + seed
cd C:\Users\hp\Desktop\RecruitFlow\server
npm.cmd install
npm.cmd run db:setup

# 2. Backend (http://localhost:5000)
npm.cmd start

# 3. Frontend, in a second terminal (http://127.0.0.1:5173)
cd C:\Users\hp\Desktop\RecruitFlow\client
npm.cmd install
npm.cmd run dev
```

---

## 9. Tests

Run from `server/`. Except `testSkillMatch.js`, the suites need MySQL; `testApi`, `testSecurity` and `e2eWorkflow` start an in-process API if none is running, `testCandidateApi` needs the backend running. All suites delete the records they create.

| Command | Covers |
| :--- | :--- |
| `node scripts/verifyDatabase.js` | Schema, constraints, seed data (20 checks) |
| `node scripts/testApi.js` | HR API workflow and negative cases |
| `node scripts/testCandidateApi.js` | Candidate portal, IDOR, offer accept/decline, HR/candidate sync |
| `node scripts/testSecurity.js` | Role separation, IDOR, input validation, concurrent duplicate requests, offer expiry, hiring rules, transaction rollback |
| `node scripts/testSkillMatch.js` | Skill-matching logic |
| `node scripts/e2eWorkflow.js` | Scenario A (hire) and Scenario B (declined offer) end to end, checking both portals and MySQL |

Frontend build: `cd client; npm.cmd run build`.

---

## 10. Known Limitations

- No email verification: a candidate who signs up is linked to earlier guest applications made with the same email.
- `candidates.email` has no UNIQUE index. Concurrent duplicate creation is prevented with a MySQL named lock; adding the index would need a migration (check existing data for duplicates first).
- `candidates.experience` is `VARCHAR(50)`, so experience is a short value such as "4 years" (validated, returns 400 rather than failing).
- No login rate limiting or account lockout.
- Interview cancellation is not supported (no status for it in the schema); interviews can be rescheduled.
- Offer expiry is evaluated against the server's local date.
- Interview datetimes are stored without a timezone; server and browsers are assumed to share one.
- Seed data contains application #2 in `SELECTED` with an expired `SENT` offer. It is left as-is; HR can reject it to close it out.
- Optional LLM summary for skill matching is not implemented. It would need `@anthropic-ai/sdk`, an `ANTHROPIC_API_KEY`, per-request API cost, and sending job/candidate profile text to Anthropic.
