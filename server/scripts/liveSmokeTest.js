/**
 * RecruitFlow — Live smoke test of the complete hiring workflow through the public API.
 *
 * Usage (from the repository root):
 *   node --env-file=server/.env.production server/scripts/liveSmokeTest.js
 *
 * - API base: LIVE_API_URL (default: the production Render API).
 * - HR login: DEMO_HR_EMAIL / DEMO_HR_PASSWORD from the env file.
 * - Registers one new test candidate with a random password used only for this run.
 * - Uses the published "LIVE TEST — QA Engineer" job (creates it if missing) and closes it at the end.
 * - Never prints passwords or tokens. Never deletes anything: test records stay, labelled LIVE TEST.
 */

const crypto = require('crypto');

const API = (process.env.LIVE_API_URL || 'https://recruitflow-api-5fbu.onrender.com/api').replace(/\/$/, '');
const TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const JOB_TITLE = 'LIVE TEST — QA Engineer';
const RUN = Date.now().toString(36);

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
    if (ok) passed++;
    else failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
    return ok;
}

async function api(method, path, { token, body, timeoutMs = 90000 } = {}) {
    const res = await fetch(`${API}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs)
    });
    let json = null;
    try {
        json = await res.json();
    } catch {
        json = null;
    }
    return { status: res.status, body: json };
}

/** Calendar date in the app time zone, offset by `days`. */
function appDate(days = 0) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date()).map((x) => [x.type, x.value]));
    const d = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) + days));
    return d.toISOString().slice(0, 10);
}

function hhmmInAppZone(iso) {
    return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

async function main() {
    const { DEMO_HR_EMAIL, DEMO_HR_PASSWORD } = process.env;
    if (!DEMO_HR_EMAIL || !DEMO_HR_PASSWORD) {
        console.log('FAIL  DEMO_HR_EMAIL and DEMO_HR_PASSWORD must be set (run with --env-file=server/.env.production)');
        process.exit(1);
    }
    console.log(`RecruitFlow live smoke test → ${API}  (run ${RUN})\n`);

    // --- Infrastructure ---------------------------------------------------
    const t0 = Date.now();
    // Free hosting can drop connections while the service wakes from sleep, so retry the first call
    let health = null;
    for (let attempt = 1; attempt <= 5 && !health; attempt++) {
        try {
            health = await api('GET', '/health', { timeoutMs: 120000 });
        } catch (err) {
            console.log(`...waiting for the API to wake up (attempt ${attempt}: ${err.cause?.code || err.name})`);
            await new Promise((r) => setTimeout(r, 15000));
        }
    }
    if (!health) throw new Error('API unreachable after 5 attempts');
    check('API is up', health.status === 200, `${Math.round((Date.now() - t0) / 100) / 10}s incl. any wake-up`);
    const db = await api('GET', '/health/db');
    if (!check('API reaches the database', db.status === 200 && db.body?.success === true)) return;

    // --- HR ----------------------------------------------------------------
    const hrLogin = await api('POST', '/auth/login', { body: { email: DEMO_HR_EMAIL, password: DEMO_HR_PASSWORD } });
    if (!check('HR signs in', hrLogin.status === 200 && hrLogin.body?.user?.role === 'HR', `HTTP ${hrLogin.status}`)) return;
    const hr = hrLogin.body.token;
    check('Wrong HR password is rejected', (await api('POST', '/auth/login', { body: { email: DEMO_HR_EMAIL, password: `${DEMO_HR_PASSWORD}-wrong` } })).status === 401);

    const jobs = await api('GET', '/jobs?status=PUBLISHED', { token: hr });
    let job = (jobs.body?.data || []).find((j) => j.title === JOB_TITLE);
    if (!job) {
        const created = await api('POST', '/jobs', {
            token: hr,
            body: {
                title: JOB_TITLE,
                department: 'Quality Assurance',
                description: 'Live deployment verification job created during RecruitFlow go-live testing. Not a real opening.',
                skills: 'Testing, SQL, Playwright',
                experience_required: '1-3 years',
                location: 'Remote',
                employment_type: 'Contract',
                salary_min: 50000,
                salary_max: 70000,
                deadline: appDate(30)
            }
        });
        check('HR creates the LIVE TEST job', created.status === 201);
        const pub = await api('PATCH', `/jobs/${created.body?.data?.id}/publish`, { token: hr });
        check('HR publishes it', pub.body?.data?.status === 'PUBLISHED');
        job = pub.body?.data;
    } else {
        check('Published LIVE TEST job found', true, `job #${job.id}`);
    }
    if (!job) return;
    const board = await api('GET', '/jobs');
    check('Job is visible on the public job board', (board.body?.data || []).some((j) => j.id === job.id));

    // --- Candidate ---------------------------------------------------------
    const email = `live.test.${RUN}@example.com`;
    const password = `Lt-${crypto.randomBytes(12).toString('base64url')}`;
    const signup = await api('POST', '/auth/candidate/signup', {
        body: { name: `LIVE TEST Candidate ${RUN}`, email, password, phone: '+91 90000 00000', education: 'B.Tech', skills: 'Testing', experience: '2 years' }
    });
    if (!check('Candidate registers', signup.status === 201, `HTTP ${signup.status}`)) return;
    check('Same email cannot register twice', (await api('POST', '/auth/candidate/signup', { body: { name: 'Dup', email, password } })).status === 409);
    const candLogin = await api('POST', '/auth/candidate/login', { body: { email, password } });
    if (!check('Candidate signs in', candLogin.status === 200 && Boolean(candLogin.body?.token))) return;
    const cand = candLogin.body.token;
    check('Candidate is blocked from HR endpoints', (await api('GET', '/dashboard/stats', { token: cand })).status === 403);
    check('Candidate cannot use the staff login', (await api('POST', '/auth/login', { body: { email, password } })).status === 403);

    const profile = await api('PUT', '/candidate/profile', { token: cand, body: { skills: 'Testing, SQL, Playwright', experience: '3 years', education: 'B.Tech Computer Science' } });
    check('Candidate updates profile', profile.status === 200);
    const me = await api('GET', '/candidate/me', { token: cand });
    check('Profile change is saved', JSON.stringify(me.body).includes('Testing, SQL, Playwright'));

    const apply = await api('POST', '/candidate/apply', { token: cand, body: { job_id: job.id } });
    if (!check('Candidate applies', apply.status === 201 && apply.body?.data?.status === 'APPLIED', `HTTP ${apply.status}`)) return;
    const appId = apply.body.data.id;
    check('Duplicate application is blocked', (await api('POST', '/candidate/apply', { token: cand, body: { job_id: job.id } })).status === 409);
    const dash = await api('GET', '/candidate/dashboard', { token: cand });
    check('Application shows on candidate dashboard', (dash.body?.data?.recentApplications || []).some((a) => a.id === appId));

    const candStatus = async () => (await api('GET', `/candidate/applications/${appId}`, { token: cand })).body?.data;

    // --- HR pipeline -------------------------------------------------------
    const hrList = await api('GET', `/applications?job_id=${job.id}`, { token: hr });
    check('HR sees the new application', (hrList.body?.data || []).some((a) => a.id === appId));
    check('HR screens', (await api('PATCH', `/applications/${appId}/screen`, { token: hr })).body?.data?.status === 'SCREENING');
    check('HR shortlists', (await api('PATCH', `/applications/${appId}/shortlist`, { token: hr })).body?.data?.status === 'SHORTLISTED');
    check('Candidate sees SHORTLISTED', (await candStatus())?.application?.status === 'SHORTLISTED');

    const interviewers = await api('GET', '/interviews/interviewers', { token: hr });
    const interviewDate = appDate(3);
    const link = `https://meet.example.com/live-test-${RUN}`;
    const iv = await api('POST', '/interviews', {
        token: hr,
        body: { application_id: appId, interviewer_id: interviewers.body?.data?.[0]?.id, scheduled_at: `${interviewDate}T11:00`, type: 'LIVE TEST Technical Round', meeting_link: link }
    });
    if (!check('HR schedules interview (11:00 India time)', iv.status === 201, `HTTP ${iv.status}`)) return;
    const stored = iv.body.data.scheduled_at;
    check('Interview stored as the correct UTC instant', new Date(stored).toISOString() === new Date(`${interviewDate}T05:30:00Z`).toISOString(), stored);
    const candIv = (await candStatus())?.interviews?.[0];
    check('Candidate sees the interview, link and 11:00 India time', candIv?.meeting_link === link && hhmmInAppZone(candIv.scheduled_at) === '11:00');

    const ev = await api('PUT', `/interviews/${iv.body.data.id}/evaluate`, {
        token: hr,
        body: { technical_rating: 8, communication_rating: 8, problem_solving_rating: 8, overall_rating: 8, feedback: 'LIVE TEST evaluation.', result: 'PASS' }
    });
    check('HR records a passing evaluation', ev.status === 200 && ev.body?.data?.result === 'PASS');
    check('HR selects the candidate', (await api('PATCH', `/applications/${appId}/select`, { token: hr })).body?.data?.status === 'SELECTED');

    const offerBody = { application_id: appId, designation: 'LIVE TEST QA Engineer', notes: 'LIVE TEST offer.', salary: 60000, offer_date: appDate(0), joining_date: appDate(30), expiry_date: appDate(10) };
    const offer = await api('POST', '/offers', { token: hr, body: offerBody });
    check('HR sends the offer', offer.status === 201 && offer.body?.data?.status === 'SENT', `HTTP ${offer.status}`);
    check('Duplicate offer is blocked', [400, 409].includes((await api('POST', '/offers', { token: hr, body: offerBody })).status));
    const candOffer = (await candStatus())?.offer;
    check('Candidate sees the offer details', candOffer?.status === 'SENT' && candOffer?.designation === 'LIVE TEST QA Engineer');

    const accept = await api('POST', `/candidate/applications/${appId}/accept-offer`, { token: cand });
    check('Candidate accepts the offer', accept.status === 200 && accept.body?.data?.application?.status === 'OFFER_ACCEPTED');
    const hrView = await api('GET', `/applications/${appId}`, { token: hr });
    check('HR sees the acceptance', hrView.body?.data?.status === 'OFFER_ACCEPTED' && hrView.body?.data?.offer?.status === 'ACCEPTED');
    check('HR marks the candidate hired', (await api('PATCH', `/applications/${appId}/hire`, { token: hr })).body?.data?.status === 'HIRED');
    check('Candidate sees HIRED', (await candStatus())?.application?.status === 'HIRED');

    const stats = await api('GET', '/dashboard/stats', { token: hr });
    check('HR dashboard reflects the hire', stats.body?.data?.hired >= 1 && (stats.body?.data?.recentActivity || []).some((a) => a.id === appId));

    // --- Tidy up: stop showing the test job to the public (nothing is deleted) ---
    check('HR closes the LIVE TEST job', (await api('PATCH', `/jobs/${job.id}/close`, { token: hr })).body?.data?.status === 'CLOSED');
    const after = await api('GET', '/jobs');
    check('Closed job is no longer on the public board', !(after.body?.data || []).some((j) => j.id === job.id));
}

main()
    .catch((err) => {
        failed++;
        console.log(`FAIL  Unexpected error: ${err.name === 'TimeoutError' ? 'request timed out' : err.message}${err.cause?.code ? ` (${err.cause.code})` : ''}`);
    })
    .finally(() => {
        console.log(`\nLIVE SMOKE TEST: ${passed} PASSED, ${failed} FAILED`);
        process.exitCode = failed ? 1 : 0;
    });
