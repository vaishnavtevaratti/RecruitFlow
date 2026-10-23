/**
 * RecruitFlow — End-to-End Workflow Scenarios (API level)
 * Scenario A: job -> publish -> candidate signup -> apply -> screen -> shortlist -> interview
 *             -> PASS evaluation -> select -> offer -> candidate accepts -> HR hires.
 * Scenario B: same pipeline with a second candidate who declines the offer.
 * Each scenario checks both portals' views and the final MySQL rows, then removes its test data.
 * Uses the same endpoints the React pages call. Requires the backend to be running
 * (or starts one in-process). Browser rendering is not exercised by this script.
 *
 * Usage: node scripts/e2eWorkflow.js [--keep]   (--keep leaves the test records in the database)
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = require('../src/app');
const { pool } = require('../src/config/db');
const { todayDateOnly } = require('../src/utils/dates');

const PORT = process.env.PORT || 5000;
const BASE = `http://127.0.0.1:${PORT}/api`;
const KEEP = process.argv.includes('--keep');

let passed = 0;
let failed = 0;
const createdJobs = [];
const createdEmails = [];

function check(title, condition, detail = '') {
    if (condition) passed++;
    else failed++;
    console[condition ? 'log' : 'error'](`[${condition ? 'PASS' : 'FAIL'}] ${title}${detail ? ` -> ${detail}` : ''}`);
}

async function api(pathname, { method = 'GET', token, body } = {}) {
    const res = await fetch(`${BASE}${pathname}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
}

function futureDate(days, withTime = false) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const p = (n) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    return withTime ? `${date}T11:00` : date;
}

async function runPipeline(label, hrToken, decision) {
    console.log(`\n--- Scenario ${label}: candidate ${decision === 'accept' ? 'accepts' : 'declines'} the offer ---`);

    const job = await api('/jobs', {
        method: 'POST',
        token: hrToken,
        body: {
            title: `E2E ${label} Backend Engineer ${Date.now()}`,
            department: 'Engineering',
            description: 'End-to-end scenario test job.',
            skills: 'Node.js, MySQL, REST APIs',
            experience_required: '3 years',
            location: 'Remote',
            employment_type: 'Full-time',
            salary_min: 80000,
            salary_max: 110000,
            deadline: futureDate(45)
        }
    });
    const jobId = job.data?.data?.id;
    if (jobId) createdJobs.push(jobId);
    check(`${label}: HR creates job as DRAFT`, job.status === 201 && job.data.data.status === 'DRAFT');

    const draftPublic = await api('/jobs');
    check(`${label}: draft job hidden from candidates`, !draftPublic.data.data.some((j) => j.id === jobId));

    const pub = await api(`/jobs/${jobId}/publish`, { method: 'PATCH', token: hrToken });
    check(`${label}: HR publishes job`, pub.data?.data?.status === 'PUBLISHED');

    const email = `e2e.${label.toLowerCase()}.${Date.now()}@example.com`;
    createdEmails.push(email);
    const signup = await api('/auth/candidate/signup', {
        method: 'POST',
        body: { name: `E2E Candidate ${label}`, email, password: 'E2eTest@123', phone: '+1 555 0100', skills: 'Node.js, MySQL', experience: '4 years', education: 'B.Sc. Computer Science' }
    });
    check(`${label}: candidate registers`, signup.status === 201);
    const login = await api('/auth/candidate/login', { method: 'POST', body: { email, password: 'E2eTest@123' } });
    const candToken = login.data?.token;
    check(`${label}: candidate logs in`, login.status === 200 && Boolean(candToken));

    const board = await api('/jobs');
    check(`${label}: candidate sees the published job`, board.data.data.some((j) => j.id === jobId));

    const apply = await api('/candidate/apply', { method: 'POST', token: candToken, body: { job_id: jobId } });
    const appId = apply.data?.data?.id;
    check(`${label}: candidate applies`, apply.status === 201 && apply.data.data.status === 'APPLIED');
    const dup = await api('/candidate/apply', { method: 'POST', token: candToken, body: { job_id: jobId } });
    check(`${label}: duplicate application blocked`, dup.status === 409);

    const hrList = await api(`/applications?job_id=${jobId}`, { token: hrToken });
    check(`${label}: HR sees the new application`, hrList.data?.data?.some((a) => a.id === appId));

    check(`${label}: HR screens`, (await api(`/applications/${appId}/screen`, { method: 'PATCH', token: hrToken })).data?.data?.status === 'SCREENING');
    check(`${label}: HR shortlists`, (await api(`/applications/${appId}/shortlist`, { method: 'PATCH', token: hrToken })).data?.data?.status === 'SHORTLISTED');

    const interviewers = await api('/interviews/interviewers', { token: hrToken });
    const interviewerId = interviewers.data?.data?.find((u) => u.role === 'INTERVIEWER')?.id || interviewers.data?.data?.[0]?.id;
    const iv = await api('/interviews', {
        method: 'POST',
        token: hrToken,
        body: { application_id: appId, interviewer_id: interviewerId, scheduled_at: futureDate(3, true), type: 'Technical Interview', meeting_link: 'https://meet.example.com/e2e' }
    });
    check(`${label}: HR schedules interview`, iv.status === 201);

    const candIv = await api(`/candidate/applications/${appId}`, { token: candToken });
    check(`${label}: candidate sees interview details`, candIv.data?.data?.application?.status === 'INTERVIEW_SCHEDULED' && candIv.data.data.interviews[0]?.meeting_link === 'https://meet.example.com/e2e');

    const ev = await api(`/interviews/${iv.data.data.id}/evaluate`, {
        method: 'PUT',
        token: hrToken,
        body: { technical_rating: 8, communication_rating: 9, problem_solving_rating: 8, overall_rating: 8, feedback: 'Strong API design skills.', result: 'PASS' }
    });
    check(`${label}: HR records passing evaluation`, ev.status === 200 && ev.data.data.result === 'PASS');

    check(`${label}: HR selects candidate`, (await api(`/applications/${appId}/select`, { method: 'PATCH', token: hrToken })).data?.data?.status === 'SELECTED');

    const offer = await api('/offers', {
        method: 'POST',
        token: hrToken,
        body: { application_id: appId, salary: 98000, offer_date: todayDateOnly(), joining_date: futureDate(30), expiry_date: futureDate(10) }
    });
    const offerId = offer.data?.data?.id;
    check(`${label}: HR sends offer`, offer.status === 201 && offer.data.data.status === 'SENT');

    const candOffer = await api(`/candidate/applications/${appId}`, { token: candToken });
    check(`${label}: candidate sees offer`, candOffer.data?.data?.offer?.status === 'SENT' && Number(candOffer.data.data.offer.salary) === 98000);

    if (decision === 'accept') {
        const acc = await api(`/candidate/applications/${appId}/accept-offer`, { method: 'POST', token: candToken });
        check(`${label}: candidate accepts offer`, acc.status === 200 && acc.data.data.application.status === 'OFFER_ACCEPTED');
        const hrView = await api(`/applications/${appId}`, { token: hrToken });
        check(`${label}: HR sees OFFER_ACCEPTED`, hrView.data?.data?.status === 'OFFER_ACCEPTED' && hrView.data.data.offer.status === 'ACCEPTED');
        const hire = await api(`/applications/${appId}/hire`, { method: 'PATCH', token: hrToken });
        check(`${label}: HR marks hired`, hire.data?.data?.status === 'HIRED');
    } else {
        const dec = await api(`/candidate/applications/${appId}/reject-offer`, { method: 'POST', token: candToken });
        check(`${label}: candidate declines offer`, dec.status === 200);
        const hire = await api(`/applications/${appId}/hire`, { method: 'PATCH', token: hrToken });
        check(`${label}: declined candidate cannot be hired`, hire.status === 400);
    }

    // Re-read both portals ("refresh") and MySQL
    const expectedApp = decision === 'accept' ? 'HIRED' : 'REJECTED';
    const expectedOffer = decision === 'accept' ? 'ACCEPTED' : 'REJECTED';
    const candFinal = await api(`/candidate/applications/${appId}`, { token: candToken });
    const hrFinal = await api(`/offers/${offerId}`, { token: hrToken });
    const [rows] = await pool.query(
        'SELECT a.status AS app_status, o.status AS offer_status FROM applications a JOIN offers o ON o.application_id = a.id WHERE a.id = ?',
        [appId]
    );
    check(`${label}: candidate portal shows final state`, candFinal.data?.data?.application?.status === expectedApp && candFinal.data.data.offer.status === expectedOffer);
    check(`${label}: HR portal shows final state`, hrFinal.data?.data?.status === expectedOffer && hrFinal.data.data.application_status === expectedApp);
    check(`${label}: MySQL rows are consistent`, rows[0]?.app_status === expectedApp && rows[0]?.offer_status === expectedOffer,
        `applications.status=${rows[0]?.app_status}, offers.status=${rows[0]?.offer_status}`);

    // Logout is client-side token removal; a missing token must be rejected
    check(`${label}: protected route rejects requests without a token`, (await api('/candidate/applications')).status === 401);

    // Closing the job blocks further applications
    await api(`/jobs/${jobId}/close`, { method: 'PATCH', token: hrToken });
    const other = await api('/auth/candidate/signup', { method: 'POST', body: { name: 'Late Applicant', email: `late.${email}`, password: 'E2eTest@123' } });
    createdEmails.push(`late.${email}`);
    const late = await api('/candidate/apply', { method: 'POST', token: other.data?.token, body: { job_id: jobId } });
    check(`${label}: closed job rejects new applications`, late.status === 400);
}

async function cleanup() {
    if (KEEP) {
        console.log('\n--keep given: test records left in the database.');
        return;
    }
    const [cands] = await pool.query('SELECT id, user_id FROM candidates WHERE email IN (?)', [createdEmails]);
    const candIds = cands.map((c) => c.id);
    if (candIds.length) {
        const [apps] = await pool.query('SELECT id FROM applications WHERE candidate_id IN (?)', [candIds]);
        const appIds = apps.map((a) => a.id);
        if (appIds.length) {
            await pool.query('DELETE FROM offers WHERE application_id IN (?)', [appIds]);
            await pool.query('DELETE FROM interviews WHERE application_id IN (?)', [appIds]);
            await pool.query('DELETE FROM applications WHERE id IN (?)', [appIds]);
        }
        await pool.query('DELETE FROM candidates WHERE id IN (?)', [candIds]);
    }
    await pool.query('DELETE FROM users WHERE email IN (?) AND role = ?', [createdEmails, 'CANDIDATE']);
    if (createdJobs.length) await pool.query('DELETE FROM jobs WHERE id IN (?)', [createdJobs]);
    console.log('\nE2E test records removed.');
}

(async () => {
    let server = null;
    if (!(await fetch(`${BASE}/health`).catch(() => null))) {
        server = app.listen(PORT);
        await new Promise((r) => setTimeout(r, 400));
    }
    try {
        const hr = await api('/auth/login', { method: 'POST', body: { email: process.env.DEMO_HR_EMAIL || 'hr@recruitflow.com', password: process.env.DEMO_HR_PASSWORD || 'Admin@123' } });
        check('HR logs in', hr.status === 200);
        const badHr = await api('/auth/login', { method: 'POST', body: { email: process.env.DEMO_HR_EMAIL || 'hr@recruitflow.com', password: 'wrong-password' } });
        check('HR login with wrong password rejected', badHr.status === 401);
        await runPipeline('A', hr.data.token, 'accept');
        await runPipeline('B', hr.data.token, 'decline');
    } catch (err) {
        failed++;
        console.error('[FAIL] Scenario aborted:', err.message);
    } finally {
        await cleanup().catch((e) => console.warn('Cleanup warning:', e.message));
        if (server) server.close();
        await pool.end();
    }
    console.log(`\nE2E WORKFLOW RESULTS: ${passed} PASSED, ${failed} FAILED`);
    process.exit(failed > 0 ? 1 : 0);
})();
