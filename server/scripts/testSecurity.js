/**
 * RecruitFlow — Security, Authorization & Negative-Path Test Suite
 * Covers role separation, object-level authorization (IDOR), input validation,
 * concurrent duplicate requests, transaction rollback, offer expiry, and the
 * OFFER_ACCEPTED -> HIRED hiring step. All records created here are removed at the end.
 *
 * Usage: node scripts/testSecurity.js   (starts an in-process server if none is running)
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const recruitmentService = require('../src/services/recruitmentService');
const { todayDateOnly } = require('../src/utils/dates');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DEMO_HR_EMAIL = process.env.DEMO_HR_EMAIL || 'hr@recruitflow.com';
const DEMO_HR_PASSWORD = process.env.DEMO_HR_PASSWORD || 'Admin@123';

let serverInstance = null;
let passed = 0;
let failed = 0;

const created = { jobs: [], users: [], emails: [] };

function check(title, condition, detail = '') {
    if (condition) {
        passed++;
        console.log(`[PASS] ${passed + failed}. ${title}${detail ? ` -> ${detail}` : ''}`);
    } else {
        failed++;
        console.error(`[FAIL] ${passed + failed}. ${title}${detail ? ` -> ${detail}` : ''}`);
    }
}

async function request(endpoint, { method = 'GET', token, body, rawBody } = {}) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: rawBody !== undefined ? rawBody : body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try {
        data = await res.json();
    } catch {
        data = null;
    }
    return { status: res.status, data };
}

function futureDateTime(daysAhead, hour = 10) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00`;
}

function futureDate(daysAhead) {
    return futureDateTime(daysAhead).slice(0, 10);
}

async function createPublishedJob(hrToken, title) {
    const res = await request('/api/jobs', {
        method: 'POST',
        token: hrToken,
        body: {
            title,
            department: 'QA',
            description: 'Security suite test job.',
            skills: 'Testing, Node.js',
            experience_required: '2 years',
            location: 'Remote',
            deadline: futureDate(60)
        }
    });
    const id = res.data?.data?.id;
    if (id) created.jobs.push(id);
    await request(`/api/jobs/${id}/publish`, { method: 'PATCH', token: hrToken });
    return id;
}

async function signupCandidate(label) {
    const email = `sec.${label}.${Date.now()}@example.com`;
    created.emails.push(email);
    const res = await request('/api/auth/candidate/signup', {
        method: 'POST',
        body: { name: `Security ${label}`, email, password: 'Secure@123', skills: 'Node.js, Testing', experience: '3 years' }
    });
    if (res.data?.user?.id) created.users.push(res.data.user.id);
    return { token: res.data?.token, user: res.data?.user, email };
}

/**
 * Drives an application from APPLIED to OFFER_SENT through the real API.
 */
async function pipelineToOffer(hrToken, applicationId, offerOverrides = {}) {
    await request(`/api/applications/${applicationId}/screen`, { method: 'PATCH', token: hrToken });
    await request(`/api/applications/${applicationId}/shortlist`, { method: 'PATCH', token: hrToken });
    const iv = await request('/api/interviews', {
        method: 'POST',
        token: hrToken,
        body: { application_id: applicationId, interviewer_id: 2, scheduled_at: futureDateTime(5), type: 'Technical' }
    });
    await request(`/api/interviews/${iv.data?.data?.id}/evaluate`, {
        method: 'PUT',
        token: hrToken,
        body: { overall_rating: 8, result: 'PASS', feedback: 'Good.' }
    });
    await request(`/api/applications/${applicationId}/select`, { method: 'PATCH', token: hrToken });
    return request('/api/offers', {
        method: 'POST',
        token: hrToken,
        body: {
            application_id: applicationId,
            salary: 90000,
            offer_date: todayDateOnly(),
            joining_date: futureDate(30),
            expiry_date: futureDate(14),
            ...offerOverrides
        }
    });
}

async function cleanup() {
    console.log('Cleaning up security test records...');
    try {
        const emails = created.emails;
        if (emails.length > 0) {
            const [cands] = await pool.query('SELECT id FROM candidates WHERE email IN (?)', [emails]);
            const candIds = cands.map((c) => c.id);
            if (candIds.length > 0) {
                const [apps] = await pool.query('SELECT id FROM applications WHERE candidate_id IN (?)', [candIds]);
                const appIds = apps.map((a) => a.id);
                if (appIds.length > 0) {
                    await pool.query('DELETE FROM offers WHERE application_id IN (?)', [appIds]);
                    await pool.query('DELETE FROM interviews WHERE application_id IN (?)', [appIds]);
                    await pool.query('DELETE FROM applications WHERE id IN (?)', [appIds]);
                }
                await pool.query('DELETE FROM candidates WHERE id IN (?)', [candIds]);
            }
        }
        if (created.jobs.length > 0) {
            // Remove any remaining applications on test jobs (e.g. from other candidates created here)
            const [apps] = await pool.query('SELECT id FROM applications WHERE job_id IN (?)', [created.jobs]);
            const appIds = apps.map((a) => a.id);
            if (appIds.length > 0) {
                await pool.query('DELETE FROM offers WHERE application_id IN (?)', [appIds]);
                await pool.query('DELETE FROM interviews WHERE application_id IN (?)', [appIds]);
                await pool.query('DELETE FROM applications WHERE id IN (?)', [appIds]);
            }
            await pool.query('DELETE FROM jobs WHERE id IN (?)', [created.jobs]);
        }
        if (created.users.length > 0) {
            await pool.query('DELETE FROM interviews WHERE interviewer_id IN (?)', [created.users]);
            await pool.query('DELETE FROM users WHERE id IN (?)', [created.users]);
        }
        console.log('Security test cleanup complete.');
    } catch (err) {
        console.warn('Cleanup warning:', err.message);
    }
}

async function run() {
    console.log('==================================================');
    console.log('RECRUITFLOW — SECURITY & NEGATIVE-PATH VERIFICATION');
    console.log('==================================================');

    const ping = await fetch(`${BASE_URL}/api/health`).catch(() => null);
    if (!ping) {
        serverInstance = app.listen(PORT);
        await new Promise((r) => setTimeout(r, 400));
        console.log(`Started in-process Express server on port ${PORT}`);
    } else {
        console.log(`Connected to active server running on port ${PORT}`);
    }

    try {
        const hrLogin = await request('/api/auth/login', { method: 'POST', body: { email: DEMO_HR_EMAIL, password: DEMO_HR_PASSWORD } });
        const hrToken = hrLogin.data?.token;
        if (!hrToken) throw new Error('HR login failed; check DEMO_HR_EMAIL/DEMO_HR_PASSWORD in server/.env');

        const candA = await signupCandidate('a');
        const candB = await signupCandidate('b');
        const jobId = await createPublishedJob(hrToken, `Security Test Job ${Date.now()}`);

        // ---------------- Authentication ----------------
        check('Unauthenticated GET /api/applications rejected', (await request('/api/applications')).status === 401);
        check('Unauthenticated POST /api/jobs rejected', (await request('/api/jobs', { method: 'POST', body: {} })).status === 401);
        check('Unauthenticated GET /api/dashboard/stats rejected', (await request('/api/dashboard/stats')).status === 401);
        check('Tampered JWT rejected', (await request('/api/offers', { token: `${hrToken}x` })).status === 401);
        check('Candidate token cannot use HR login-only areas (GET /api/offers)', (await request('/api/offers', { token: candA.token })).status === 403);
        const hrViaCandidateLogin = await request('/api/auth/candidate/login', { method: 'POST', body: { email: DEMO_HR_EMAIL, password: DEMO_HR_PASSWORD } });
        check('HR account cannot sign in through candidate portal', hrViaCandidateLogin.status === 403);

        // ---------------- Role separation on interviews ----------------
        const candInterviews = await request('/api/interviews', { token: candA.token });
        check('Candidate cannot list all interviews', candInterviews.status === 403, `HTTP ${candInterviews.status}`);
        const [anyInterview] = await pool.query('SELECT id FROM interviews LIMIT 1');
        if (anyInterview[0]) {
            const r = await request(`/api/interviews/${anyInterview[0].id}`, { token: candA.token });
            check('Candidate cannot read an interview record', r.status === 403, `HTTP ${r.status}`);
            const ev = await request(`/api/interviews/${anyInterview[0].id}/evaluate`, { method: 'PUT', token: candA.token, body: { result: 'PASS' } });
            check('Candidate cannot evaluate an interview', ev.status === 403, `HTTP ${ev.status}`);
        }
        check('Candidate cannot list candidates', (await request('/api/candidates', { token: candA.token })).status === 403);
        check('Candidate cannot screen applications', (await request('/api/applications/1/screen', { method: 'PATCH', token: candA.token })).status === 403);

        // ---------------- Applications & IDOR ----------------
        const appA = await request('/api/candidate/apply', { method: 'POST', token: candA.token, body: { job_id: jobId } });
        const appAId = appA.data?.data?.id;
        check('Candidate A applies via portal', appA.status === 201 && appAId);

        check('Candidate cannot call HR skill-match endpoint', (await request(`/api/applications/${appAId}/skill-match`, { token: candA.token })).status === 403);
        const match = await request(`/api/applications/${appAId}/skill-match`, { token: hrToken });
        const afterMatch = await request(`/api/applications/${appAId}`, { token: hrToken });
        check('HR skill match returns an explainable advisory result without changing status',
            match.status === 200 && match.data?.data?.method === 'rule-based' && Array.isArray(match.data?.data?.limitations) && afterMatch.data?.data?.status === 'APPLIED',
            `score=${match.data?.data?.score}`);

        const idor = await request(`/api/candidate/applications/${appAId}`, { token: candB.token });
        check("Candidate B cannot read candidate A's application", idor.status === 403);

        const bodySpoof = await request('/api/candidate/apply', {
            method: 'POST',
            token: candB.token,
            body: { job_id: jobId, candidate_id: 1, email: candA.email }
        });
        const [spoofRows] = await pool.query(
            'SELECT c.email FROM applications a JOIN candidates c ON a.candidate_id = c.id WHERE a.id = ?',
            [bodySpoof.data?.data?.id || 0]
        );
        check('Portal apply ignores candidate_id/email in body (uses JWT identity)', bodySpoof.status === 201 && spoofRows[0]?.email === candB.email);

        const impostor = await request('/api/applications', {
            method: 'POST',
            body: { job_id: jobId, name: 'Impostor', email: candA.email }
        });
        check('Anonymous public apply with a registered email is blocked', impostor.status === 409, impostor.data?.message);

        // Concurrent duplicate apply (public form, new email): exactly one should succeed
        const dupEmail = `sec.dup.${Date.now()}@example.com`;
        created.emails.push(dupEmail);
        const dupResults = await Promise.all(
            [1, 2, 3].map(() => request('/api/applications', { method: 'POST', body: { job_id: jobId, name: 'Race Applicant', email: dupEmail } }))
        );
        const dupCreated = dupResults.filter((r) => r.status === 201).length;
        const dupConflicts = dupResults.filter((r) => r.status === 409).length;
        const [dupRows] = await pool.query(
            'SELECT COUNT(*) AS cnt FROM applications a JOIN candidates c ON a.candidate_id = c.id WHERE c.email = ? AND a.job_id = ?',
            [dupEmail, jobId]
        );
        check('Concurrent duplicate applications create exactly one record', dupCreated === 1 && dupConflicts === 2 && Number(dupRows[0].cnt) === 1,
            `201s=${dupCreated}, 409s=${dupConflicts}, rows=${dupRows[0].cnt}`);

        // ---------------- Concurrency on status transitions ----------------
        const screens = await Promise.all([1, 2, 3, 4].map(() => request(`/api/applications/${appAId}/screen`, { method: 'PATCH', token: hrToken })));
        check('Concurrent "screen" clicks: exactly one transition succeeds',
            screens.filter((r) => r.status === 200).length === 1 && screens.filter((r) => r.status === 400).length === 3);

        await request(`/api/applications/${appAId}/shortlist`, { method: 'PATCH', token: hrToken });
        const scheduleBody = { application_id: appAId, interviewer_id: 2, scheduled_at: futureDateTime(3), type: 'Technical' };
        const schedules = await Promise.all([1, 2, 3].map(() => request('/api/interviews', { method: 'POST', token: hrToken, body: scheduleBody })));
        const [ivCount] = await pool.query('SELECT COUNT(*) AS cnt FROM interviews WHERE application_id = ?', [appAId]);
        check('Concurrent interview scheduling creates exactly one interview',
            schedules.filter((r) => r.status === 201).length === 1 && Number(ivCount[0].cnt) === 1, `rows=${ivCount[0].cnt}`);
        const interviewId = schedules.find((r) => r.status === 201)?.data?.data?.id;

        // ---------------- Interview validation ----------------
        const appBId = bodySpoof.data?.data?.id;
        await request(`/api/applications/${appBId}/screen`, { method: 'PATCH', token: hrToken });
        await request(`/api/applications/${appBId}/shortlist`, { method: 'PATCH', token: hrToken });
        const pastIv = await request('/api/interviews', { method: 'POST', token: hrToken, body: { ...scheduleBody, application_id: appBId, scheduled_at: '2020-01-01T10:00' } });
        check('Interview in the past is rejected', pastIv.status === 400, pastIv.data?.message);
        const badIv = await request('/api/interviews', { method: 'POST', token: hrToken, body: { ...scheduleBody, application_id: appBId, scheduled_at: 'tomorrow' } });
        check('Malformed interview datetime is rejected', badIv.status === 400, badIv.data?.message);
        const candAsInterviewer = await request('/api/interviews', { method: 'POST', token: hrToken, body: { ...scheduleBody, application_id: appBId, interviewer_id: candA.user.id } });
        check('Candidate account cannot be assigned as interviewer', candAsInterviewer.status === 400, candAsInterviewer.data?.message);
        const jsLink = await request('/api/interviews', { method: 'POST', token: hrToken, body: { ...scheduleBody, application_id: appBId, meeting_link: 'javascript:alert(1)' } });
        check('Non-http meeting link is rejected', jsLink.status === 400);

        const resched = await request(`/api/interviews/${interviewId}/reschedule`, { method: 'PATCH', token: hrToken, body: { scheduled_at: futureDateTime(7, 15) } });
        check('Pending interview can be rescheduled', resched.status === 200 && String(resched.data?.data?.scheduled_at || '').length > 0);

        const badRating = await request(`/api/interviews/${interviewId}/evaluate`, { method: 'PUT', token: hrToken, body: { result: 'PASS', overall_rating: 11 } });
        check('Out-of-range rating rejected', badRating.status === 400);
        await request(`/api/interviews/${interviewId}/evaluate`, { method: 'PUT', token: hrToken, body: { result: 'PASS', overall_rating: 8 } });
        const reEval = await request(`/api/interviews/${interviewId}/evaluate`, { method: 'PUT', token: hrToken, body: { result: 'FAIL', overall_rating: 2 } });
        check('Completed interview cannot be re-evaluated', reEval.status === 400, reEval.data?.message);
        const reschedDone = await request(`/api/interviews/${interviewId}/reschedule`, { method: 'PATCH', token: hrToken, body: { scheduled_at: futureDateTime(8) } });
        check('Completed interview cannot be rescheduled', reschedDone.status === 400);

        // ---------------- Interviewer object-level access ----------------
        const ivEmail = `sec.interviewer.${Date.now()}@example.com`;
        const [ivUser] = await pool.query(
            `INSERT INTO users (name, email, password, role) VALUES ('Security Interviewer', ?, ?, 'INTERVIEWER')`,
            [ivEmail, bcrypt.hashSync('Interview@123', 10)]
        );
        created.users.push(ivUser.insertId);
        const ivLogin = await request('/api/auth/login', { method: 'POST', body: { email: ivEmail, password: 'Interview@123' } });
        const ivToken = ivLogin.data?.token;
        const ivList = await request('/api/interviews', { token: ivToken });
        check('Interviewer sees only assigned interviews', ivList.status === 200 && ivList.data.data.length === 0);
        check('Interviewer cannot open an unassigned interview', (await request(`/api/interviews/${interviewId}`, { token: ivToken })).status === 403);
        check('Interviewer cannot open an unassigned application', (await request(`/api/applications/${appAId}`, { token: ivToken })).status === 403);
        check('Interviewer cannot reschedule interviews', (await request(`/api/interviews/${interviewId}/reschedule`, { method: 'PATCH', token: ivToken, body: { scheduled_at: futureDateTime(9) } })).status === 403);

        // ---------------- Offers & hiring ----------------
        await request(`/api/applications/${appAId}/select`, { method: 'PATCH', token: hrToken });
        const badOfferDates = await request('/api/offers', {
            method: 'POST', token: hrToken,
            body: { application_id: appAId, salary: 90000, offer_date: todayDateOnly(), joining_date: futureDate(30), expiry_date: '2020-01-01' }
        });
        check('Offer with past expiry date is rejected', badOfferDates.status === 400, badOfferDates.data?.message);
        const invalidOfferDate = await request('/api/offers', {
            method: 'POST', token: hrToken,
            body: { application_id: appAId, salary: 90000, offer_date: '2026-02-30', joining_date: futureDate(30), expiry_date: futureDate(10) }
        });
        check('Offer with impossible calendar date is rejected', invalidOfferDate.status === 400);
        const negSalary = await request('/api/offers', {
            method: 'POST', token: hrToken,
            body: { application_id: appAId, salary: -5, offer_date: todayDateOnly(), joining_date: futureDate(30), expiry_date: futureDate(10) }
        });
        check('Offer with negative salary is rejected', negSalary.status === 400);

        const hireEarly = await request(`/api/applications/${appAId}/hire`, { method: 'PATCH', token: hrToken });
        check('Hiring before an accepted offer is rejected', hireEarly.status === 400);

        const offerResults = await Promise.all([1, 2].map(() => request('/api/offers', {
            method: 'POST', token: hrToken,
            body: { application_id: appAId, salary: 90000, offer_date: todayDateOnly(), joining_date: futureDate(30), expiry_date: futureDate(14) }
        })));
        check('Concurrent offer creation creates exactly one offer',
            offerResults.filter((r) => r.status === 201).length === 1, offerResults.map((r) => r.status).join(','));

        const rejectWithActiveOffer = await request(`/api/applications/${appAId}/reject`, { method: 'PATCH', token: hrToken });
        check('HR cannot reject while an active offer awaits the candidate', rejectWithActiveOffer.status === 400, rejectWithActiveOffer.data?.message);

        const foreignAccept = await request(`/api/candidate/applications/${appAId}/accept-offer`, { method: 'POST', token: candB.token });
        check("Candidate B cannot accept candidate A's offer", foreignAccept.status === 403);

        const accepts = await Promise.all([1, 2].map(() => request(`/api/candidate/applications/${appAId}/accept-offer`, { method: 'POST', token: candA.token })));
        check('Double-click accept: exactly one acceptance succeeds',
            accepts.filter((r) => r.status === 200).length === 1 && accepts.filter((r) => r.status === 400).length === 1);
        const afterAccept = await request(`/api/applications/${appAId}`, { token: hrToken });
        check('Acceptance leaves application OFFER_ACCEPTED (not auto-HIRED)', afterAccept.data?.data?.status === 'OFFER_ACCEPTED' && afterAccept.data?.data?.offer?.status === 'ACCEPTED');
        const rejectAccepted = await request(`/api/applications/${appAId}/reject`, { method: 'PATCH', token: hrToken });
        check('Accepted application cannot be rejected', rejectAccepted.status === 400);
        const hire = await request(`/api/applications/${appAId}/hire`, { method: 'PATCH', token: hrToken });
        check('HR hires after acceptance', hire.status === 200 && hire.data?.data?.status === 'HIRED');
        check('Hiring twice is rejected', (await request(`/api/applications/${appAId}/hire`, { method: 'PATCH', token: hrToken })).status === 400);

        // Expired offer flow (offer row inserted with a past expiry to simulate time passing)
        const appC = await request('/api/candidate/apply', { method: 'POST', token: candA.token, body: { job_id: await createPublishedJob(hrToken, `Security Expiry Job ${Date.now()}`) } });
        const appCId = appC.data?.data?.id;
        await pipelineToOffer(hrToken, appCId);
        await pool.query(`UPDATE offers SET offer_date = '2020-01-01', expiry_date = '2020-01-10' WHERE application_id = ?`, [appCId]);
        const expiredView = await request(`/api/applications/${appCId}`, { token: hrToken });
        check('HR sees an unanswered past-expiry offer as EXPIRED', expiredView.data?.data?.offer?.status === 'EXPIRED');
        const candExpiredView = await request(`/api/candidate/applications/${appCId}`, { token: candA.token });
        check('Candidate sees the offer as EXPIRED', candExpiredView.data?.data?.offer?.status === 'EXPIRED');
        const expiredAccept = await request(`/api/candidate/applications/${appCId}/accept-offer`, { method: 'POST', token: candA.token });
        check('Expired offer cannot be accepted', expiredAccept.status === 400 && /expired/i.test(expiredAccept.data?.message || ''));
        const expiredDecline = await request(`/api/candidate/applications/${appCId}/reject-offer`, { method: 'POST', token: candA.token });
        check('Expired offer cannot be declined', expiredDecline.status === 400);
        const rejectExpired = await request(`/api/applications/${appCId}/reject`, { method: 'PATCH', token: hrToken });
        const [expiredRow] = await pool.query('SELECT status FROM offers WHERE application_id = ?', [appCId]);
        check('HR can close out an expired offer by rejecting', rejectExpired.status === 200 && expiredRow[0]?.status === 'EXPIRED');

        // Declined offer can never lead to hiring
        const appD = await request('/api/candidate/apply', { method: 'POST', token: candB.token, body: { job_id: await createPublishedJob(hrToken, `Security Decline Job ${Date.now()}`) } });
        const appDId = appD.data?.data?.id;
        await pipelineToOffer(hrToken, appDId);
        const decline = await request(`/api/candidate/applications/${appDId}/reject-offer`, { method: 'POST', token: candB.token });
        check('Candidate declines own offer', decline.status === 200 && decline.data?.data?.application?.status === 'REJECTED' && decline.data?.data?.offer?.status === 'REJECTED');
        check('Declined application cannot be hired', (await request(`/api/applications/${appDId}/hire`, { method: 'PATCH', token: hrToken })).status === 400);
        check('Declined application cannot be re-screened', (await request(`/api/applications/${appDId}/screen`, { method: 'PATCH', token: hrToken })).status === 400);

        // ---------------- Input validation ----------------
        const badJson = await request('/api/auth/login', { method: 'POST', rawBody: '{bad json' });
        check('Malformed JSON returns 400 without parser details', badJson.status === 400 && !/position/i.test(badJson.data?.message || ''));
        const badDeadline = await request('/api/jobs', {
            method: 'POST', token: hrToken,
            body: { title: 'x', department: 'x', description: 'x', skills: 'x', experience_required: 'x', location: 'x', deadline: 'not-a-date' }
        });
        if (badDeadline.data?.data?.id) created.jobs.push(badDeadline.data.data.id);
        check('Invalid job deadline returns 400 (no SQL error leak)', badDeadline.status === 400 && !/column/i.test(badDeadline.data?.message || ''), badDeadline.data?.message);
        const salaryRange = await request('/api/jobs', {
            method: 'POST', token: hrToken,
            body: { title: 'x', department: 'x', description: 'x', skills: 'x', experience_required: 'x', location: 'x', deadline: futureDate(10), salary_min: 100, salary_max: 50 }
        });
        if (salaryRange.data?.data?.id) created.jobs.push(salaryRange.data.data.id);
        check('Job salary min > max rejected', salaryRange.status === 400);
        const pastDeadline = await request('/api/jobs', {
            method: 'POST', token: hrToken,
            body: { title: 'x', department: 'x', description: 'x', skills: 'x', experience_required: 'x', location: 'x', deadline: '2020-01-01' }
        });
        if (pastDeadline.data?.data?.id) created.jobs.push(pastDeadline.data.data.id);
        check('Job with past deadline rejected', pastDeadline.status === 400);

        const dateJob = await request('/api/jobs', {
            method: 'POST', token: hrToken,
            body: { title: 'Date Roundtrip', department: 'QA', description: 'x', skills: 'x', experience_required: 'x', location: 'x', deadline: '2027-03-15' }
        });
        if (dateJob.data?.data?.id) created.jobs.push(dateJob.data.data.id);
        check('Job deadline round-trips exactly (no timezone shift)', dateJob.data?.data?.deadline === '2027-03-15', dateJob.data?.data?.deadline);

        const xssProfile = await request('/api/candidate/profile', { method: 'PUT', token: candA.token, body: { resume_url: 'javascript:alert(1)' } });
        check('javascript: resume URL rejected', xssProfile.status === 400);
        const longExp = await request('/api/candidate/profile', { method: 'PUT', token: candA.token, body: { experience: 'x'.repeat(80) } });
        check('Over-length profile field returns 400 (not 500)', longExp.status === 400, longExp.data?.message);
        const emptyName = await request('/api/candidate/profile', { method: 'PUT', token: candA.token, body: { name: '   ' } });
        check('Blank profile name rejected', emptyName.status === 400);
        const badEmailSignup = await request('/api/auth/candidate/signup', { method: 'POST', body: { name: 'x', email: 'not-an-email', password: 'Secure@123' } });
        check('Signup with invalid email rejected', badEmailSignup.status === 400);
        const shortPw = await request('/api/auth/candidate/signup', { method: 'POST', body: { name: 'x', email: `sec.pw.${Date.now()}@example.com`, password: '123' } });
        check('Signup with short password rejected', shortPw.status === 400);

        // ---------------- Job visibility ----------------
        const [expiredJob] = await pool.query(
            `INSERT INTO jobs (title, department, description, skills, experience_required, location, employment_type, deadline, status, created_by)
             VALUES ('Security Past Deadline Job', 'QA', 'x', 'x', 'x', 'Remote', 'Full-time', '2020-01-01', 'PUBLISHED', 1)`
        );
        created.jobs.push(expiredJob.insertId);
        const publicJobs = await request('/api/jobs');
        check('Past-deadline jobs hidden from public job board', !publicJobs.data.data.some((j) => j.id === expiredJob.insertId));
        const applyExpired = await request('/api/candidate/apply', { method: 'POST', token: candB.token, body: { job_id: expiredJob.insertId } });
        check('Applying to a past-deadline job is rejected', applyExpired.status === 400);
        const draft = await request('/api/jobs', {
            method: 'POST', token: hrToken,
            body: { title: 'Security Draft', department: 'QA', description: 'x', skills: 'x', experience_required: 'x', location: 'x', deadline: futureDate(20) }
        });
        if (draft.data?.data?.id) created.jobs.push(draft.data.data.id);
        check('Public cannot view a DRAFT job', (await request(`/api/jobs/${draft.data?.data?.id}`)).status === 404);
        check('Applying to a DRAFT job is rejected', (await request('/api/candidate/apply', { method: 'POST', token: candB.token, body: { job_id: draft.data?.data?.id } })).status === 400);

        // ---------------- Transaction rollback ----------------
        const [beforeRows] = await pool.query('SELECT status FROM applications WHERE id = ?', [appBId]);
        let rolledBack = false;
        try {
            await recruitmentService.withTransaction(async (conn) => {
                await conn.execute(`UPDATE applications SET status = 'HIRED' WHERE id = ?`, [appBId]);
                throw new Error('Simulated failure after first write');
            });
        } catch {
            rolledBack = true;
        }
        const [afterRows] = await pool.query('SELECT status FROM applications WHERE id = ?', [appBId]);
        check('Failed multi-step update is rolled back', rolledBack && afterRows[0].status === beforeRows[0].status,
            `before=${beforeRows[0].status}, after=${afterRows[0].status}`);
    } catch (err) {
        failed++;
        console.error('[FAIL] Suite aborted:', err.message);
    } finally {
        await cleanup();
        if (serverInstance) serverInstance.close();
        await pool.end();
    }

    console.log('==================================================');
    console.log(`SECURITY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================');
    process.exit(failed > 0 ? 1 : 0);
}

run();
