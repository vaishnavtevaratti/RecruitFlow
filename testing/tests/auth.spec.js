// Authentication & authorization: HR and candidate portals, browser + API.

const { test, expect, loginHR, loginCandidate, registerCandidateUI, logout, signJwt } = require('../support/fixtures');

test.describe('HR authentication', () => {
  test('valid HR login reaches dashboard and logout clears the session @smoke', async ({ page, run }) => {
    await loginHR(page, run);
    await expect(page.getByRole('heading', { name: 'Recruitment Dashboard' })).toBeVisible();
    await logout(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('invalid HR password is rejected in the UI and API', async ({ page, run, api }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(run.hrEmail);
    await page.getByLabel('Password').fill('definitely-wrong-password');
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/auth/login')),
      page.getByRole('button', { name: 'Sign in', exact: true }).click()
    ]);
    expect(res.status()).toBe(401);
    await expect(page.getByText('Invalid email or password.')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    const unknown = await api.post('/auth/login', { email: 'nobody@recruitflow.test', password: 'whatever123' });
    expect(unknown.status).toBe(401);
    const missing = await api.post('/auth/login', { email: run.hrEmail });
    expect(missing.status).toBe(400);
  });

  test('HR routes redirect to login without a session and the API returns 401', async ({ page, api }) => {
    for (const route of ['/dashboard', '/jobs', '/applications', '/candidates', '/interviews', '/offers']) {
      await page.goto(route);
      await expect(page, route).toHaveURL(/\/login/);
    }
    for (const path of ['/dashboard/stats', '/applications', '/candidates', '/offers', '/interviews']) {
      expect((await api.get(path)).status, path).toBe(401);
    }
  });

  test('tampered and expired tokens are rejected and the UI asks to sign in again', async ({ page, run, api }) => {
    const hr = await api.post('/auth/login', { email: run.hrEmail, password: run.hrPassword });
    const { user, token } = hr.body;
    const tampered = token.slice(0, -4) + (token.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    const expired = signJwt({ id: user.id, email: user.email, role: user.role, name: user.name }, -60);

    expect((await api.get('/dashboard/stats', { token: tampered })).status).toBe(401);
    expect((await api.get('/dashboard/stats', { token: expired })).status).toBe(401);
    expect((await api.get('/dashboard/stats', { token: 'not-a-jwt' })).status).toBe(401);

    await page.goto('/login');
    await page.evaluate(([t, u]) => {
      localStorage.setItem('recruitflow_token', t);
      localStorage.setItem('recruitflow_user', JSON.stringify(u));
    }, [expired, user]);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('recruitflow_token'))).toBeNull();
  });

  test('candidate account cannot sign in through the HR portal', async ({ page, run, api }) => {
    const cand = await api.signupCandidate(run, 'HrPortalAttempt');
    await page.goto('/login');
    await page.getByLabel('Email address').fill(cand.email);
    await page.getByLabel('Password').fill(run.candidatePassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Candidate accounts must sign in through the candidate portal.')).toBeVisible();
    expect((await api.post('/auth/login', { email: cand.email, password: run.candidatePassword })).status).toBe(403);
  });
});

test.describe('Candidate authentication', () => {
  test('registration logs the candidate in and logout ends the session @smoke', async ({ page, run }) => {
    const c = await registerCandidateUI(page, run, 'Register');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await logout(page);
    await loginCandidate(page, c.email, run.candidatePassword);
    await logout(page);
  });

  test('duplicate registration is prevented', async ({ page, run, api }) => {
    const c = await api.signupCandidate(run, 'Duplicate');
    await page.goto('/candidate/signup');
    await page.getByLabel('Full name').fill('Duplicate Person');
    await page.getByLabel('Email').fill(c.email);
    await page.getByLabel(/^Password/).fill(run.candidatePassword);
    await page.getByLabel('Confirm password').fill(run.candidatePassword);
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/auth/candidate/signup')),
      page.getByRole('button', { name: 'Create account' }).click()
    ]);
    expect(res.status()).toBe(409);
    await expect(page.locator('.alert-danger, [role="alert"]').first()).toBeVisible();
    await expect(page).toHaveURL(/\/candidate\/signup/);
  });

  test('signup form validates required fields and password rules', async ({ page, run, api }) => {
    await page.goto('/candidate/signup');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/candidate\/signup/);
    await expect(page.locator('.invalid-feedback').first()).toBeVisible();

    await page.getByLabel('Full name').fill('Short Password');
    await page.getByLabel('Email').fill('short.password@example.test');
    await page.getByLabel(/^Password/).fill('Ab1!');
    await page.getByLabel('Confirm password').fill('Ab1!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Use at least 8 characters.')).toBeVisible();

    const weak = await api.post('/auth/candidate/signup', { name: 'Weak', email: `weak.${run.runId}@example.test`, password: 'short' });
    expect(weak.status).toBe(400);
    const badEmail = await api.post('/auth/candidate/signup', { name: 'Bad', email: 'not-an-email', password: run.candidatePassword });
    expect(badEmail.status).toBe(400);
  });

  test('invalid candidate credentials are rejected', async ({ page, run, api }) => {
    const c = await api.signupCandidate(run, 'WrongPass');
    await page.goto('/candidate/login');
    await page.getByLabel('Email address').fill(c.email);
    await page.getByLabel('Password').fill('wrong-password-123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.locator('.alert-danger, [role="alert"]').first()).toBeVisible();
    await expect(page).toHaveURL(/\/candidate\/login/);
    expect((await api.post('/auth/candidate/login', { email: c.email, password: 'wrong-password-123' })).status).toBe(401);
    // Staff accounts cannot use the candidate login
    expect((await api.post('/auth/candidate/login', { email: run.hrEmail, password: run.hrPassword })).status).toBeGreaterThanOrEqual(400);
  });

  test('candidate routes require a candidate session', async ({ page }) => {
    for (const route of ['/candidate/dashboard', '/candidate/jobs', '/candidate/applications', '/candidate/profile']) {
      await page.goto(route);
      await expect(page, route).toHaveURL(/\/(candidate\/)?login/);
    }
  });

  test('candidate cannot open HR pages or call HR APIs', async ({ page, run, api }) => {
    const c = await api.signupCandidate(run, 'NoHrAccess');
    await loginCandidate(page, c.email, run.candidatePassword);
    for (const route of ['/dashboard', '/jobs', '/applications', '/candidates', '/offers']) {
      await page.goto(route);
      await expect(page.getByText('Access restricted'), route).toBeVisible();
    }
    for (const [method, path] of [['get', '/dashboard/stats'], ['get', '/applications'], ['get', '/candidates'], ['get', '/offers'], ['get', '/interviews'], ['post', '/jobs'], ['patch', '/applications/1/screen']]) {
      const r = await api[method](path, method === 'get' ? { token: c.token } : undefined, method === 'get' ? undefined : { token: c.token });
      expect(r.status, `${method.toUpperCase()} ${path}`).toBe(403);
    }
  });

  test('HR cannot use candidate-only APIs', async ({ api, run }) => {
    const token = await api.hrToken(run);
    expect((await api.get('/candidate/applications', { token })).status).toBe(403);
    expect((await api.post('/candidate/apply', { job_id: 1 }, { token })).status).toBe(403);
  });
});
