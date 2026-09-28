/**
 * RecruitFlow — Comprehensive End-to-End API Test Suite
 * Tests all endpoints, authentication, workflows, state machines, and negative cases.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = require('../src/app');
const { pool } = require('../src/config/db');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const DEMO_HR_EMAIL = process.env.DEMO_HR_EMAIL || 'hr@recruitflow.com';
const DEMO_HR_PASSWORD = process.env.DEMO_HR_PASSWORD || 'Admin@123';

let serverInstance = null;
let token = null;

let testJobId = null;
let testClosedJobId = null;
let testCandidateId = null;
let testApplicationId = null;
let testInterviewId = null;
let testOfferId = null;

let passedChecks = 0;
let failedChecks = 0;

function logPass(title, details = '') {
    passedChecks++;
    console.log(`[PASS] ${title}${details ? ` -> ${details}` : ''}`);
}

function logFail(title, error = '') {
    failedChecks++;
    console.error(`[FAIL] ${title}${error ? ` -> ${error}` : ''}`);
}

async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(!options.unauthenticated && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const config = {
        method: options.method || 'GET',
        headers
    };

    if (options.body) {
        config.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, config);
    let json = null;
    try {
        json = await res.json();
    } catch {
        json = null;
    }

    return {
        status: res.status,
        data: json
    };
}

async function runTestSuite() {
    console.log('==================================================');
    console.log('RECRUITFLOW — BACKEND API END-TO-END VERIFICATION');
    console.log('==================================================');

    // 1. Ensure server is running (start in-process if not already up)
    try {
        const ping = await fetch(`${BASE_URL}/api/health`).catch(() => null);
        if (!ping) {
            serverInstance = app.listen(PORT);
            console.log(`Started in-process Express server on port ${PORT}`);
            await new Promise((r) => setTimeout(r, 500));
        } else {
            console.log(`Connected to active server running on port ${PORT}`);
        }
    } catch (err) {
        console.error('Failed to initialize server for testing:', err.message);
        process.exit(1);
    }

    try {
        // Test 1: API Health
        const health = await request('/api/health');
        if (health.status === 200 && health.data?.success === true) {
            logPass('1. GET /api/health', health.data.message);
        } else {
            logFail('1. GET /api/health', JSON.stringify(health.data));
        }

        // Test 2: Database Health
        const dbHealth = await request('/api/health/db');
        if (dbHealth.status === 200 && dbHealth.data?.success === true) {
            logPass('2. GET /api/health/db', `Database '${dbHealth.data.database}' is connected`);
        } else {
            logFail('2. GET /api/health/db', JSON.stringify(dbHealth.data));
        }

        // Test 3: Demo HR Login
        const loginRes = await request('/api/auth/login', {
            method: 'POST',
            body: {
                email: DEMO_HR_EMAIL,
                password: DEMO_HR_PASSWORD
            }
        });
        if (loginRes.status === 200 && loginRes.data?.token) {
            token = loginRes.data.token;
            logPass('3. POST /api/auth/login', `Authenticated as role: ${loginRes.data.user.role}`);
        } else {
            logFail('3. POST /api/auth/login', JSON.stringify(loginRes.data));
        }

        // Test 4: Invalid Login (Negative Test)
        const invalidLogin = await request('/api/auth/login', {
            method: 'POST',
            body: {
                email: DEMO_HR_EMAIL,
                password: 'WrongPassword_999!'
            }
        });
        if (invalidLogin.status === 401 && invalidLogin.data?.success === false) {
            logPass('4. Invalid Login rejected with HTTP 401', invalidLogin.data.message);
        } else {
            logFail('4. Invalid Login rejected', `Expected 401, got ${invalidLogin.status}`);
        }

        // Test 5: Public Get Jobs (Only PUBLISHED jobs visible without auth)
        const publicJobs = await request('/api/jobs', { unauthenticated: true });
        const allPublished = publicJobs.data?.data?.every((j) => j.status === 'PUBLISHED');
        if (publicJobs.status === 200 && allPublished && publicJobs.data.data.length > 0) {
            logPass('5. Public GET /api/jobs (only PUBLISHED visible)', `Count: ${publicJobs.data.data.length}`);
        } else {
            logFail('5. Public GET /api/jobs', JSON.stringify(publicJobs.data));
        }

        // Test 6: Authenticated Get Jobs (HR sees all statuses)
        const authJobs = await request('/api/jobs');
        const hasVarious = authJobs.data?.data?.some((j) => j.status === 'DRAFT' || j.status === 'CLOSED');
        if (authJobs.status === 200 && hasVarious) {
            logPass('6. Authenticated GET /api/jobs (all statuses visible to HR)', `Total: ${authJobs.data.data.length}`);
        } else {
            logFail('6. Authenticated GET /api/jobs', JSON.stringify(authJobs.data));
        }

        // Test 7: Create Draft Job
        const newJob = await request('/api/jobs', {
            method: 'POST',
            body: {
                title: 'Automated Test Software Architect',
                department: 'Engineering',
                description: 'Test job description for end-to-end testing verification.',
                skills: 'Node.js, Express, MySQL',
                experience_required: '5+ years',
                location: 'Remote',
                employment_type: 'Full-time',
                salary_min: 120000,
                salary_max: 160000,
                deadline: '2027-12-31'
            }
        });
        if (newJob.status === 201 && newJob.data?.data?.status === 'DRAFT') {
            testJobId = newJob.data.data.id;
            logPass('7. POST /api/jobs (create DRAFT job)', `Created Job ID: ${testJobId}`);
        } else {
            logFail('7. POST /api/jobs', JSON.stringify(newJob.data));
        }

        // Test 8: Publish Job (DRAFT -> PUBLISHED)
        const publishedJob = await request(`/api/jobs/${testJobId}/publish`, {
            method: 'PATCH'
        });
        if (publishedJob.status === 200 && publishedJob.data?.data?.status === 'PUBLISHED') {
            logPass('8. PATCH /api/jobs/:id/publish', `Job ID ${testJobId} status: PUBLISHED`);
        } else {
            logFail('8. PATCH /api/jobs/:id/publish', JSON.stringify(publishedJob.data));
        }

        // Create a secondary job to test CLOSE behavior
        const jobToClose = await request('/api/jobs', {
            method: 'POST',
            body: {
                title: 'Temporary Test Closed Job',
                department: 'QA',
                description: 'To test closed status application rejection.',
                skills: 'Testing',
                experience_required: '2 years',
                location: 'Remote',
                deadline: '2027-12-31'
            }
        });
        testClosedJobId = jobToClose.data?.data?.id;
        await request(`/api/jobs/${testClosedJobId}/publish`, { method: 'PATCH' });

        // Test 9: Close Job (PUBLISHED -> CLOSED)
        const closedJob = await request(`/api/jobs/${testClosedJobId}/close`, {
            method: 'PATCH'
        });
        if (closedJob.status === 200 && closedJob.data?.data?.status === 'CLOSED') {
            logPass('9. PATCH /api/jobs/:id/close', `Job ID ${testClosedJobId} status: CLOSED`);
        } else {
            logFail('9. PATCH /api/jobs/:id/close', JSON.stringify(closedJob.data));
        }

        // Test 10: Negative Test — Cannot republish a CLOSED job
        const republishClosed = await request(`/api/jobs/${testClosedJobId}/publish`, {
            method: 'PATCH'
        });
        if (republishClosed.status === 400) {
            logPass('10. Block republishing CLOSED job (HTTP 400)', republishClosed.data.message);
        } else {
            logFail('10. Block republishing CLOSED job', `Expected 400, got ${republishClosed.status}`);
        }

        // Test 11: Candidate Application to PUBLISHED job
        const testCandidateEmail = `test.applicant.${Date.now()}@example.com`;
        const applyRes = await request('/api/applications', {
            method: 'POST',
            body: {
                job_id: testJobId,
                name: 'Automated Test Applicant',
                email: testCandidateEmail,
                phone: '+1-555-9988',
                education: 'B.S. in Computer Science',
                skills: 'Node.js, Express, MySQL, JavaScript',
                experience: '5 years',
                resume_url: 'https://example.com/resumes/test_applicant.pdf'
            }
        });
        if (applyRes.status === 201 && applyRes.data?.data?.status === 'APPLIED') {
            testApplicationId = applyRes.data.data.id;
            testCandidateId = applyRes.data.data.candidate_id;
            logPass('11. POST /api/applications (application submitted)', `App ID: ${testApplicationId}, Status: APPLIED`);
        } else {
            logFail('11. POST /api/applications', JSON.stringify(applyRes.data));
        }

        // Test 12: Negative Test — Application to CLOSED job must fail (400)
        const applyToClosed = await request('/api/applications', {
            method: 'POST',
            body: {
                job_id: testClosedJobId,
                name: 'Closed Job Applicant',
                email: `closed.applicant.${Date.now()}@example.com`,
                phone: '+1-555-0000',
                education: 'B.S.',
                skills: 'Testing',
                experience: '1 year'
            }
        });
        if (applyToClosed.status === 400) {
            logPass('12. Block application to CLOSED job (HTTP 400)', applyToClosed.data.message);
        } else {
            logFail('12. Block application to CLOSED job', `Expected 400, got ${applyToClosed.status}`);
        }

        // Test 13: Negative Test — Duplicate application to same job must fail (409)
        const duplicateApply = await request('/api/applications', {
            method: 'POST',
            body: {
                job_id: testJobId,
                name: 'Automated Test Applicant',
                email: testCandidateEmail,
                phone: '+1-555-9988',
                education: 'B.S.',
                skills: 'Node.js',
                experience: '5 years'
            }
        });
        if (duplicateApply.status === 409) {
            logPass('13. Block duplicate application from same candidate (HTTP 409)', duplicateApply.data.message);
        } else {
            logFail('13. Block duplicate application', `Expected 409, got ${duplicateApply.status}`);
        }

        // Test 14: Negative Test — Cannot jump APPLIED -> SHORTLISTED without screening (400)
        const invalidShortlist = await request(`/api/applications/${testApplicationId}/shortlist`, {
            method: 'PATCH'
        });
        if (invalidShortlist.status === 400) {
            logPass('14. Block invalid transition APPLIED -> SHORTLISTED without screening (HTTP 400)', invalidShortlist.data.message);
        } else {
            logFail('14. Block invalid transition APPLIED -> SHORTLISTED', `Expected 400, got ${invalidShortlist.status}`);
        }

        // Test 15: Screen Application (APPLIED -> SCREENING)
        const screenRes = await request(`/api/applications/${testApplicationId}/screen`, {
            method: 'PATCH'
        });
        if (screenRes.status === 200 && screenRes.data?.data?.status === 'SCREENING') {
            logPass('15. PATCH /api/applications/:id/screen', `Status moved to: ${screenRes.data.data.status}`);
        } else {
            logFail('15. PATCH /api/applications/:id/screen', JSON.stringify(screenRes.data));
        }

        // Test 16: Shortlist Application (SCREENING -> SHORTLISTED)
        const shortlistRes = await request(`/api/applications/${testApplicationId}/shortlist`, {
            method: 'PATCH'
        });
        if (shortlistRes.status === 200 && shortlistRes.data?.data?.status === 'SHORTLISTED') {
            logPass('16. PATCH /api/applications/:id/shortlist', `Status moved to: ${shortlistRes.data.data.status}`);
        } else {
            logFail('16. PATCH /api/applications/:id/shortlist', JSON.stringify(shortlistRes.data));
        }

        // Test 17: Schedule Interview (SHORTLISTED -> INTERVIEW_SCHEDULED)
        const scheduleRes = await request('/api/interviews', {
            method: 'POST',
            body: {
                application_id: testApplicationId,
                interviewer_id: 2, // Interviewer David Chen
                scheduled_at: '2026-11-20 14:00:00',
                type: 'System Design Round',
                meeting_link: 'https://meet.recruitflow.com/test-round'
            }
        });
        if (scheduleRes.status === 201 && scheduleRes.data?.data?.id) {
            testInterviewId = scheduleRes.data.data.id;
            const updatedApp = await request(`/api/applications/${testApplicationId}`);
            if (updatedApp.data?.data?.status === 'INTERVIEW_SCHEDULED') {
                logPass('17. POST /api/interviews (interview scheduled)', `Interview ID: ${testInterviewId}, App status: INTERVIEW_SCHEDULED`);
            } else {
                logFail('17. Application status after interview scheduling', updatedApp.data?.data?.status);
            }
        } else {
            logFail('17. POST /api/interviews', JSON.stringify(scheduleRes.data));
        }

        // Test 18: Negative Test — Cannot select candidate while status is INTERVIEW_SCHEDULED (400)
        const earlySelect = await request(`/api/applications/${testApplicationId}/select`, {
            method: 'PATCH'
        });
        if (earlySelect.status === 400) {
            logPass('18. Block early selection before interview completion (HTTP 400)', earlySelect.data.message);
        } else {
            logFail('18. Block early selection', `Expected 400, got ${earlySelect.status}`);
        }

        // Test 19: Evaluate Interview PASS (INTERVIEW_SCHEDULED -> INTERVIEWED)
        const evalRes = await request(`/api/interviews/${testInterviewId}/evaluate`, {
            method: 'PUT',
            body: {
                technical_rating: 9,
                communication_rating: 9,
                problem_solving_rating: 10,
                overall_rating: 9,
                feedback: 'Demonstrated superb architectural depth and algorithmic efficiency.',
                result: 'PASS'
            }
        });
        if (evalRes.status === 200 && evalRes.data?.data?.result === 'PASS') {
            const appAfterEval = await request(`/api/applications/${testApplicationId}`);
            if (appAfterEval.data?.data?.status === 'INTERVIEWED') {
                logPass('19. PUT /api/interviews/:id/evaluate (PASS evaluation)', `Interview result: PASS, App status: INTERVIEWED`);
            } else {
                logFail('19. App status after evaluation', appAfterEval.data?.data?.status);
            }
        } else {
            logFail('19. PUT /api/interviews/:id/evaluate', JSON.stringify(evalRes.data));
        }

        // Test 20: Select Candidate (INTERVIEWED -> SELECTED)
        const selectRes = await request(`/api/applications/${testApplicationId}/select`, {
            method: 'PATCH'
        });
        if (selectRes.status === 200 && selectRes.data?.data?.status === 'SELECTED') {
            logPass('20. PATCH /api/applications/:id/select', `Status moved to: SELECTED`);
        } else {
            logFail('20. PATCH /api/applications/:id/select', JSON.stringify(selectRes.data));
        }

        // Test 21: Issue Offer (SELECTED -> OFFER_SENT)
        const offerRes = await request('/api/offers', {
            method: 'POST',
            body: {
                application_id: testApplicationId,
                salary: 135000,
                offer_date: '2026-10-01',
                joining_date: '2026-11-01',
                expiry_date: '2026-12-01'
            }
        });
        if (offerRes.status === 201 && offerRes.data?.data?.id) {
            testOfferId = offerRes.data.data.id;
            const appAfterOffer = await request(`/api/applications/${testApplicationId}`);
            if (appAfterOffer.data?.data?.status === 'OFFER_SENT') {
                logPass('21. POST /api/offers (offer letter created)', `Offer ID: ${testOfferId}, App status: OFFER_SENT`);
            } else {
                logFail('21. App status after offer', appAfterOffer.data?.data?.status);
            }
        } else {
            logFail('21. POST /api/offers', JSON.stringify(offerRes.data));
        }

        // Test 22: Accept Offer & Verify HIRED (OFFER_SENT -> OFFER_ACCEPTED -> HIRED)
        const acceptRes = await request(`/api/offers/${testOfferId}/accept`, {
            method: 'PATCH'
        });
        if (acceptRes.status === 200 && acceptRes.data?.data?.status === 'ACCEPTED') {
            const finalApp = await request(`/api/applications/${testApplicationId}`);
            if (finalApp.data?.data?.status === 'HIRED') {
                logPass('22. PATCH /api/offers/:id/accept (Candidate HIRED)', `Offer: ACCEPTED, App: HIRED`);
            } else {
                logFail('22. App status after offer acceptance', finalApp.data?.data?.status);
            }
        } else {
            logFail('22. PATCH /api/offers/:id/accept', JSON.stringify(acceptRes.data));
        }

        // Test 23: Dashboard Stats from real MySQL
        const statsRes = await request('/api/dashboard/stats');
        if (statsRes.status === 200 && statsRes.data?.data) {
            const s = statsRes.data.data;
            if (typeof s.totalJobs === 'number' && typeof s.totalApplications === 'number' && s.hired >= 1) {
                logPass('23. GET /api/dashboard/stats (real MySQL counts)', `Total Jobs: ${s.totalJobs}, Apps: ${s.totalApplications}, Hired: ${s.hired}`);
            } else {
                logFail('23. GET /api/dashboard/stats numbers invalid', JSON.stringify(s));
            }
        } else {
            logFail('23. GET /api/dashboard/stats', JSON.stringify(statsRes.data));
        }

        // Test 24: Rejection permanence negative test (Cannot reject or shortlist a HIRED candidate)
        const rejectHired = await request(`/api/applications/${testApplicationId}/reject`, {
            method: 'PATCH'
        });
        if (rejectHired.status === 400) {
            logPass('24. Rejection permanence test (Cannot reject HIRED candidate)', rejectHired.data.message);
        } else {
            logFail('24. Rejection permanence test', `Expected 400, got ${rejectHired.status}`);
        }

    } finally {
        // Safe Cleanup of temporary test records (leaves seeded demo records untouched)
        console.log('Cleaning up temporary test entities...');
        try {
            if (testOfferId) {
                await pool.execute('DELETE FROM offers WHERE id = ?', [testOfferId]);
            }
            if (testInterviewId) {
                await pool.execute('DELETE FROM interviews WHERE id = ?', [testInterviewId]);
            }
            if (testApplicationId) {
                await pool.execute('DELETE FROM applications WHERE id = ?', [testApplicationId]);
            }
            if (testCandidateId) {
                await pool.execute('DELETE FROM candidates WHERE id = ?', [testCandidateId]);
            }
            if (testJobId) {
                await pool.execute('DELETE FROM jobs WHERE id = ?', [testJobId]);
            }
            if (testClosedJobId) {
                await pool.execute('DELETE FROM jobs WHERE id = ?', [testClosedJobId]);
            }
            console.log('Test cleanup complete.');
        } catch (cleanupErr) {
            console.warn('Note on cleanup:', cleanupErr.message);
        }

        // Close server and pool if running in-process
        if (serverInstance) {
            serverInstance.close();
        }
        await pool.end();
    }

    console.log('==================================================');
    console.log(`API TEST RESULTS: ${passedChecks} PASSED, ${failedChecks} FAILED`);
    console.log('==================================================');

    if (failedChecks > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

if (require.main === module) {
    runTestSuite();
}

module.exports = { runTestSuite };
