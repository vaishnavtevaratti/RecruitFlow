/**
 * RecruitFlow — Platform feature tests: job reopen/delete, job filters, interview cancel,
 * offer designation/notes, staff-only login, dashboard activity, security headers, auth rate limit.
 * Always boots its own in-process server on a separate port so the rate-limit check
 * cannot affect a running dev server. Removes its test data afterwards.
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = require('../src/app');
const { pool } = require('../src/config/db');
const { todayDateOnly } = require('../src/utils/dates');

const PORT = Number(process.env.PORT || 5000) + 17;
const BASE = `http://127.0.0.1:${PORT}/api`;

let passed = 0;
let failed = 0;
const createdJobs = [];
const email = `platform.${Date.now()}@example.com`;

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
    return { status: res.status, data, headers: res.headers };
}

function futureDate(days, withTime = false) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const p = (n) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    return withTime ? `${date}T10:30` : date;
}

const jobBody = (title) => ({
    title,
    department: 'Platform QA',
    description: 'Platform feature test job.',
    skills: 'Testing, SQL',
    experience_required: '2 years',
    location: `Platform City ${process.pid}`,
    employment_type: 'Contract',
    salary_min: 50000,
    salary_max: 70000,
    deadline: futureDate(30)
});

async function run() {
    const health = await api('/health');
    check('Security headers set', health.headers.get('x-content-type-options') === 'nosniff' && health.headers.get('x-frame-options') === 'DENY');

    const hr = await api('/auth/login', { method: 'POST', body: { email: process.env.DEMO_HR_EMAIL || 'hr@recruitflow.com', password: process.env.DEMO_HR_PASSWORD || 'Admin@123' } });
    const hrToken = hr.data?.token;
    check('HR logs in', hr.status === 200 && Boolean(hrToken));

    // --- Jobs: delete draft, filters, close/reopen ---
    const draft = await api('/jobs', { method: 'POST', token: hrToken, body: jobBody(`Platform Draft ${Date.now()}`) });
    const draftId = draft.data?.data?.id;
    if (draftId) createdJobs.push(draftId);
    const del = await api(`/jobs/${draftId}`, { method: 'DELETE', token: hrToken });
    check('HR deletes a job with no applications', del.status === 200);
    check('Deleted job is gone', (await api(`/jobs/${draftId}`, { token: hrToken })).status === 404);

    const job = await api('/jobs', { method: 'POST', token: hrToken, body: jobBody(`Platform Job ${Date.now()}`) });
    const jobId = job.data?.data?.id;
    if (jobId) createdJobs.push(jobId);
    await api(`/jobs/${jobId}/publish`, { method: 'PATCH', token: hrToken });

    const byLoc = await api(`/jobs?location=${encodeURIComponent(`Platform City ${process.pid}`)}`);
    check('Public jobs filter by location', byLoc.data?.data?.length === 1 && byLoc.data.data[0].id === jobId);
    const byType = await api('/jobs?employment_type=Contract');
    check('Public jobs filter by employment type', byType.data?.data?.some((j) => j.id === jobId) && byType.data.data.every((j) => j.employment_type === 'Contract'));

    check('Published job cannot be reopened', (await api(`/jobs/${jobId}/reopen`, { method: 'PATCH', token: hrToken })).status === 400);
    await api(`/jobs/${jobId}/close`, { method: 'PATCH', token: hrToken });
    const reopen = await api(`/jobs/${jobId}/reopen`, { method: 'PATCH', token: hrToken });
    check('Closed job can be reopened', reopen.status === 200 && reopen.data.data.status === 'PUBLISHED');

    // --- Auth: password policy, portal separation ---
    const weak = await api('/auth/candidate/signup', { method: 'POST', body: { name: 'Weak Pass', email: `weak.${email}`, password: 'Abc@123' } });
    check('Signup rejects passwords under 8 characters', weak.status === 400);
    const signup = await api('/auth/candidate/signup', {
        method: 'POST',
        body: { name: 'Platform Candidate', email, password: 'Platform@123', phone: '+1 555 0101', skills: 'Testing, SQL', experience: '3 years', education: 'B.Sc.' }
    });
    const candToken = signup.data?.token;
    check('Candidate registers', signup.status === 201);
    check('Candidate cannot sign in through staff login', (await api('/auth/login', { method: 'POST', body: { email, password: 'Platform@123' } })).status === 403);
    check('Candidate cannot delete jobs', (await api(`/jobs/${jobId}`, { method: 'DELETE', token: candToken })).status === 403);

    const apply = await api('/candidate/apply', { method: 'POST', token: candToken, body: { job_id: jobId } });
    const appId = apply.data?.data?.id;
    check('Candidate applies to reopened job', apply.status === 201);
    check('Job with applications cannot be deleted', (await api(`/jobs/${jobId}`, { method: 'DELETE', token: hrToken })).status === 409);

    // --- Interview cancel ---
    await api(`/applications/${appId}/screen`, { method: 'PATCH', token: hrToken });
    await api(`/applications/${appId}/shortlist`, { method: 'PATCH', token: hrToken });
    const interviewers = await api('/interviews/interviewers', { token: hrToken });
    const interviewerId = interviewers.data?.data?.[0]?.id;
    const ivBody = { application_id: appId, interviewer_id: interviewerId, scheduled_at: futureDate(2, true), type: 'Technical Interview' };
    const iv = await api('/interviews', { method: 'POST', token: hrToken, body: ivBody });
    const ivId = iv.data?.data?.id;
    check('HR schedules interview', iv.status === 201);
    check('Candidate cannot cancel interviews', (await api(`/interviews/${ivId}/cancel`, { method: 'PATCH', token: candToken })).status === 403);
    const cancel = await api(`/interviews/${ivId}/cancel`, { method: 'PATCH', token: hrToken });
    check('HR cancels pending interview -> SHORTLISTED', cancel.status === 200 && cancel.data.data.status === 'SHORTLISTED');
    check('Cancelled interview cannot be cancelled again', (await api(`/interviews/${ivId}/cancel`, { method: 'PATCH', token: hrToken })).status === 404);

    const iv2 = await api('/interviews', { method: 'POST', token: hrToken, body: ivBody });
    check('HR can reschedule after cancelling', iv2.status === 201);
    const ev = await api(`/interviews/${iv2.data?.data?.id}/evaluate`, {
        method: 'PUT',
        token: hrToken,
        body: { technical_rating: 8, communication_rating: 8, problem_solving_rating: 8, overall_rating: 8, feedback: 'Solid.', result: 'PASS' }
    });
    check('Evaluated interview cannot be cancelled', ev.status === 200 && (await api(`/interviews/${iv2.data.data.id}/cancel`, { method: 'PATCH', token: hrToken })).status === 400);
    await api(`/applications/${appId}/select`, { method: 'PATCH', token: hrToken });

    // --- Offer designation/notes ---
    const offer = await api('/offers', {
        method: 'POST',
        token: hrToken,
        body: { application_id: appId, designation: 'QA Engineer II', notes: 'Includes health insurance.', salary: 65000, offer_date: todayDateOnly(), joining_date: futureDate(20), expiry_date: futureDate(10) }
    });
    check('Offer stores designation and notes', offer.status === 201 && offer.data.data.designation === 'QA Engineer II' && offer.data.data.notes === 'Includes health insurance.');
    const candView = await api(`/candidate/applications/${appId}`, { token: candToken });
    check('Candidate sees designation and notes', candView.data?.data?.offer?.designation === 'QA Engineer II' && candView.data.data.offer.notes === 'Includes health insurance.');

    // --- Dashboard activity ---
    const stats = await api('/dashboard/stats', { token: hrToken });
    check('Dashboard recent activity includes latest application', stats.data?.data?.recentActivity?.some((a) => a.id === appId));
    check('Candidate cannot read HR dashboard', (await api('/dashboard/stats', { token: candToken })).status === 403);

    // --- Rate limit (last: it blocks this IP on this in-process server) ---
    let limited = null;
    for (let i = 0; i < 15 && !limited; i++) {
        const r = await api('/auth/candidate/login', { method: 'POST', body: { email, password: 'wrong-password-x' } });
        if (r.status === 429) limited = i;
    }
    check('Repeated failed logins are rate limited (429)', limited !== null, `after ${limited} attempts`);
}

async function cleanup() {
    const [cands] = await pool.query('SELECT id FROM candidates WHERE email = ?', [email]);
    for (const { id } of cands) {
        const [apps] = await pool.query('SELECT id FROM applications WHERE candidate_id = ?', [id]);
        for (const a of apps) {
            await pool.query('DELETE FROM offers WHERE application_id = ?', [a.id]);
            await pool.query('DELETE FROM interviews WHERE application_id = ?', [a.id]);
            await pool.query('DELETE FROM applications WHERE id = ?', [a.id]);
        }
        await pool.query('DELETE FROM candidates WHERE id = ?', [id]);
    }
    await pool.query("DELETE FROM users WHERE email = ? AND role = 'CANDIDATE'", [email]);
    if (createdJobs.length) await pool.query('DELETE FROM jobs WHERE id IN (?)', [createdJobs]);
}

(async () => {
    const server = app.listen(PORT);
    await new Promise((r) => setTimeout(r, 300));
    try {
        await run();
    } catch (err) {
        failed++;
        console.error('[FAIL] Suite aborted:', err.message);
    } finally {
        await cleanup().catch((e) => console.warn('Cleanup warning:', e.message));
        server.close();
        await pool.end();
    }
    console.log(`\nPLATFORM TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    process.exit(failed > 0 ? 1 : 0);
})();
