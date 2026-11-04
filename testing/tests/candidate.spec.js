// Candidate portal: registration, profile, job board, applying, duplicates, privacy.

const { test, expect, loginCandidate, registerCandidateUI, logout } = require('../support/fixtures');

test.describe('Candidate portal', () => {
  test('two candidates register; candidate 1 completes profile, searches, applies and is blocked from duplicates', async ({ page, run, api, db }) => {
    test.setTimeout(120_000);
    const hr = await api.hrToken(run);
    const job = await api.createJob(run, hr, { skills: 'Cypress, Playwright, SQL', location: `Pune ${run.runId}`, employment_type: 'Part-time' });

    const c2 = await test.step('register candidate 2', async () => {
      const c = await registerCandidateUI(page, run, 'Candidate Two');
      await logout(page);
      return c;
    });
    const c1 = await test.step('register candidate 1', async () => {
      const c = await registerCandidateUI(page, run, 'Candidate One');
      await logout(page);
      return c;
    });

    await test.step('candidate 1 updates profile and it persists', async () => {
      await loginCandidate(page, c1.email, run.candidatePassword);
      await page.goto('/candidate/profile');
      await page.getByLabel('Phone').fill('+91 91234 56789');
      await page.getByLabel('Total experience').fill('5 years');
      await page.getByLabel('Education').fill('M.Tech Software Engineering');
      await page.getByLabel('Skills').fill('Playwright, Cypress, SQL, Node.js');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByText('Profile saved.')).toBeVisible();
      await page.reload();
      await expect(page.getByLabel('Education')).toHaveValue('M.Tech Software Engineering');
      await expect(page.getByLabel('Skills')).toHaveValue('Playwright, Cypress, SQL, Node.js');
      const [[row]] = await db.query('SELECT phone, experience, education, skills FROM candidates WHERE email = ?', [c1.email]);
      expect(row).toEqual({ phone: '+91 91234 56789', experience: '5 years', education: 'M.Tech Software Engineering', skills: 'Playwright, Cypress, SQL, Node.js' });
    });

    await test.step('profile validation rejects an invalid resume URL', async () => {
      await page.getByLabel(/Resume or portfolio link/).fill('javascript:alert(1)');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.locator('.invalid-feedback, .alert-danger').first()).toBeVisible();
      const [[row]] = await db.query('SELECT resume_url FROM candidates WHERE email = ?', [c1.email]);
      expect(row.resume_url).not.toBe('javascript:alert(1)');
    });

    await test.step('browse, search and filter jobs', async () => {
      await page.goto('/candidate/jobs');
      await page.getByLabel('All locations').selectOption(job.location);
      await expect(page.locator('article')).toHaveCount(1);
      await page.getByLabel('All locations').selectOption('');
      await page.getByLabel('All job types').selectOption('Part-time');
      await expect(page.locator('article', { hasText: job.title })).toBeVisible();
      await page.getByLabel('All job types').selectOption('');
      await page.getByLabel('Search jobs').fill(job.title);
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(page.locator('article')).toHaveCount(1);
      await page.getByLabel('Search jobs').fill('zz-nothing-matches-zz');
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(page.getByText('No open positions match')).toBeVisible();
    });

    const appId = await test.step('apply for the job', async () => {
      await page.goto(`/candidate/jobs/${job.id}/apply`);
      await page.getByRole('button', { name: 'Submit application' }).click();
      await expect(page.getByRole('heading', { name: 'Application submitted' })).toBeVisible();
      await page.getByRole('link', { name: 'Track application' }).click();
      return Number(page.url().match(/applications\/(\d+)/)[1]);
    });

    await test.step('application shows in dashboard and list', async () => {
      await page.goto('/candidate/dashboard');
      await expect(page.getByText(job.title).first()).toBeVisible();
      await page.goto('/candidate/applications');
      await expect(page.getByText(job.title).first()).toBeVisible();
      await page.goto('/candidate/jobs');
      await expect(page.locator('article', { hasText: job.title }).getByRole('link', { name: /Applied/ })).toBeVisible();
    });

    await test.step('duplicate application is rejected (UI and API)', async () => {
      await page.goto(`/candidate/jobs/${job.id}/apply`);
      await expect(page.getByText('You have already applied to this job')).toBeVisible();
      const token = await page.evaluate(() => localStorage.getItem('recruitflow_token'));
      expect((await api.post('/candidate/apply', { job_id: job.id }, { token })).status).toBe(409);
      const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM applications a JOIN candidates c ON c.id = a.candidate_id WHERE c.email = ? AND a.job_id = ?', [c1.email, job.id]);
      expect(n).toBe(1);
    });

    await test.step("candidate 1 cannot see candidate 2's application", async () => {
      const c2Login = await api.post('/auth/candidate/login', { email: c2.email, password: run.candidatePassword });
      const c2App = await api.post('/candidate/apply', { job_id: job.id }, { token: c2Login.body.token });
      expect(c2App.status).toBe(201);
      const otherId = c2App.body.data.id;

      const token = await page.evaluate(() => localStorage.getItem('recruitflow_token'));
      const r = await api.get(`/candidate/applications/${otherId}`, { token });
      expect([403, 404]).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toContain(c2.email);
      const mine = await api.get('/candidate/applications', { token });
      expect(mine.body.data.map((a) => a.id)).toEqual([appId]);

      await page.goto(`/candidate/applications/${otherId}`);
      await expect(page.getByText(c2.email)).toHaveCount(0);
      await expect(page.locator('.alert-danger, [role="alert"]').first()).toBeVisible();
    });
  });
});
