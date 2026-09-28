# RecruitFlow — Requirements & System Specification

## 1. Executive Summary & Assessment Scope
**Assessment Topic**: Topic 17 — Recruitment Management System (RMS)  
**Objective**: Build a complete, functional, interview-ready recruitment management system that automates the end-to-end recruitment lifecycle from job posting to candidate onboarding.

---

## 2. Technology Stack & Architectural Boundaries

| Layer | Approved Technology |
|---|---|
| **Frontend** | React.js (Vite), JavaScript, Bootstrap / CSS, React Router, Axios |
| **Backend** | Node.js, Express.js, JavaScript (REST APIs) |
| **Database** | MySQL (version 8.0+), accessed via `mysql2` driver |
| **Authentication** | JWT (JSON Web Tokens), `bcryptjs` password hashing |
| **Excluded Technologies** | TypeScript, MongoDB, Prisma, Spring Boot, Docker, Redis, Microservices, WebSockets |

---

## 3. End-to-End Business Workflow

```
[Job Creation] 
      ↓
[Job Publishing] 
      ↓
[Candidate Application] 
      ↓
[Screening] 
      ↓
[Shortlisting] 
      ↓
[Interview Scheduling] 
      ↓
[Interview Evaluation] 
      ↓
[Selection] 
      ↓
[Offer Generation] 
      ↓
[Offer Acceptance] 
      ↓
[Hiring]
```

---

## 4. Entity Lifecycle & State Machines

### 4.1 Job States
- `DRAFT`: Job opening drafted by HR/recruiter, invisible to public candidates.
- `PUBLISHED`: Actively accepting candidate applications.
- `CLOSED`: Recruitment concluded or paused; no new applications accepted.

### 4.2 Application States
1. `APPLIED`: Candidate submitted details and resume for an active published opening.
2. `SCREENING`: Initial resume and qualification screening under review by HR.
3. `SHORTLISTED`: Candidate met minimum criteria; eligible for interview scheduling.
4. `INTERVIEW_SCHEDULED`: Specific round, time, and interviewer assigned.
5. `INTERVIEWED`: Interview round completed; awaiting feedback.
6. `SELECTED`: Interview evaluation passed and hiring decision approved.
7. `OFFER_SENT`: Formal job offer with compensation and terms issued to candidate.
8. `OFFER_ACCEPTED`: Offer formally accepted by candidate.
9. `HIRED`: Candidate successfully onboarded into the organization.

**Terminal State**:
- `REJECTED`: Candidate fails screening, interview evaluation, or offer negotiation. This is a terminal state that halts pipeline progression.

---

## 5. Core Business Rules

1. **Application Ingestion**:
   - Only `PUBLISHED` jobs can receive applications.
   - Applications must be rejected for `DRAFT` or `CLOSED` jobs.
   - A candidate cannot apply multiple times to the same job opening (unique email + job constraint).
2. **Screening & Shortlisting**:
   - Screening must occur prior to shortlisting.
   - Only candidates with status `SHORTLISTED` can be scheduled for an interview.
3. **Interview Operations**:
   - Every scheduled interview must record interviewer notes, evaluation score, and recommendation.
   - A candidate must attain a passing evaluation before being advanced to `SELECTED`.
4. **Offer & Hiring**:
   - Only candidates in `SELECTED` state can receive an offer (`OFFER_SENT`).
   - Only valid, active offers can be transitioned to `OFFER_ACCEPTED`.
   - Onboarding / `HIRED` status is contingent on `OFFER_ACCEPTED`.
5. **Rejection Permanence**:
   - An application marked `REJECTED` cannot advance further along the pipeline.

---

## 6. Security & Infrastructure Compliance

1. **Decoupled Architecture**: All database interactions are strictly encapsulated within backend Express controllers and services. React connects solely via HTTP REST JSON calls.
2. **Environment Variables**: No sensitive configuration (passwords, JWT secrets, database credentials) is committed to version control. Production and local values are loaded via `.env`.
3. **Auditability**: All state transitions should record timestamps and acting user identifiers for interview demonstration.
