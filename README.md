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
│   │   ├── services/                  # Core transactional database logic
│   │   └── utils/workflow.js          # Recruitment lifecycle state machine engine
│   └── scripts/
│       ├── verifyDatabase.js          # Phase 1 database verification suite (20/20 checks)
│       ├── testApi.js                 # Phase 2 HR backend API regression suite (24/24 tests)
│       ├── migratePhase4.js           # Safe Phase 4 database migration script
│       └── testCandidateApi.js        # Phase 4 Candidate Portal verification suite (36/36 tests)
└── database/
    └── schema.sql                     # Complete MySQL relational schema
```

---

## 3. Recruitment Lifecycle & State Model

The system enforces a strict state machine across the recruitment workflow:

```
[APPLIED]
   ↓  (HR Screening)
[SCREENING]
   ↓  (HR Shortlisting)
[SHORTLISTED]
   ↓  (HR Interview Scheduling)
[INTERVIEW_SCHEDULED]
   ↓  (Interviewer Evaluation)
[INTERVIEWED]
   ↓  (HR Candidate Selection)
[SELECTED]
   ↓  (HR Offer Generation)
[OFFER_SENT]
   ↓  (Candidate Offer Acceptance)
[OFFER_ACCEPTED]
   ↓
[HIRED]
```

- **Rejection**: Terminal state `REJECTED` can be triggered at screening, shortlisting, interview evaluation, or offer stages. Once rejected or hired, terminal states cannot be overridden.
- **Mutual HR & Candidate Sync**: Candidate accepting an offer immediately updates `offers.status = 'ACCEPTED'` and `applications.status = 'HIRED'`, immediately visible to both Candidate and HR.

---

## 4. User Roles & Access Control

| Role | Permissions & Scope |
| :--- | :--- |
| **HR / ADMIN** | Create & publish jobs, review talent pool, screen & shortlist applicants, schedule interviews, evaluate, select candidates, generate & send offers, view system-wide recruitment analytics. |
| **INTERVIEWER** | View assigned candidate applications, conduct scheduled rounds, record structured ratings (Technical, Communication, Problem Solving, Overall) and pass/fail evaluations. |
| **CANDIDATE** | Register account, log in, browse published openings, submit applications (with prefilled profile), view application status, track recruitment timeline, view interview details & links, review job offers, and accept or decline offers. |

---

## 5. Candidate Portal (Phase 4 Features)

1. **Candidate Registration & Login**:
   - `POST /api/auth/candidate/signup`: Creates account with role `CANDIDATE`, securely hashes password with `bcryptjs`, and automatically links to any existing applicant records matching email.
   - `POST /api/auth/candidate/login`: Returns JWT token containing user identity and candidate reference.
2. **Role-Based Protection & IDOR Prevention**:
   - Candidates are restricted to `/candidate/*` routes and endpoints.
   - All candidate queries derive `candidate_id` exclusively from the authenticated JWT token — never from user-supplied request parameters.
   - Accessing another candidate's application returns `403 Forbidden`.
3. **Candidate Dashboard**:
   - Real-time statistics: Total Applied, Active Applications, Interviews, Selected, Offers, Hired.
   - Recent applications list with direct tracking links.
4. **My Applications & Visual Timeline**:
   - Interactive 9-stage progression timeline distinguishing **Completed**, **Current Stage**, and **Upcoming**.
   - Clear terminal state display if rejected.
5. **Interview Tracking**:
   - Real-time display of scheduled date, time, interview type, and meeting links.
   - Ratings and pass/fail results display upon evaluation completion (hidden while pending).
6. **Offer Review & Acceptance**:
   - Displays salary, offer date, joining date, and expiry date.
   - **Accept Offer**: Validates non-expired status and candidate ownership, and executes an atomic MySQL transaction transitioning offer to `ACCEPTED` and application to `HIRED`.
   - **Decline Offer**: Allows candidate to decline, setting offer to `REJECTED`.

---

## 6. Demo Credentials

### HR Manager (Staff Portal)
- **URL**: `http://127.0.0.1:5173/login`
- **Email**: `hr@recruitflow.com`
- **Password**: `Admin@123`

### Technical Interviewer (Staff Portal)
- **URL**: `http://127.0.0.1:5173/login`
- **Email**: `interviewer@recruitflow.com`
- **Password**: `Admin@123`

### Candidate Portal
- **Login URL**: `http://127.0.0.1:5173/candidate/login`
- **Signup URL**: `http://127.0.0.1:5173/candidate/signup`
- **Verified Demo Candidate**: `marcus.vance@example.com` / `Password@123`

---

## 7. How to Run Locally

### 1. Start the Backend API Server
```powershell
cd server
npm.cmd start
```
*Backend runs on `http://localhost:5000`.*

### 2. Start the Frontend Application
```powershell
cd client
npm.cmd run dev
```
*Frontend runs on `http://127.0.0.1:5173`.*

---

## 8. Automated Test & Verification Commands

All phases are verified with automated test suites ensuring zero regressions:

### Database Verification (20/20 Checks)
```powershell
cd server
node scripts/verifyDatabase.js
```

### HR Backend API Regression Suite (24/24 Tests)
```powershell
cd server
node scripts/testApi.js
```

### Candidate Portal & Workflow Suite (36/36 Tests)
```powershell
cd server
node scripts/testCandidateApi.js
```

### Frontend Production Build
```powershell
cd client
npm.cmd run build
```
*(Builds in ~1.4s with 0 errors and 0 warnings)*
