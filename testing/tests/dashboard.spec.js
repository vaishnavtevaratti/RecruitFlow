// HR dashboard: loads, numbers match MySQL, widgets render, navigation works.

const { test, expect, loginHR } = require('../support/fixtures');

test.describe('HR dashboard', () => {
  test.beforeEach(async ({ page, run }) => {
    await loginHR(page, run);
  });

  test('statistics load from the API and match database counts', async ({ page, db }) => {
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/dashboard/stats')),
      page.reload()
    ]);
    expect(res.status()).toBe(200);
    const api = (await res.json()).data;

    const [[jobs]] = await db.query("SELECT SUM(status='PUBLISHED') AS open, SUM(status='DRAFT') AS draft, SUM(status='CLOSED') AS closed FROM jobs");
    const [[apps]] = await db.query("SELECT COUNT(*) AS total, SUM(status='HIRED') AS hired, SUM(status='REJECTED') AS rejected, SUM(status IN ('APPLIED','SCREENING')) AS awaiting, SUM(status='OFFER_ACCEPTED') AS ready FROM applications");
    const [[iv]] = await db.query("SELECT SUM(result='PENDING') AS pending FROM interviews");
    const [[cands]] = await db.query('SELECT COUNT(*) AS n FROM candidates');

    const cardOf = (label) => page.locator('.stat-card').filter({ has: page.locator('.stat-label').getByText(label, { exact: true }) });
    const card = (label) => cardOf(label).locator('.stat-value');
    const expected = {
      'Open Jobs': jobs.open,
      Applications: apps.total,
      'Awaiting Screening': apps.awaiting,
      'Interviews Pending': iv.pending,
      'Ready to Hire': apps.ready,
      Hired: apps.hired,
      Rejected: apps.rejected
    };
    for (const [label, value] of Object.entries(expected)) {
      await expect(card(label), label).toHaveText(String(Number(value || 0)));
    }
    await expect(cardOf('Open Jobs')).toContainText(`${Number(jobs.draft)} draft · ${Number(jobs.closed)} closed`);
    await expect(cardOf('Applications')).toContainText(`${cands.n} candidates`);
    expect(api.totalApplications).toBe(Number(apps.total));
  });

  test('pipeline, outcome and activity widgets render', async ({ page, db }) => {
    for (const heading of ['Pipeline by stage', 'Interview outcomes', 'Offer outcomes', 'Recent activity']) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
    const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM applications');
    const rows = page.locator('.activity-row');
    if (n > 0) await expect(rows).toHaveCount(Math.min(8, n));
    else await expect(page.getByText('No applications yet.')).toBeVisible();
  });

  test('every HR module is reachable from the sidebar', async ({ page }) => {
    const nav = page.getByRole('complementary', { name: 'Main navigation' });
    const modules = [
      ['Job Openings', /\/jobs$/, 'Job Openings'],
      ['Applications', /\/applications$/, 'Applications'],
      ['Candidates', /\/candidates$/, 'Candidate Talent Pool'],
      ['Interviews', /\/interviews$/, 'Interviews'],
      ['Offers & Hiring', /\/offers$/, 'Offers & Hiring'],
      ['Dashboard', /\/dashboard$/, 'Recruitment Dashboard']
    ];
    for (const [link, url, heading] of modules) {
      await nav.getByRole('link', { name: link }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
  });

  test('stat cards link to filtered lists', async ({ page }) => {
    await page.locator('.stat-card', { hasText: 'Open Jobs' }).click();
    await expect(page).toHaveURL(/\/jobs\?status=PUBLISHED/);
    await expect(page.getByLabel('Filter by status')).toHaveValue('PUBLISHED');
  });

  test('empty states show when nothing matches', async ({ page }) => {
    await page.goto('/jobs');
    await page.getByLabel('Search jobs').fill('zz-no-such-job-zz');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('No job openings found')).toBeVisible();

    await page.goto('/candidates');
    await page.getByLabel('Search candidates').fill('zz-no-such-candidate-zz');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText('No candidates found')).toBeVisible();
  });
});
