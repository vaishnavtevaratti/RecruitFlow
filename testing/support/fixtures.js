// Shared Playwright fixtures and helpers for RecruitFlow.

const fs = require('fs');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { test: base, expect, request: pwRequest } = require('@playwright/test');
const env = require('./env');

let counter = 0;

/** Minimal JSON API client against the isolated test API. */
class Api {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async call(method, path, { token, body, headers = {} } = {}) {
    const res = await this.ctx.fetch(`${env.API_URL}${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      data: body
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status(), body: json };
  }

  get(path, opts) { return this.call('GET', path, opts); }
  post(path, body, opts = {}) { return this.call('POST', path, { ...opts, body }); }
  put(path, body, opts = {}) { return this.call('PUT', path, { ...opts, body }); }
  patch(path, body, opts = {}) { return this.call('PATCH', path, { ...opts, body }); }
  delete(path, opts) { return this.call('DELETE', path, opts); }

  async hrToken(run) {
    const r = await this.post('/auth/login', { email: run.hrEmail, password: run.hrPassword });
    expect(r.status, 'HR API login').toBe(200);
    return r.body.token;
  }

  async signupCandidate(run, label, extra = {}) {
    const email = candidateEmail(run, label);
    const r = await this.post('/auth/candidate/signup', {
      name: `E2E ${label}`,
      email,
      password: run.candidatePassword,
      phone: '+91 90000 00001',
      education: 'B.Tech Computer Science',
      skills: 'JavaScript, React, SQL',
      experience: '3 years',
      ...extra
    });
    expect(r.status, `signup ${label}`).toBe(201);
    return { email, token: r.body.token, user: r.body.user, candidate: r.body.candidate };
  }

  /** Creates (and by default publishes) a job through the HR API; returns the job row. */
  async createJob(run, token, overrides = {}, { publish = true } = {}) {
    const r = await this.post('/jobs', jobData(run, overrides), { token });
    expect(r.status, 'create job').toBe(201);
    if (!publish) return r.body.data;
    const p = await this.patch(`/jobs/${r.body.data.id}/publish`, undefined, { token });
    expect(p.status, 'publish job').toBe(200);
    return p.body.data;
  }

  /** Moves an application through the API up to the requested stage (test preconditions only). */
  async advance(appId, token, until) {
    const steps = ['screen', 'shortlist', 'interview', 'pass', 'select'];
    let interviewId = null;
    for (const step of steps.slice(0, steps.indexOf(until) + 1)) {
      if (step === 'screen' || step === 'shortlist' || step === 'select') {
        const r = await this.patch(`/applications/${appId}/${step}`, undefined, { token });
        expect(r.status, step).toBe(200);
      } else if (step === 'interview') {
        const ivs = await this.get('/interviews/interviewers', { token });
        const r = await this.post('/interviews', {
          application_id: appId,
          interviewer_id: ivs.body.data[0].id,
          scheduled_at: dateTime(3),
          type: 'Technical Interview'
        }, { token });
        expect(r.status, 'schedule').toBe(201);
        interviewId = r.body.data.id;
      } else if (step === 'pass') {
        const r = await this.put(`/interviews/${interviewId}/evaluate`, evaluation('PASS'), { token });
        expect(r.status, 'evaluate').toBe(200);
      }
    }
    return { interviewId };
  }
}

function readRun() {
  return JSON.parse(fs.readFileSync(env.RUN_FILE, 'utf8'));
}

function uniq(run, label) {
  counter += 1;
  return `E2E ${run.runId} ${label} ${counter}${crypto.randomBytes(2).toString('hex')}`;
}

function candidateEmail(run, label) {
  return `e2e.${run.runId}.${label.toLowerCase().replace(/[^a-z0-9]+/g, '')}.${crypto.randomBytes(3).toString('hex')}@example.test`;
}

function date(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dateTime(daysFromToday, time = '11:00') {
  return `${date(daysFromToday)}T${time}`;
}

function jobData(run, overrides = {}) {
  return {
    title: uniq(run, 'Engineer'),
    department: 'QA Automation',
    description: 'Automated end-to-end test job.',
    skills: 'Playwright, JavaScript, SQL',
    experience_required: '2 years',
    location: `E2E City ${run.runId}`,
    employment_type: 'Full-time',
    salary_min: 600000,
    salary_max: 900000,
    deadline: date(30),
    ...overrides
  };
}

function evaluation(result) {
  return { technical_rating: 8, communication_rating: 7, problem_solving_rating: 8, overall_rating: 8, feedback: `Automated ${result} evaluation.`, result };
}

/** Signs a JWT with the server's secret (HS256) — used only to build an already-expired token. */
function signJwt(payload, expiresInSeconds) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ ...payload, iat: now - 3600, exp: now + expiresInSeconds });
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

// ---- UI helpers ------------------------------------------------------------

async function loginHR(page, run) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(run.hrEmail);
  await page.getByLabel('Password').fill(run.hrPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function loginCandidate(page, email, password) {
  await page.goto('/candidate/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/candidate\/dashboard$/);
}

async function registerCandidateUI(page, run, label, profile = {}) {
  const email = candidateEmail(run, label);
  const data = {
    name: `E2E ${label}`,
    phone: '+91 98765 43210',
    experience: '3 years',
    education: 'B.Tech Computer Science',
    skills: 'JavaScript, React, SQL',
    ...profile
  };
  await page.goto('/candidate/signup');
  await page.getByLabel('Full name').fill(data.name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill(run.candidatePassword);
  await page.getByLabel('Confirm password').fill(run.candidatePassword);
  await page.getByLabel('Phone').fill(data.phone);
  await page.getByLabel('Total experience').fill(data.experience);
  await page.getByLabel('Education').fill(data.education);
  await page.getByLabel('Skills').fill(data.skills);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/candidate\/dashboard$/);
  return { email, ...data };
}

async function logout(page) {
  const signOut = page.getByRole('button', { name: 'Sign Out' });
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  // Public pages have no app shell; the role home page does
  if (!(await signOut.count())) {
    await page.goto('/');
    await expect(toggle.or(signOut).first()).toBeVisible();
  }
  // The off-canvas sidebar counts as "visible" while translated off-screen, so test the viewport
  const onScreen = await signOut.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.right > 0 && r.left < window.innerWidth;
  });
  if (!onScreen) {
    await toggle.click();
    await expect(signOut).toBeInViewport();
  }
  await signOut.click();
  await expect(page).toHaveURL(/\/(candidate\/)?login/);
  expect(await page.evaluate(() => localStorage.getItem('recruitflow_token'))).toBeNull();
}

/** Fails if the page has horizontal overflow. */
async function expectNoHorizontalOverflow(page, label) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(scrollWidth, `${label}: page wider than viewport`).toBeLessThanOrEqual(innerWidth);
}

// ---- Fixtures --------------------------------------------------------------

const test = base.extend({
  run: [async ({}, use) => use(readRun()), { scope: 'worker' }],

  db: [async ({}, use) => {
    const pool = mysql.createPool({ ...env.DB_CONFIG, connectionLimit: 2 });
    await use(pool);
    await pool.end();
  }, { scope: 'worker' }],

  api: async ({}, use) => {
    const ctx = await pwRequest.newContext();
    await use(new Api(ctx));
    await ctx.dispose();
  },

  /**
   * Records browser problems for every test. Fails the test on uncaught JS errors,
   * console errors, 5xx API responses and failed requests. 4xx responses are logged
   * (negative tests trigger them on purpose) and shown in the summary report.
   */
  page: async ({ page }, use, testInfo) => {
    const issues = { consoleErrors: [], pageErrors: [], serverErrors: [], failedRequests: [], clientErrors: [] };
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      // Browsers log every non-2xx fetch; those are classified by status below instead
      if (/Failed to load resource: the server responded with a status of 4\d\d/.test(text)) return;
      issues.consoleErrors.push(text);
    });
    page.on('pageerror', (err) => issues.pageErrors.push(err.message));
    page.on('requestfailed', (req) => {
      const failure = req.failure()?.errorText || '';
      if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(failure)) return; // navigation away / cancelled
      issues.failedRequests.push(`${req.method()} ${req.url()} — ${failure}`);
    });
    page.on('response', (res) => {
      const line = `${res.request().method()} ${res.url()} → ${res.status()}`;
      if (res.status() >= 500) issues.serverErrors.push(line);
      else if (res.status() >= 400) issues.clientErrors.push(line);
    });

    await use(page);

    await testInfo.attach('browser-issues', { body: JSON.stringify(issues, null, 2), contentType: 'application/json' });
    const fatal = [...issues.pageErrors, ...issues.consoleErrors, ...issues.serverErrors, ...issues.failedRequests];
    expect(fatal, 'Browser console errors, uncaught exceptions, 5xx responses or failed requests').toEqual([]);
  }
});

module.exports = {
  test,
  expect,
  env,
  uniq,
  candidateEmail,
  date,
  dateTime,
  jobData,
  evaluation,
  signJwt,
  loginHR,
  loginCandidate,
  registerCandidateUI,
  logout,
  expectNoHorizontalOverflow
};
