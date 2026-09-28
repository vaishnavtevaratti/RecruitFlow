# RecruitFlow — Agent Guidelines & Project Rules

This document outlines mandatory architectural, technological, and procedural rules for all AI agents working on the **RecruitFlow** codebase.

---

## 1. Project Overview & Assessment Topic
- **Topic**: Topic 17 — Recruitment Management System (RMS)
- **Goal**: A fully functioning, end-to-end recruitment management business application demonstrable live for technical interviews.
- **Scope**: Job openings, applicant screening, interview scheduling & evaluation, candidate selection, offer generation, offer acceptance, and hiring.

---

## 2. Technology Stack Constraints

### Approved Technologies
- **Frontend**: React.js, Vite, JavaScript, Bootstrap / Vanilla CSS, React Router, Axios
- **Backend**: Node.js, Express.js, JavaScript, REST APIs
- **Database**: MySQL, `mysql2` driver (direct relational queries / connection pool)
- **Authentication**: JWT (JSON Web Tokens), `bcryptjs`

### Architecture
```
React Frontend (Vite)
       ↓
 REST API / JSON
       ↓
Node.js + Express.js Backend
       ↓
 mysql2 Connection Pool
       ↓
 MySQL Relational Database
```

### STRICT TECHNOLOGY PROHIBITIONS
Do **NOT** use or introduce:
- MongoDB / Mongoose
- Prisma / TypeORM / Sequelize ORMs
- Spring Boot / Java backend
- TypeScript (keep to clean JavaScript)
- Docker / Containerization
- Redis / Caching layers
- Microservices architecture
- WebSockets
- Unnecessary AI/ML features
- Unnecessary external dependencies or heavy UI component libraries

Keep the system simple, clean, reliable, and interview-demonstrable.

---

## 3. Strict Development & Security Rules

1. **No Direct Database Access**: Never connect React directly to MySQL. All database operations must go through Express REST endpoints.
2. **Secrets & Credentials**:
   - Never hardcode database passwords, JWT secrets, or API keys in source code.
   - All secrets must be loaded from `.env` in the backend.
   - `.env` must remain in `.gitignore`.
   - Always maintain `server/.env.example` with sanitized placeholders.
   - Never print database passwords, JWT secrets, or sensitive tokens in terminal/console logs.
3. **Verification First**:
   - Never claim something works without executing real verification (tests, HTTP requests, DB queries).
   - Do not create mock/placeholder implementations for core business features that are supposed to function.
   - Prefer simple, reliable, maintainable code over complex over-engineering.
   - Do not rewrite working code unnecessarily.
   - Before completing any phase: build, run, test, and verify end-to-end.

---

## 4. Business Workflow & State Transitions

### Job Workflow & States
- **States**: `DRAFT` → `PUBLISHED` → `CLOSED`
- **Rules**:
  - Only `PUBLISHED` jobs accept candidate applications.
  - `CLOSED` or `DRAFT` jobs reject new applications.

### Application Workflow & States
- **Sequence**:
  1. `APPLIED`
  2. `SCREENING`
  3. `SHORTLISTED`
  4. `INTERVIEW_SCHEDULED`
  5. `INTERVIEWED`
  6. `SELECTED`
  7. `OFFER_SENT`
  8. `OFFER_ACCEPTED`
  9. `HIRED`
- **Terminal State**: `REJECTED` (can occur at applicable decision points).

### Business Rules
- A candidate cannot apply twice to the same job opening.
- Screening must occur before shortlisting.
- Only shortlisted candidates can have interviews scheduled.
- Interview feedback and scores must be recorded.
- Candidate must pass interview evaluation before being marked `SELECTED`.
- Only `SELECTED` candidates can receive an offer (`OFFER_SENT`).
- Only valid, active offers can transition to `OFFER_ACCEPTED` and subsequent `HIRED`.
- Rejected candidates cannot progress further through the pipeline.
