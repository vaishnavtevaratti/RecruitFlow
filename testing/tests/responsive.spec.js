// Responsive layout checks for every major screen at desktop, laptop, tablet and mobile widths.
// Screenshots are written to reports/screenshots/<width>/<screen>.png.

const path = require('path');
const { test, expect, loginHR, loginCandidate, date } = require('../support/fixtures');

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 }
];

/** Layout problems on the current screen: page overflow, controls pushed off-screen, tiny text. */
async function layoutProblems(page) {
  return page.evaluate(() => {
    const problems = [];
    const vw = window.innerWidth;
    if (document.documentElement.scrollWidth > vw) problems.push(`page overflow ${document.documentElement.scrollWidth}px > ${vw}px`);
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    // Inside a horizontal scroll container (tables, tab strips) off-screen items are reachable by scrolling
    const inScroller = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX)) return true;
      }
      return false;
    };
    // Every other control must be fully on-screen
    for (const el of document.querySelectorAll('main a, main button, main input, main select, main textarea, [role="dialog"] button, [role="dialog"] input')) {
      if (!visible(el) || inScroller(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) problems.push(`clipped control: ${(el.innerText || el.getAttribute('aria-label') || el.name || el.tagName).trim().slice(0, 40)} (${Math.round(r.left)}–${Math.round(r.right)})`);
    }
    for (const el of document.querySelectorAll('main p, main td, main label, main h1, main h2, main li, main dd')) {
      if (!visible(el) || !el.innerText.trim()) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 11) problems.push(`text under 11px (${size}px): ${el.innerText.trim().slice(0, 30)}`);
    }
    return [...new Set(problems)].slice(0, 15);
  });
}

for (const vp of VIEWPORTS) {
  test(`all major screens render cleanly at ${vp.name} ${vp.width}px`, async ({ page, run, api }, testInfo) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const hr = await api.hrToken(run);
    const job = await api.createJob(run, hr);
    const cand = await api.signupCandidate(run, `Responsive${vp.width}`);
    const appId = (await api.post('/candidate/apply', { job_id: job.id }, { token: cand.token })).body.data.id;
    await api.advance(appId, hr, 'select');
    await api.post('/offers', { application_id: appId, designation: 'Responsive QA', salary: 800000, offer_date: date(0), joining_date: date(30), expiry_date: date(10) }, { token: hr });

    const failures = [];
    const check = async (name, url) => {
      if (url) await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      const problems = await layoutProblems(page);
      if (problems.length) failures.push(`${name}: ${problems.join('; ')}`);
      const file = path.join(__dirname, '..', 'reports', 'screenshots', String(vp.width), `${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
    };

    await check('public-jobs', '/jobs/public');
    await check('candidate-signup', '/candidate/signup');
    await check('staff-login', '/login');

    await loginHR(page, run);
    for (const [name, url] of [
      ['hr-dashboard', '/dashboard'],
      ['hr-jobs', '/jobs'],
      ['hr-job-form', '/jobs/new'],
      ['hr-job-details', `/jobs/${job.id}`],
      ['hr-applications', '/applications'],
      ['hr-application-details', `/applications/${appId}`],
      ['hr-candidates', '/candidates'],
      ['hr-interviews', '/interviews'],
      ['hr-offers', '/offers']
    ]) await check(name, url);

    await test.step('navigation adapts: sidebar inline on wide screens, toggle on narrow ones', async () => {
      const toggle = page.getByRole('button', { name: 'Toggle navigation' });
      const signOut = page.getByRole('button', { name: 'Sign Out' });
      if (vp.width >= 992) {
        await expect(signOut).toBeInViewport();
      } else {
        await expect(signOut).not.toBeInViewport();
        await toggle.click();
        await expect(signOut).toBeInViewport();
        await page.keyboard.press('Escape');
        await page.goto('/dashboard');
      }
    });

    await test.step('modals fit the viewport', async () => {
      // The application has an active offer (reject is correctly hidden), so use the job's close dialog
      await page.goto(`/jobs/${job.id}`);
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const box = await dialog.locator('.modal-content, .modal-dialog, [class*="modal"]').first().boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      await check('hr-confirm-dialog');
      await dialog.getByRole('button', { name: 'Cancel' }).click();
    });

    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await loginCandidate(page, cand.email, run.candidatePassword);
    for (const [name, url] of [
      ['candidate-dashboard', '/candidate/dashboard'],
      ['candidate-jobs', '/candidate/jobs'],
      ['candidate-applications', '/candidate/applications'],
      ['candidate-application-offer', `/candidate/applications/${appId}`],
      ['candidate-profile', '/candidate/profile']
    ]) await check(name, url);

    await testInfo.attach(`layout-${vp.width}`, { body: failures.join('\n') || 'no layout problems', contentType: 'text/plain' });
    expect(failures, `Layout problems at ${vp.width}px`).toEqual([]);
  });
}
