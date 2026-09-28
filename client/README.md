# RecruitFlow — Frontend Client Documentation

## 1. Overview
The RecruitFlow frontend is a responsive Single Page Application (SPA) built with React.js, Vite, and Bootstrap 5. It provides a recruitment management dashboard for HR administrators, recruiters, and interviewers, as well as a candidate-facing public career portal.

---

## 2. Architecture & Technology Stack

```
React (Vite) SPA
       ↓
 Axios Centralized Client (Bearer JWT Interceptors)
       ↓
 Express.js REST API (http://localhost:5000/api)
       ↓
 MySQL Relational Database (recruitflow)
```

- **Framework**: React 18, Vite 6
- **Routing**: React Router v6 (Nested layout, ProtectedRoute guards)
- **Styling**: Bootstrap 5, Bootstrap Icons, Vanilla CSS Design System
- **State Management**: React Context (`AuthContext` with session persistence)
- **HTTP Client**: Axios with interceptors and automatic 401 handling

---

## 3. Environment Configuration

All client environment variables are prefixed with `VITE_` and managed via `client/.env`:

```ini
VITE_API_URL=http://localhost:5000/api
```

> **Security Rule**: No database credentials or backend secrets are ever placed in the frontend application.

---

## 4. Getting Started

### Development
```bash
cd client
npm.cmd install
npm.cmd run dev
```
The Vite development server will launch at: `http://localhost:5173`

### Production Build
```bash
npm.cmd run build
npm.cmd run preview
```

---

## 5. Route Map

### Public Candidate Routes
- `/jobs/public` — Public career portal displaying actively `PUBLISHED` jobs.
- `/jobs/:id/apply` — Public application form with immediate reference ID receipt.
- `/application-status` — Candidate self-service application reference lookup.
- `/login` — Recruiter and interviewer authentication portal.

### Authenticated HR/Staff Routes (`ProtectedRoute`)
- `/dashboard` — Executive hiring KPIs and recruitment conversion funnel.
- `/jobs` — Job requisition directory with search and status filtering (`DRAFT`, `PUBLISHED`, `CLOSED`).
- `/jobs/new` — Create a new job requisition (`DRAFT`).
- `/jobs/:id` — Comprehensive job details and specifications.
- `/jobs/:id/edit` — Edit requisition parameters.
- `/candidates` — Candidate directory and qualifications talent pool.
- `/candidates/:id` — Individual candidate profile and contact details.
- `/applications` — Recruitment pipeline table across all stages.
- `/applications/:id` — Visual pipeline stepper, stage action center, interview scoring, and offer generation.
- `/interviews` — Schedule rounds, record 1–10 metrics, and evaluate `PASS`/`FAIL`.
- `/offers` — Compensation packages, candidate offer acceptance, and hiring completion.

---

## 6. Business Workflow & State Invariants

The UI reflects the backend recruitment state machine:
1. **Screening Requirement**: Directly moving from `APPLIED` to `SHORTLISTED` is prohibited.
2. **Interview Prerequisite**: Only `SHORTLISTED` applications display interview scheduling options.
3. **Selection Invariant**: Candidate must complete an interview with a `PASS` evaluation before being eligible for `SELECTED`.
4. **Offer Invariant**: Offers can only be generated for `SELECTED` candidates.
5. **Hiring Invariant**: Valid `SENT` offers transitioned to `ACCEPTED` explicitly move the candidate to `HIRED`.
6. **Rejection Invariant**: An application marked `REJECTED` permanently stops subsequent pipeline stages.
