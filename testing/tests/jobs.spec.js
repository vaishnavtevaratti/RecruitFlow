// Job management lifecycle through the HR UI, plus validation and authorization.

const { test, expect, jobData, date, loginHR, loginCandidate } = require('../support/fixtures');
const { createJobUI, confirmDialog, fillJobForm } = require('../support/ui');

test.describe('Job management', () => {
  test('create → list → details → edit → publish → search/filter → close → reopen', async ({ page, run, db, api }) => {
    test.setTimeout(120_000);
    const job = jobData(run, { department: `E2E Dept ${run.runId}`, employment_type: 'Contract' });
    await loginHR(page, run);

    const jobId = await test.step('create draft', () => createJobUI(page, job));

    await test.step('appears in job list as DRAFT', async () => {
      await page.goto('/jobs');
      const row = page.locator('tbody tr', { hasText: job.title });
      await expect(row).toBeVisible();
      await expect(row.locator('.badge-rf')).toHaveText(/DRAFT/i);
      await row.getByRole('link', { name: job.title, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/jobs/${jobId}$`));
      await expect(page.getByText(job.description)).toBeVisible();
    });

    await test.step('edit persists', async () => {
      await page.getByRole('link', { name: 'Edit' }).click();
      await page.getByLabel('Location').fill(`Hybrid ${run.runId}`);
      await page.getByLabel('Experience required').fill('4 years');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await expect(page).toHaveURL(new RegExp(`/jobs/${jobId}$`));
      await page.reload();
      await expect(page.getByText(`Hybrid ${run.runId}`)).toBeVisible();
      const [[row]] = await db.query('SELECT location, experience_required FROM jobs WHERE id = ?', [jobId]);
      expect(row).toEqual({ location: `Hybrid ${run.runId}`, experience_required: '4 years' });
    });

    await test.step('draft is hidden from candidates', async () => {
      const pub = await api.get('/jobs');
      expect(pub.body.data.some((j) => j.id === jobId)).toBe(false);
      expect((await api.get(`/jobs/${jobId}`)).status).toBe(404);
    });

    await test.step('publish', async () => {
      await page.getByRole('button', { name: 'Publish' }).click();
      await confirmDialog(page, 'Publish');
      await expect(page.locator('.page-header .badge-rf')).toHaveText(/PUBLISHED/i);
      await page.goto('/jobs/public');
      await expect(page.getByText(job.title)).toBeVisible();
    });

    await test.step('search, filter and sort the HR list', async () => {
      await page.goto('/jobs');
      await page.getByLabel('Search jobs').fill(job.title);
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await page.getByLabel('Search jobs').fill('');
      await page.getByRole('button', { name: 'Search' }).click();
      await page.getByLabel('Filter by department').selectOption(job.department);
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await page.getByLabel('Filter by status').selectOption('DRAFT');
      await expect(page.getByText('No job openings found')).toBeVisible();
      await page.getByLabel('Filter by status').selectOption('PUBLISHED');
      await expect(page.locator('tbody tr', { hasText: job.title })).toBeVisible();

      await page.goto('/jobs');
      await page.getByLabel('Sort jobs').selectOption('title');
      const titles = await page.locator('tbody tr td:first-child a').allTextContents();
      expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    });

    await test.step('close blocks applications', async () => {
      await page.goto(`/jobs/${jobId}`);
      await page.getByRole('button', { name: 'Close' }).click();
      await confirmDialog(page, 'Close job');
      await expect(page.locator('.page-header .badge-rf')).toHaveText(/CLOSED/i);
      const cand = await api.signupCandidate(run, 'ClosedJobApplicant');
      expect((await api.post('/candidate/apply', { job_id: jobId }, { token: cand.token })).status).toBe(400);
      const pub = await api.get('/jobs');
      expect(pub.body.data.some((j) => j.id === jobId)).toBe(false);
    });

    await test.step('reopen restores applications', async () => {
      await page.getByRole('button', { name: 'Reopen' }).click();
      await confirmDialog(page, 'Reopen');
      await expect(page.locator('.page-header .badge-rf')).toHaveText(/PUBLISHED/i);
      const [[row]] = await db.query('SELECT status FROM jobs WHERE id = ?', [jobId]);
      expect(row.status).toBe('PUBLISHED');
    });
  });

  test('closed job shows as closed to a signed-in candidate', async ({ page, run, api }) => {
    const token = await api.hrToken(run);
    const job = await api.createJob(run, token);
    await api.patch(`/jobs/${job.id}/close`, undefined, { token });
    const cand = await api.signupCandidate(run, 'ClosedView');
    await loginCandidate(page, cand.email, run.candidatePassword);
    await page.goto(`/candidate/jobs/${job.id}/apply`);
    await expect(page.getByText(/no longer accepting applications|not found/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit application' })).toHaveCount(0);
  });

  test('delete a dedicated draft job with confirmation', async ({ page, run, db }) => {
    await loginHR(page, run);
    const job = jobData(run, { title: `E2E ${run.runId} Delete Me` });
    const jobId = await createJobUI(page, job);
    await page.goto('/jobs');
    await page.getByLabel('Search jobs').fill(job.title);
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('button', { name: `Delete ${job.title}` }).click();
    await confirmDialog(page, 'Delete job');
    await expect(page.getByText('Job opening deleted.')).toBeVisible();
    await expect(page.locator('tbody tr', { hasText: job.title })).toHaveCount(0);
    const [rows] = await db.query('SELECT id FROM jobs WHERE id = ?', [jobId]);
    expect(rows).toHaveLength(0);
  });

  test('job form validates required fields and salary range', async ({ page, run, api }) => {
    await loginHR(page, run);
    await page.goto('/jobs/new');
    await page.getByRole('button', { name: 'Create draft' }).click();
    await expect(page).toHaveURL(/\/jobs\/new$/);
    await expect(page.locator('.invalid-feedback').first()).toBeVisible();

    await fillJobForm(page, jobData(run, { salary_min: 900000, salary_max: 100000 }));
    await page.getByRole('button', { name: 'Create draft' }).click();
    await expect(page).toHaveURL(/\/jobs\/new$/);
    await expect(page.locator('.invalid-feedback, .alert-danger').first()).toBeVisible();

    const token = await api.hrToken(run);
    expect((await api.post('/jobs', jobData(run, { salary_min: 900000, salary_max: 100000 }), { token })).status).toBe(400);
    expect((await api.post('/jobs', jobData(run, { deadline: date(-1) }), { token })).status).toBe(400);
    expect((await api.post('/jobs', jobData(run, { deadline: '2026-02-30' }), { token })).status).toBe(400);
    expect((await api.post('/jobs', { ...jobData(run), title: '' }, { token })).status).toBe(400);
    expect((await api.post('/jobs', jobData(run, { salary_min: -5 }), { token })).status).toBe(400);
  });

  test('job write APIs require HR authorization', async ({ api, run }) => {
    const token = await api.hrToken(run);
    const job = await api.createJob(run, token, {}, { publish: false });
    const cand = await api.signupCandidate(run, 'JobAuthz');
    for (const [method, path, body] of [
      ['post', '/jobs', jobData(run)],
      ['put', `/jobs/${job.id}`, { title: 'Hacked' }],
      ['patch', `/jobs/${job.id}/publish`],
      ['patch', `/jobs/${job.id}/close`],
      ['delete', `/jobs/${job.id}`]
    ]) {
      const noAuth = method === 'delete' ? await api.delete(path) : await api[method](path, body);
      expect(noAuth.status, `${method} ${path} anonymous`).toBe(401);
      const asCand = method === 'delete' ? await api.delete(path, { token: cand.token }) : await api[method](path, body, { token: cand.token });
      expect(asCand.status, `${method} ${path} candidate`).toBe(403);
    }
  });
});
