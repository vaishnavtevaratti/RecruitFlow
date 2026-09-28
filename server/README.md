# RecruitFlow — Backend REST API Documentation

## 1. Overview
The RecruitFlow backend is a robust RESTful API built on Node.js and Express.js that interfaces directly with a normalized MySQL database via `mysql2` connection pooling. It orchestrates the entire recruitment lifecycle including job requisition management, candidate application intake, resume screening, interview scheduling and evaluation, candidate selection, offer generation, and onboarding.

---

## 2. Environment Variables & Setup

All configuration is loaded from `server/.env`. Use `server/.env.example` as a template:

```ini
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<YOUR_MYSQL_PASSWORD>
DB_NAME=recruitflow
JWT_SECRET=<YOUR_LOCAL_JWT_SECRET>
DEMO_HR_EMAIL=hr@recruitflow.com
DEMO_HR_PASSWORD=Admin@123
```

> **Security Note**: Never commit actual database passwords or JWT secrets to Git.

### Installation
```bash
cd server
npm.cmd install
```

### Database Initialization & Verification
```bash
npm.cmd run db:setup     # Applies schema.sql and seed.sql idempotently
npm.cmd run verify-db    # Runs 20-point database health and constraint checks
```

### Starting the Server
```bash
npm.cmd start            # Starts Express server on PORT (default: 5000)
npm.cmd run dev          # Development start
```

### Executing the End-to-End API Test Suite
```bash
npm.cmd run test-api     # Executes 24 automated workflow & negative tests
```

---

## 3. Demo Credentials

| Role | Email | Password |
|---|---|---|
| HR Manager | `hr@recruitflow.com` | `Admin@123` |
| Interviewer | `interviewer@recruitflow.com` | `Admin@123` |
| Administrator | `admin@recruitflow.com` | `Admin@123` |

---

## 4. Authentication & Authorization

All protected routes require a JSON Web Token (JWT) passed in the HTTP Authorization header:
```
Authorization: Bearer <token>
```

- **JWT Expiration**: 24 hours.
- **Roles Enforced**:
  - `HR` & `ADMIN`: Unrestricted management of jobs, candidates, applications, screening, shortlisting, selection, and offers.
  - `INTERVIEWER`: Scoped access to assigned candidate interviews and scoring submissions.
  - `PUBLIC`: Public job board listings and candidate application submission.

---

## 5. Centralized Workflow State Machine (`src/utils/workflow.js`)

### Job Lifecycle
`DRAFT` → `PUBLISHED` → `CLOSED`
- Only `PUBLISHED` jobs accept applications.
- `CLOSED` jobs reject applications and cannot be republished.

### Application Lifecycle
```
APPLIED 
   ↓
SCREENING 
   ↓
SHORTLISTED 
   ↓
INTERVIEW_SCHEDULED 
   ↓
INTERVIEWED 
   ↓
SELECTED 
   ↓
OFFER_SENT 
   ↓
OFFER_ACCEPTED 
   ↓
HIRED
```
- **Rejection**: An application can transition to `REJECTED` from any non-terminal state. `REJECTED` is terminal and blocks all subsequent transitions.
- **Screening Invariant**: Direct `APPLIED` → `SHORTLISTED` is strictly rejected (HTTP 400).
- **Interview Invariant**: Only `SHORTLISTED` applications can have an interview scheduled.
- **Evaluation Invariant**: Interview evaluation (`PASS` / `FAIL`) updates application to `INTERVIEWED`.
- **Selection Invariant**: Candidate must be in `INTERVIEWED` status with latest interview `PASS` to advance to `SELECTED`.
- **Offer Invariant**: Only `SELECTED` candidates can receive an offer (`OFFER_SENT`).
- **Hiring Invariant**: Valid `SENT` non-expired offer accepted moves offer to `ACCEPTED` and application to `OFFER_ACCEPTED` → `HIRED`.

---

## 6. API Endpoints Reference

### Health Checks
- `GET /api/health` — Basic API service liveness check.
- `GET /api/health/db` — Verifies live MySQL connection pool connectivity.

### Authentication
- `POST /api/auth/login` — Authenticates credentials and returns JWT token and user profile.
- `GET /api/auth/me` — Fetches current authenticated user profile (`Bearer <token>`).

### Jobs
- `GET /api/jobs` — Lists jobs (Public sees `PUBLISHED`; authenticated HR/Admin sees all; supports `?status=&search=&department=`).
- `GET /api/jobs/:id` — Fetches detailed job opening by ID.
- `POST /api/jobs` — Creates a job requisition in `DRAFT` status (HR/Admin).
- `PUT /api/jobs/:id` — Updates job details (HR/Admin).
- `PATCH /api/jobs/:id/publish` — Publishes a `DRAFT` job opening (HR/Admin).
- `PATCH /api/jobs/:id/close` — Closes an active job opening (HR/Admin).

### Candidates
- `GET /api/candidates` — Lists candidate records (HR/Admin; supports `?search=`).
- `GET /api/candidates/:id` — Fetches single candidate profile (HR/Admin).
- `POST /api/candidates` — Manually registers a candidate profile (HR/Admin).
- `PUT /api/candidates/:id` — Updates candidate profile details (HR/Admin).

### Applications
- `POST /api/applications` — Public candidate application submission. Reuses existing candidate by email or creates a new one. Enforces uniqueness.
- `GET /api/applications` — Lists applications (HR/Admin; supports `?job_id=&status=&search=`).
- `GET /api/applications/:id` — Fetches application with interview history and offer (HR/Admin/Interviewer).
- `PATCH /api/applications/:id/screen` — Moves application from `APPLIED` → `SCREENING` (HR/Admin).
- `PATCH /api/applications/:id/shortlist` — Moves application from `SCREENING` → `SHORTLISTED` (HR/Admin).
- `PATCH /api/applications/:id/reject` — Rejects application from active state (HR/Admin).
- `PATCH /api/applications/:id/select` — Advances candidate from `INTERVIEWED` (with `PASS`) → `SELECTED` (HR/Admin).

### Interviews
- `POST /api/interviews` — Schedules interview for `SHORTLISTED` application (HR/Admin).
- `GET /api/interviews` — Lists interviews (HR sees all; Interviewer sees assigned).
- `GET /api/interviews/:id` — Fetches interview details.
- `PUT /api/interviews/:id/evaluate` — Submits 1-10 scores, feedback, and `PASS`/`FAIL` result (Interviewer/HR).

### Offers & Hiring
- `POST /api/offers` — Generates job offer for `SELECTED` candidate (HR/Admin).
- `GET /api/offers` — Lists offers (HR/Admin; supports `?status=`).
- `GET /api/offers/:id` — Fetches offer details (HR/Admin).
- `PATCH /api/offers/:id/accept` — Accepts offer and transitions candidate to `HIRED`.
- `PATCH /api/offers/:id/reject` — Declines offer and marks application `REJECTED`.

### Dashboard Analytics
- `GET /api/dashboard/stats` — Executive dashboard metrics and funnel breakdown queried directly from MySQL (HR/Admin).
