/**
 * RecruitFlow — Candidate Portal & Tracking API Verification Suite
 * Verifies all 36 Phase 4 requirements:
 * Registration, Login, RBAC, IDOR protection, Application, Screening,
 * Shortlisting, Interview tracking, Evaluation, Selection, Offer acceptance,
 * Rejection, and mutual HR/Candidate state synchronization.
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { pool } = require('../src/config/db');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const DEMO_HR_EMAIL = process.env.DEMO_HR_EMAIL || 'hr@recruitflow.com';
const DEMO_HR_PASSWORD = process.env.DEMO_HR_PASSWORD || 'Admin@123';

let hrToken = null;
let candidateToken = null;
let candidateTwoToken = null;

let candidateUser = null;
let candidateTwoUser = null;

let testJobId = null;
let testClosedJobId = null;
let testJobTwoId = null;
let testAppId = null;
let testInterviewId = null;
let testOfferId = null;

let testAppTwoId = null;
let testAppThreeId = null;
let testOfferThreeId = null;

let passedChecks = 0;
let failedChecks = 0;

function logPass(title, details = '') {
    passedChecks++;
    console.log(`[PASS] ${passedChecks}. ${title}${details ? ` -> ${details}` : ''}`);
}

function logFail(title, error = '') {
    failedChecks++;
    console.error(`[FAIL] ${title}${error ? ` -> ${error}` : ''}`);
}

async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const token = options.token !== undefined ? options.token : null;
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const config = {
        method: options.method || 'GET',
        headers
    };

    if (options.body) {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json().catch(() => null);
        return {
            status: response.status,
            ok: response.ok,
            data
        };
    } catch (err) {
        return {
            status: 500,
            ok: false,
            error: err.message
        };
    }
}

async function runCandidateTests() {
    console.log('==================================================');
    console.log('RECRUITFLOW — CANDIDATE PORTAL & WORKFLOW VERIFICATION');
    console.log('==================================================');

    try {
        // Authenticate HR first
        const hrLoginRes = await request('/api/auth/login', {
            method: 'POST',
            body: { email: DEMO_HR_EMAIL, password: DEMO_HR_PASSWORD }
        });
        if (!hrLoginRes.ok || !hrLoginRes.data?.token) {
            throw new Error(`HR login failed: ${hrLoginRes.data?.message || hrLoginRes.status}`);
        }
        hrToken = hrLoginRes.data.token;

        // Create a published test job and a closed test job for the suite
        const createJobRes = await request('/api/jobs', {
            method: 'POST',
            token: hrToken,
            body: {
                title: `Candidate Test Job ${Date.now()}`,
                department: 'Engineering',
                description: 'Full-stack recruitment workflow testing opening.',
                skills: 'JavaScript, React, Node.js, MySQL',
                experience_required: '2+ years',
                location: 'Remote',
                employment_type: 'Full-time',
                salary_min: 75000,
                salary_max: 95000,
                deadline: '2026-12-31'
            }
        });
        testJobId = createJobRes.data.data.id;
        await request(`/api/jobs/${testJobId}/publish`, { method: 'PATCH', token: hrToken });

        const createClosedJobRes = await request('/api/jobs', {
            method: 'POST',
            token: hrToken,
            body: {
                title: `Closed Candidate Job ${Date.now()}`,
                department: 'Product',
                description: 'Closed position to verify application blocking.',
                skills: 'Product Management',
                experience_required: '5+ years',
                location: 'San Francisco, CA',
                deadline: '2026-12-31'
            }
        });
        testClosedJobId = createClosedJobRes.data.data.id;
        await request(`/api/jobs/${testClosedJobId}/publish`, { method: 'PATCH', token: hrToken });
        await request(`/api/jobs/${testClosedJobId}/close`, { method: 'PATCH', token: hrToken });

        const testCandidateEmail = `candidate_test_${Date.now()}@example.com`;
        const testCandidateTwoEmail = `candidate_two_${Date.now()}@example.com`;
        const testPassword = 'Password@123';

        // 1. Candidate signup success
        const signupRes = await request('/api/auth/candidate/signup', {
            method: 'POST',
            body: {
                name: 'Alex Mercer',
                email: testCandidateEmail,
                password: testPassword,
                phone: '+1 555-0199',
                education: 'B.S. in Computer Science',
                skills: 'React, Node.js, Express, MySQL',
                experience: '3 years Software Development'
            }
        });
        if (signupRes.status === 201 && signupRes.data?.token && signupRes.data?.user?.role === 'CANDIDATE') {
            candidateToken = signupRes.data.token;
            candidateUser = signupRes.data.user;
            logPass('Candidate signup success', `User ID: ${candidateUser.id}`);
        } else {
            logFail('Candidate signup success', signupRes.data?.message);
        }

        // 2. Duplicate candidate signup blocked
        const dupSignupRes = await request('/api/auth/candidate/signup', {
            method: 'POST',
            body: {
                name: 'Alex Duplicate',
                email: testCandidateEmail,
                password: testPassword
            }
        });
        if (dupSignupRes.status === 409) {
            logPass('Duplicate candidate signup blocked', 'HTTP 409 Conflict returned');
        } else {
            logFail('Duplicate candidate signup blocked', `Expected 409, got ${dupSignupRes.status}`);
        }

        // 3. Candidate login success
        const loginRes = await request('/api/auth/candidate/login', {
            method: 'POST',
            body: {
                email: testCandidateEmail,
                password: testPassword
            }
        });
        if (loginRes.status === 200 && loginRes.data?.token) {
            candidateToken = loginRes.data.token;
            logPass('Candidate login success', 'JWT token received');
        } else {
            logFail('Candidate login success', loginRes.data?.message);
        }

        // 4. Invalid candidate login blocked
        const badLoginRes = await request('/api/auth/candidate/login', {
            method: 'POST',
            body: {
                email: testCandidateEmail,
                password: 'WrongPassword999!'
            }
        });
        if (badLoginRes.status === 401) {
            logPass('Invalid candidate login blocked', 'HTTP 401 Unauthorized returned');
        } else {
            logFail('Invalid candidate login blocked', `Expected 401, got ${badLoginRes.status}`);
        }

        // 5. Candidate gets CANDIDATE role
        const meRes = await request('/api/candidate/me', { token: candidateToken });
        if (meRes.status === 200 && meRes.data?.data?.user?.role === 'CANDIDATE') {
            logPass('Candidate gets CANDIDATE role', `Role: ${meRes.data.data.user.role}`);
        } else {
            logFail('Candidate gets CANDIDATE role', meRes.data?.message);
        }

        // 6. Candidate profile loads
        if (meRes.status === 200 && meRes.data?.data?.candidate?.skills?.includes('React')) {
            logPass('Candidate profile loads', `Candidate name: ${meRes.data.data.candidate.name}`);
        } else {
            logFail('Candidate profile loads', 'Candidate profile data missing or mismatched');
        }

        // Create Candidate Two for IDOR testing
        const candTwoSignup = await request('/api/auth/candidate/signup', {
            method: 'POST',
            body: {
                name: 'Samantha Lee',
                email: testCandidateTwoEmail,
                password: testPassword,
                phone: '+1 555-0288'
            }
        });
        if (!candTwoSignup.ok) {
            console.error('Candidate two signup failed:', candTwoSignup);
        }
        candidateTwoToken = candTwoSignup.data?.token;
        candidateTwoUser = candTwoSignup.data?.user;


        // 7. Candidate sees only own applications (initially empty)
        const appsRes = await request('/api/candidate/applications', { token: candidateToken });
        if (appsRes.status === 200 && Array.isArray(appsRes.data?.data) && appsRes.data.data.length === 0) {
            logPass('Candidate sees only own applications', 'Initial application list empty');
        } else {
            logFail('Candidate sees only own applications', 'Expected empty array');
        }

        // 8. Candidate cannot see another candidate's application (IDOR blocked)
        // First candidate applies to test job
        const appRes = await request('/api/candidate/apply', {
            method: 'POST',
            token: candidateToken,
            body: { job_id: testJobId }
        });
        testAppId = appRes.data?.data?.id;

        // Second candidate attempts to view first candidate's application
        const idorRes = await request(`/api/candidate/applications/${testAppId}`, { token: candidateTwoToken });
        if (idorRes.status === 403) {
            logPass("Candidate cannot see another candidate's application", 'HTTP 403 Forbidden verified (IDOR protected)');
        } else {
            logFail("Candidate cannot see another candidate's application", `Expected 403, got ${idorRes.status}`);
        }

        // 9. Candidate can apply to published job
        if (appRes.status === 201 && testAppId) {
            logPass('Candidate can apply to published job', `Application ID: ${testAppId}`);
        } else {
            logFail('Candidate can apply to published job', appRes.data?.message);
        }

        // 10. Candidate cannot apply to closed job
        const closedAppRes = await request('/api/candidate/apply', {
            method: 'POST',
            token: candidateToken,
            body: { job_id: testClosedJobId }
        });
        if (closedAppRes.status === 400) {
            logPass('Candidate cannot apply to closed job', 'HTTP 400 Bad Request returned');
        } else {
            logFail('Candidate cannot apply to closed job', `Expected 400, got ${closedAppRes.status}`);
        }

        // 11. Duplicate application blocked
        const dupAppRes = await request('/api/candidate/apply', {
            method: 'POST',
            token: candidateToken,
            body: { job_id: testJobId }
        });
        if (dupAppRes.status === 409) {
            logPass('Duplicate application blocked', 'HTTP 409 Conflict returned');
        } else {
            logFail('Duplicate application blocked', `Expected 409, got ${dupAppRes.status}`);
        }

        // 12. New application begins APPLIED
        const detailsRes = await request(`/api/candidate/applications/${testAppId}`, { token: candidateToken });
        if (detailsRes.status === 200 && detailsRes.data?.data?.application?.status === 'APPLIED') {
            logPass('New application begins APPLIED', 'Status confirmed: APPLIED');
        } else {
            logFail('New application begins APPLIED', detailsRes.data?.message);
        }

        // 13. HR can move application to SCREENING
        const screenRes = await request(`/api/applications/${testAppId}/screen`, {
            method: 'PATCH',
            token: hrToken
        });
        if (screenRes.status === 200 && screenRes.data?.data?.status === 'SCREENING') {
            logPass('HR can move application to SCREENING', 'HR updated status');
        } else {
            logFail('HR can move application to SCREENING', screenRes.data?.message);
        }

        // 14. Candidate sees SCREENING
        const candScreenRes = await request(`/api/candidate/applications/${testAppId}`, { token: candidateToken });
        if (candScreenRes.status === 200 && candScreenRes.data?.data?.application?.status === 'SCREENING') {
            logPass('Candidate sees SCREENING', 'Reflected on candidate portal');
        } else {
            logFail('Candidate sees SCREENING', candScreenRes.data?.message);
        }

        // 15. HR can shortlist
        const shortlistRes = await request(`/api/applications/${testAppId}/shortlist`, {
            method: 'PATCH',
            token: hrToken
        });
        if (shortlistRes.status === 200 && shortlistRes.data?.data?.status === 'SHORTLISTED') {
            logPass('HR can shortlist', 'Application status: SHORTLISTED');
        } else {
            logFail('HR can shortlist', shortlistRes.data?.message);
        }

        // 16. Candidate sees SHORTLISTED
        const candShortlistRes = await request(`/api/candidate/applications/${testAppId}`, { token: candidateToken });
        if (candShortlistRes.status === 200 && candShortlistRes.data?.data?.application?.status === 'SHORTLISTED') {
            logPass('Candidate sees SHORTLISTED', 'Reflected on candidate portal');
        } else {
            logFail('Candidate sees SHORTLISTED', candShortlistRes.data?.message);
        }

        // 17. HR schedules interview
        const scheduleRes = await request('/api/interviews', {
            method: 'POST',
            token: hrToken,
            body: {
                application_id: testAppId,
                interviewer_id: 2, // Technical Interviewer demo user
                scheduled_at: '2026-11-20 14:00:00',
                type: 'TECHNICAL',
                meeting_link: 'https://meet.google.com/test-recruitment'
            }
        });

        if (scheduleRes.status === 201) {
            testInterviewId = scheduleRes.data?.data?.id;
            logPass('HR schedules interview', `Interview ID: ${testInterviewId}`);
        } else {
            logFail('HR schedules interview', scheduleRes.data?.message);
        }

        // 18. Candidate sees INTERVIEW_SCHEDULED
        const candIvSchedRes = await request(`/api/candidate/applications/${testAppId}`, { token: candidateToken });
        if (candIvSchedRes.status === 200 && candIvSchedRes.data?.data?.application?.status === 'INTERVIEW_SCHEDULED') {
            logPass('Candidate sees INTERVIEW_SCHEDULED', 'Reflected on candidate portal');
        } else {
            logFail('Candidate sees INTERVIEW_SCHEDULED', candIvSchedRes.data?.message);
        }

        // 19. Candidate sees actual interview details
        const interviewsList = candIvSchedRes.data?.data?.interviews || [];
        if (interviewsList.length > 0 && interviewsList[0].meeting_link === 'https://meet.google.com/test-recruitment') {
            logPass('Candidate sees actual interview details', `Meeting: ${interviewsList[0].meeting_link}`);
        } else {
            logFail('Candidate sees actual interview details', 'Interview details not matching or missing');
        }

        // 20. HR evaluates interview
        const evalRes = await request(`/api/interviews/${testInterviewId}/evaluate`, {
            method: 'PUT',
            token: hrToken,
            body: {
                technical_rating: 5,
                communication_rating: 4,
                problem_solving_rating: 5,
                overall_rating: 5,
                feedback: 'Outstanding architecture and problem-solving skills.',
                result: 'PASS'
            }
        });
        if (evalRes.status === 200 && evalRes.data?.data?.result === 'PASS') {
            logPass('HR evaluates interview', 'Result: PASS, Application: INTERVIEWED');
        } else {
            logFail('HR evaluates interview', evalRes.data?.message);
        }

        // 21. Candidate sees INTERVIEWED/result
        const candIvRes = await request(`/api/candidate/applications/${testAppId}`, { token: candidateToken });
        if (candIvRes.status === 200 && candIvRes.data?.data?.application?.status === 'INTERVIEWED' &&
            candIvRes.data?.data?.interviews[0]?.result === 'PASS') {
            logPass('Candidate sees INTERVIEWED/result', 'Result: PASS visible to candidate');
        } else {
            logFail('Candidate sees INTERVIEWED/result', candIvRes.data?.message);
        }

        // 22. HR selects candidate
        const selectRes = await request(`/api/applications/${testAppId}/select`, {
            method: 'PATCH',
            token: hrToken
        });
        if (selectRes.status === 200 && selectRes.data?.data?.status === 'SELECTED') {
            logPass('HR selects candidate', 'Application status: SELECTED');
        } else {
            logFail('HR selects candidate', selectRes.data?.message);
        }

        // 23. Candidate sees SELECTED
        const candSelectRes = await request(`/api/candidate/applications/${testAppId}`, { token: candidateToken });
        if (candSelectRes.status === 200 && candSelectRes.data?.data?.application?.status === 'SELECTED') {
            logPass('Candidate sees SELECTED', 'Reflected on candidate portal');
        } else {
            logFail('Candidate sees SELECTED', candSelectRes.data?.message);
        }

        // 24. HR generates offer
        const offerRes = await request('/api/offers', {
            method: 'POST',
            token: hrToken,
            body: {
                application_id: testAppId,
                salary: 92000,
                offer_date: new Date().toISOString().split('T')[0],
                joining_date: '2026-11-01',
                expiry_date: '2026-12-01'
            }
        });
        if (offerRes.status === 201 && offerRes.data?.data?.status === 'SENT') {
            testOfferId = offerRes.data.data.id;
            logPass('HR generates offer', `Offer ID: ${testOfferId}, Salary: $92,000`);
        } else {
            logFail('HR generates offer', offerRes.data?.message);
        }

        // 25. Candidate sees OFFER_SENT
        const candOfferRes = await request(`/api/candidate/applications/${testAppId}`, { token: candidateToken });
        if (candOfferRes.status === 200 && candOfferRes.data?.data?.application?.status === 'OFFER_SENT' &&
            candOfferRes.data?.data?.offer?.status === 'SENT') {
            logPass('Candidate sees OFFER_SENT', `Offer Status: ${candOfferRes.data.data.offer.status}`);
        } else {
            logFail('Candidate sees OFFER_SENT', candOfferRes.data?.message);
        }

        // 26. Candidate cannot accept another candidate's offer (IDOR on offer acceptance)
        const foreignAcceptRes = await request(`/api/candidate/applications/${testAppId}/accept-offer`, {
            method: 'POST',
            token: candidateTwoToken
        });
        if (foreignAcceptRes.status === 403) {
            logPass("Candidate cannot accept another candidate's offer", 'HTTP 403 Forbidden verified');
        } else {
            logFail("Candidate cannot accept another candidate's offer", `Expected 403, got ${foreignAcceptRes.status}`);
        }

        // 27. Expired offer cannot be accepted
        // Create an expired offer application to test validation
        const candTwoAppRes = await request('/api/candidate/apply', {
            method: 'POST',
            token: candidateTwoToken,
            body: { job_id: testJobId }
        });
        testAppTwoId = candTwoAppRes.data?.data?.id;
        await request(`/api/applications/${testAppTwoId}/screen`, { method: 'PATCH', token: hrToken });
        await request(`/api/applications/${testAppTwoId}/shortlist`, { method: 'PATCH', token: hrToken });
        const candTwoIv = await request('/api/interviews', {
            method: 'POST',
            token: hrToken,
            body: {
                application_id: testAppTwoId,
                interviewer_id: 2,
                scheduled_at: '2026-11-21 10:00:00',
                type: 'BEHAVIORAL'
            }
        });

        await request(`/api/interviews/${candTwoIv.data.data.id}/evaluate`, {
            method: 'PUT',
            token: hrToken,
            body: { overall_rating: 4, result: 'PASS' }
        });
        await request(`/api/applications/${testAppTwoId}/select`, { method: 'PATCH', token: hrToken });
        // Create offer with expired date
        await pool.execute(
            `INSERT INTO offers (application_id, salary, offer_date, joining_date, expiry_date, status)
             VALUES (?, 80000, '2020-01-01', '2020-02-01', '2020-01-15', 'SENT')`,
            [testAppTwoId]
        );
        await pool.execute(`UPDATE applications SET status = 'OFFER_SENT' WHERE id = ?`, [testAppTwoId]);

        const expiredAcceptRes = await request(`/api/candidate/applications/${testAppTwoId}/accept-offer`, {
            method: 'POST',
            token: candidateTwoToken
        });
        if (expiredAcceptRes.status === 400 && expiredAcceptRes.data?.message?.toLowerCase().includes('expired')) {
            logPass('Expired offer cannot be accepted', 'HTTP 400 expired offer rejection verified');
        } else {
            logFail('Expired offer cannot be accepted', expiredAcceptRes.data?.message);
        }

        // 28. Candidate can accept own valid SENT offer
        const acceptRes = await request(`/api/candidate/applications/${testAppId}/accept-offer`, {
            method: 'POST',
            token: candidateToken
        });
        if (acceptRes.status === 200 && acceptRes.data?.data?.offer?.status === 'ACCEPTED') {
            logPass('Candidate can accept own valid SENT offer', 'Offer successfully accepted');
        } else {
            logFail('Candidate can accept own valid SENT offer', acceptRes.data?.message);
        }

        // 29. Already accepted offer cannot be accepted again
        const reAcceptRes = await request(`/api/candidate/applications/${testAppId}/accept-offer`, {
            method: 'POST',
            token: candidateToken
        });
        if (reAcceptRes.status === 400) {
            logPass('Already accepted offer cannot be accepted again', 'HTTP 400 re-acceptance blocked');
        } else {
            logFail('Already accepted offer cannot be accepted again', `Expected 400, got ${reAcceptRes.status}`);
        }

        // 30. Candidate cannot access HR operations (RBAC enforced)
        const hrOpRes = await request('/api/applications', { token: candidateToken });
        if (hrOpRes.status === 403) {
            logPass('Candidate cannot access HR operations', 'HTTP 403 Forbidden verified for /api/applications');
        } else {
            logFail('Candidate cannot access HR operations', `Expected 403, got ${hrOpRes.status}`);
        }

        // 31. Successful acceptance changes offer to ACCEPTED
        const candVerifyOffer = await request(`/api/candidate/applications/${testAppId}`, { token: candidateToken });
        if (candVerifyOffer.data?.data?.offer?.status === 'ACCEPTED') {
            logPass('Successful acceptance changes offer to ACCEPTED', 'Offer: ACCEPTED');
        } else {
            logFail('Successful acceptance changes offer to ACCEPTED', `Offer status is ${candVerifyOffer.data?.data?.offer?.status}`);
        }

        // 32. Successful acceptance changes application to OFFER_ACCEPTED (hiring is a separate HR step)
        if (candVerifyOffer.data?.data?.application?.status === 'OFFER_ACCEPTED') {
            logPass('Successful acceptance changes application to OFFER_ACCEPTED', 'Application: OFFER_ACCEPTED');
        } else {
            logFail('Successful acceptance changes application to OFFER_ACCEPTED', `App status is ${candVerifyOffer.data?.data?.application?.status}`);
        }

        // 32b. Candidate cannot perform the HR hiring step
        const candHireRes = await request(`/api/applications/${testAppId}/hire`, { method: 'PATCH', token: candidateToken });
        if (candHireRes.status === 403) {
            logPass('Candidate cannot mark themselves HIRED', 'HTTP 403 Forbidden verified');
        } else {
            logFail('Candidate cannot mark themselves HIRED', `Expected 403, got ${candHireRes.status}`);
        }

        // 32c. HR completes hiring
        const hrHireRes = await request(`/api/applications/${testAppId}/hire`, { method: 'PATCH', token: hrToken });
        if (hrHireRes.status === 200 && hrHireRes.data?.data?.status === 'HIRED') {
            logPass('HR completes hiring after acceptance', 'Application: HIRED');
        } else {
            logFail('HR completes hiring after acceptance', hrHireRes.data?.message);
        }

        // 33. HR sees ACCEPTED
        const hrOfferRes = await request(`/api/offers/${testOfferId}`, { token: hrToken });
        if (hrOfferRes.data?.data?.status === 'ACCEPTED') {
            logPass('HR sees ACCEPTED', 'Offer status reflected in HR view');
        } else {
            logFail('HR sees ACCEPTED', `HR view status: ${hrOfferRes.data?.data?.status}`);
        }

        // 34. HR sees HIRED
        const hrAppRes = await request(`/api/applications/${testAppId}`, { token: hrToken });
        if (hrAppRes.data?.data?.status === 'HIRED') {
            logPass('HR sees HIRED', 'Application status reflected in HR view');
        } else {
            logFail('HR sees HIRED', `HR view status: ${hrAppRes.data?.data?.status}`);
        }

        // 35. Candidate sees HIRED
        const candDashRes = await request('/api/candidate/dashboard', { token: candidateToken });
        if (candDashRes.data?.data?.hired >= 1) {
            logPass('Candidate sees HIRED', `Hired count in dashboard: ${candDashRes.data.data.hired}`);
        } else {
            logFail('Candidate sees HIRED', 'Dashboard hired count not updated');
        }

        // 36. Candidate cannot decline another candidate's offer (IDOR protection on reject-offer)
        const foreignRejectRes = await request(`/api/candidate/applications/${testAppId}/reject-offer`, {
            method: 'POST',
            token: candidateTwoToken
        });
        if (foreignRejectRes.status === 403) {
            logPass("Candidate cannot decline another candidate's offer", 'HTTP 403 Forbidden verified');
        } else {
            logFail("Candidate cannot decline another candidate's offer", `Expected 403, got ${foreignRejectRes.status}`);
        }

        // 37. Accepted offer cannot be declined
        const acceptedDeclineRes = await request(`/api/candidate/applications/${testAppId}/reject-offer`, {
            method: 'POST',
            token: candidateToken
        });
        if (acceptedDeclineRes.status === 400) {
            logPass('Accepted offer cannot be declined', 'HTTP 400 decline blocked for ACCEPTED offer');
        } else {
            logFail('Accepted offer cannot be declined', `Expected 400, got ${acceptedDeclineRes.status}`);
        }

        // 38. Create full pipeline for candidate declines own offer
        const [jobTwoResult] = await pool.execute(
            `INSERT INTO jobs (title, department, description, skills, experience_required, location, employment_type, deadline, status, created_by)
             VALUES ('Staff QA Engineer', 'Engineering', 'Test requisition', 'Testing, Automation', '5 years', 'Remote', 'Full-time', '2027-01-01', 'PUBLISHED', 1)`
        );
        testJobTwoId = jobTwoResult.insertId;

        const candTwoAppThreeRes = await request('/api/candidate/apply', {
            method: 'POST',
            token: candidateTwoToken,
            body: { job_id: testJobTwoId }
        });
        testAppThreeId = candTwoAppThreeRes.data?.data?.id;

        await request(`/api/applications/${testAppThreeId}/screen`, { method: 'PATCH', token: hrToken });
        await request(`/api/applications/${testAppThreeId}/shortlist`, { method: 'PATCH', token: hrToken });
        const candTwoIvThree = await request('/api/interviews', {
            method: 'POST',
            token: hrToken,
            body: {
                application_id: testAppThreeId,
                interviewer_id: 2,
                scheduled_at: '2026-12-01 10:00:00',
                type: 'TECHNICAL'
            }
        });
        await request(`/api/interviews/${candTwoIvThree.data.data.id}/evaluate`, {
            method: 'PUT',
            token: hrToken,
            body: { overall_rating: 9, result: 'PASS' }
        });
        await request(`/api/applications/${testAppThreeId}/select`, { method: 'PATCH', token: hrToken });

        const candTwoOfferRes = await request('/api/offers', {
            method: 'POST',
            token: hrToken,
            body: {
                application_id: testAppThreeId,
                salary: 95000,
                offer_date: new Date().toISOString().split('T')[0],
                joining_date: '2027-01-15',
                expiry_date: '2027-02-15'
            }
        });
        testOfferThreeId = candTwoOfferRes.data?.data?.id;

        // Candidate declines own offer
        const declineRes = await request(`/api/candidate/applications/${testAppThreeId}/reject-offer`, {
            method: 'POST',
            token: candidateTwoToken
        });
        if (declineRes.status === 200 && declineRes.data?.data?.offer?.status === 'REJECTED' && declineRes.data?.data?.application?.status === 'REJECTED') {
            logPass('Candidate declines own offer', 'Offer and application marked as REJECTED');
        } else {
            logFail('Candidate declines own offer', declineRes.data?.message);
        }

        // 39. Declined offer cannot be accepted
        const declinedAcceptRes = await request(`/api/candidate/applications/${testAppThreeId}/accept-offer`, {
            method: 'POST',
            token: candidateTwoToken
        });
        if (declinedAcceptRes.status === 400) {
            logPass('Declined offer cannot be accepted', 'HTTP 400 accept blocked for declined offer');
        } else {
            logFail('Declined offer cannot be accepted', `Expected 400, got ${declinedAcceptRes.status}`);
        }

        // 40. Declined offer cannot be declined again
        const reDeclineRes = await request(`/api/candidate/applications/${testAppThreeId}/reject-offer`, {
            method: 'POST',
            token: candidateTwoToken
        });
        if (reDeclineRes.status === 400) {
            logPass('Declined offer cannot be declined again', 'HTTP 400 re-decline blocked');
        } else {
            logFail('Declined offer cannot be declined again', `Expected 400, got ${reDeclineRes.status}`);
        }

        // 41. HR sees DECLINED / REJECTED state
        const hrOfferThreeRes = await request(`/api/offers/${testOfferThreeId}`, { token: hrToken });
        const hrAppThreeRes = await request(`/api/applications/${testAppThreeId}`, { token: hrToken });
        if (hrOfferThreeRes.data?.data?.status === 'REJECTED' && hrAppThreeRes.data?.data?.status === 'REJECTED') {
            logPass('HR sees DECLINED/rejected state after candidate decline', 'Offer: REJECTED, App: REJECTED');
        } else {
            logFail('HR sees DECLINED/rejected state after candidate decline', `Offer: ${hrOfferThreeRes.data?.data?.status}, App: ${hrAppThreeRes.data?.data?.status}`);
        }

        // 42. Selection before interview PASS remains blocked
        const [failJobResult] = await pool.execute(
            `INSERT INTO jobs (title, department, description, skills, experience_required, location, employment_type, deadline, status, created_by)
             VALUES ('Junior Analyst', 'Analytics', 'Test description', 'Excel, SQL', '1 year', 'Remote', 'Full-time', '2027-01-01', 'PUBLISHED', 1)`
        );
        const failJobId = failJobResult.insertId;
        const failAppRes = await request('/api/candidate/apply', {
            method: 'POST',
            token: candidateToken,
            body: { job_id: failJobId }
        });
        const failAppId = failAppRes.data?.data?.id;
        await request(`/api/applications/${failAppId}/screen`, { method: 'PATCH', token: hrToken });
        await request(`/api/applications/${failAppId}/shortlist`, { method: 'PATCH', token: hrToken });
        const failIv = await request('/api/interviews', {
            method: 'POST',
            token: hrToken,
            body: {
                application_id: failAppId,
                interviewer_id: 2,
                scheduled_at: '2026-12-05 10:00:00',
                type: 'TECHNICAL'
            }
        });
        await request(`/api/interviews/${failIv.data.data.id}/evaluate`, {
            method: 'PUT',
            token: hrToken,
            body: { overall_rating: 2, result: 'FAIL' }
        });
        const failSelectRes = await request(`/api/applications/${failAppId}/select`, { method: 'PATCH', token: hrToken });
        if (failSelectRes.status === 400) {
            logPass('Selection before interview PASS remains blocked', 'HTTP 400 selection blocked for interview FAIL');
        } else {
            logFail('Selection before interview PASS remains blocked', `Expected 400, got ${failSelectRes.status}`);
        }

        // Clean up failJobId and failAppId
        await pool.execute('DELETE FROM interviews WHERE application_id = ?', [failAppId]);
        await pool.execute('DELETE FROM applications WHERE id = ?', [failAppId]);
        await pool.execute('DELETE FROM jobs WHERE id = ?', [failJobId]);

        // 43. Rejected applications cannot continue
        const contRes = await request(`/api/applications/${testAppThreeId}/screen`, { method: 'PATCH', token: hrToken });
        if (contRes.status === 400) {
            logPass('Rejected applications cannot continue', 'HTTP 400 pipeline progression blocked for REJECTED application');
        } else {
            logFail('Rejected applications cannot continue', `Expected 400, got ${contRes.status}`);
        }

        // 44. Existing rejection flow still works
        let rejectAppId = testAppTwoId;
        const rejectRes = await request(`/api/applications/${rejectAppId}/reject`, {
            method: 'PATCH',
            token: hrToken
        });
        if (rejectRes.status === 200 && rejectRes.data?.data?.status === 'REJECTED') {
            logPass('Existing rejection flow still works', 'Status moved to REJECTED');
        } else {
            logFail('Existing rejection flow still works', rejectRes.data?.message);
        }

    } catch (err) {
        console.error('Test suite error:', err);
    } finally {
        // Cleanup test entries created during this test
        try {
            console.log('Cleaning up temporary candidate test records...');
            if (testOfferId) await pool.execute('DELETE FROM offers WHERE id = ?', [testOfferId]);
            if (testOfferThreeId) await pool.execute('DELETE FROM offers WHERE id = ?', [testOfferThreeId]);
            if (testAppId) {
                await pool.execute('DELETE FROM interviews WHERE application_id = ?', [testAppId]);
                await pool.execute('DELETE FROM offers WHERE application_id = ?', [testAppId]);
                await pool.execute('DELETE FROM applications WHERE id = ?', [testAppId]);
            }
            if (testAppTwoId) {
                await pool.execute('DELETE FROM interviews WHERE application_id = ?', [testAppTwoId]);
                await pool.execute('DELETE FROM offers WHERE application_id = ?', [testAppTwoId]);
                await pool.execute('DELETE FROM applications WHERE id = ?', [testAppTwoId]);
            }
            if (testAppThreeId) {
                await pool.execute('DELETE FROM interviews WHERE application_id = ?', [testAppThreeId]);
                await pool.execute('DELETE FROM offers WHERE application_id = ?', [testAppThreeId]);
                await pool.execute('DELETE FROM applications WHERE id = ?', [testAppThreeId]);
            }
            if (testJobId) await pool.execute('DELETE FROM jobs WHERE id = ?', [testJobId]);
            if (testJobTwoId) await pool.execute('DELETE FROM jobs WHERE id = ?', [testJobTwoId]);
            if (testClosedJobId) await pool.execute('DELETE FROM jobs WHERE id = ?', [testClosedJobId]);
            if (candidateUser?.id) {
                await pool.execute('DELETE FROM candidates WHERE user_id = ?', [candidateUser.id]);
                await pool.execute('DELETE FROM users WHERE id = ?', [candidateUser.id]);
            }
            if (candidateTwoUser?.id) {
                await pool.execute('DELETE FROM candidates WHERE user_id = ?', [candidateTwoUser.id]);
                await pool.execute('DELETE FROM users WHERE id = ?', [candidateTwoUser.id]);
            }
            console.log('Temporary candidate test cleanup complete.');
        } catch (cleanupErr) {
            console.warn('Cleanup warning:', cleanupErr.message);
        }
    }

    console.log('==================================================');
    console.log(`CANDIDATE API TEST RESULTS: ${passedChecks} PASSED, ${failedChecks} FAILED`);
    console.log('==================================================');

    if (failedChecks > 0) {
        process.exit(1);
    }
}

runCandidateTests().then(() => {
    process.exit(failedChecks > 0 ? 1 : 0);
});
