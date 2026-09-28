# RecruitFlow — Database Architecture & Documentation

## 1. Overview
RecruitFlow utilizes a normalized relational MySQL schema (version 8.0+) with strict referential integrity (`InnoDB` engine, `utf8mb4_unicode_ci` collation). It supports the entire recruitment lifecycle: job posting, candidate sourcing, application pipeline progression, interview evaluation, offer letter generation, and onboarding.

---

## 2. Configuration & Environment Variables

All database connections and credentials are loaded dynamically from `server/.env`.

Required variables:
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

> **Security Note**: Never commit actual database passwords or JWT secrets to Git. Always copy `server/.env.example` to `server/.env` for local environments.

---

## 3. Database Setup & Verification

### 3.1 Setup Script
Execute the idempotent database initialization script:
```bash
cd server
npm run db:setup
```
The script performs the following steps:
1. Connects to the local MySQL server.
2. Creates the `recruitflow` database if it does not exist.
3. Applies [`database/schema.sql`](file:///c:/Users/hp/Desktop/RecruitFlow/database/schema.sql) to define all 6 relational tables, indexes, and foreign keys.
4. Applies [`database/seed.sql`](file:///c:/Users/hp/Desktop/RecruitFlow/database/seed.sql) to populate realistic demo data.
5. Encrypts the demo password using `bcryptjs` (cost factor 10) and upserts the demo HR user from `DEMO_HR_EMAIL`.

### 3.2 Verification Script
Run the automated 20-point verification test suite against the live MySQL instance:
```bash
cd server
npm run db:verify
```
The script validates:
- TCP connection to MySQL.
- Existence of database `recruitflow`.
- Existence of all 6 core tables.
- Primary key presence on every table.
- Foreign key constraint wiring.
- Composite `UNIQUE(candidate_id, job_id)` constraint on applications.
- `UNIQUE(application_id)` constraint on offers.
- Data integrity across users, jobs, candidates, applications, interviews, and offers.
- Execution of real `SELECT` queries across all tables.

---

## 4. Table Overview

| Table Name | Description | Key Attributes / Constraints |
|---|---|---|
| `users` | System recruiters, interviewers, and administrators. | Primary Key: `id`, Unique: `email`, `role`: `HR`, `INTERVIEWER`, `ADMIN`. |
| `jobs` | Job postings and requisitions. | Primary Key: `id`, FK: `created_by` → `users(id)`, Status: `DRAFT`, `PUBLISHED`, `CLOSED`. |
| `candidates` | Candidate profiles and contact information. | Primary Key: `id`, Indexed: `email`. |
| `applications` | Pipeline state machine linking candidate to job. | Primary Key: `id`, FKs: `candidate_id`, `job_id`, Unique: `(candidate_id, job_id)`. |
| `interviews` | Scheduled rounds, 1–10 evaluations, and feedback. | Primary Key: `id`, FKs: `application_id`, `interviewer_id`, Result: `PENDING`, `PASS`, `FAIL`. |
| `offers` | 1-to-1 compensation offers issued to candidates. | Primary Key: `id`, FK & Unique: `application_id`, Status: `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED`. |

---

## 5. Entity Relationships & Referential Integrity

```
users (HR / Admin)
  │
  ├───[1:N]───> jobs
  │
  └───[1:N]───> interviews (assigned interviewer)

candidates
  │
  └───[1:N]───> applications <───[N:1]─── jobs
                      │
                      ├───[1:N]───> interviews
                      │
                      └───[1:1]───> offers
```

- **Referential Integrity**: All foreign keys enforce `ON DELETE RESTRICT` to prevent accidental cascading deletion of audit trails or recruitment records.
- **Uniqueness Invariants**:
  - `applications`: `UNIQUE(candidate_id, job_id)` prevents duplicate applications from the same candidate to the same job opening.
  - `offers`: `UNIQUE(application_id)` ensures only one active offer record per candidate application.

---

## 6. Seed Accounts & Demo Data

The seed data models a real-world recruitment process following valid business rules:

### Demo Accounts
| Role | Email | Password |
|---|---|---|
| HR Manager | `hr@recruitflow.com` | Configured in `DEMO_HR_PASSWORD` (`Admin@123`) |
| Interviewer | `interviewer@recruitflow.com` | `Admin@123` (bcrypt hashed) |
| Administrator | `admin@recruitflow.com` | `Admin@123` (bcrypt hashed) |

### Job Openings
1. **Senior Full Stack Engineer** (`PUBLISHED`) — Open for applications; contains realistic pipeline candidates.
2. **DevOps & Cloud Engineer** (`DRAFT`) — Internal draft; rejects candidate applications.
3. **Junior Frontend Developer** (`CLOSED`) — Filled / closed requisition; rejects new applications.

### Application Pipeline Progression
All demo applications correspond to the active `PUBLISHED` opening:
- `HIRED`: Candidate Ethan Hunt (interview passed with score 9/10, offer accepted at $125k).
- `SELECTED`: Candidate Alice Walker (interview passed with score 8/10, offer sent at $115k).
- `INTERVIEWED`: Candidate Charlie Davis (interview completed with score 8/10, pending selection).
- `INTERVIEW_SCHEDULED`: Candidate Bob Smith (upcoming technical round scheduled).
- `SHORTLISTED`: Candidate Diana Prince (screening passed, eligible for scheduling).
- `APPLIED`: Candidate Fiona Gallagher (newly submitted profile, awaiting screening).
