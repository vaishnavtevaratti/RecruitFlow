// Complete recruitment workflow through the real UI: HR and candidate take turns in one browser,
// signing in and out as the business process requires. MySQL is only read, to verify each stage.

const { test, expect, jobData, dateTime, loginHR, loginCandidate, registerCandidateUI, logout } = require('../support/fixtures');
const { createJobUI, confirmDialog, scheduleInterviewUI, evaluateUI, sendOfferUI } = require('../support/ui');

test('full recruitment workflow: job → application → interview → offer → hire', async ({ page, run, db }) => {
  test.setTimeout(240_000);
  const job = jobData(run, { title: `E2E ${run.runId} Workflow QA Engineer`, location: `Workflow City ${run.runId}` });
  const meetingLink = `https://meet.example.test/${run.runId}`;
  let jobId;
  let appId;
  let candidate;

  const appRow = async () => (await db.query('SELECT status FROM applications WHERE id = ?', [appId]))[0][0];
  const headerBadge = () => page.locator('.page-header .badge-rf').first();

  await test.step('A1-A3: HR signs in, creates and publishes a job', async () => {
    await loginHR(page, run);
    jobId = await createJobUI(page, job);
    await expect(page.locator('.page-header .badge-rf')).toHaveText(/DRAFT/i);
    await page.getByRole('button', { name: 'Publish' }).click();
    await confirmDialog(page, 'Publish');
    await expect(page.locator('.page-header .badge-rf')).toHaveText(/PUBLISHED/i);
    const [[row]] = await db.query('SELECT status, title FROM jobs WHERE id = ?', [jobId]);
    expect(row).toEqual({ status: 'PUBLISHED', title: job.title });
  });

  await test.step('A4: job is visible on the public careers page', async () => {
    await page.goto('/jobs/public');
    await expect(page.getByText(job.title)).toBeVisible();
    await logout(page);
  });

  await test.step('B5-B6: candidate registers and completes the profile', async () => {
    candidate = await registerCandidateUI(page, run, 'Workflow', { name: `E2E Workflow Candidate ${run.runId}`, skills: 'Playwright, JavaScript' });
    await page.goto('/candidate/profile');
    await page.getByLabel('Skills').fill('Playwright, JavaScript, SQL, REST APIs');
    await page.getByLabel(/Resume or portfolio link/).fill('https://portfolio.example.test/workflow');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Profile saved.')).toBeVisible();
  });

  await test.step('B7-B9: candidate finds the job and applies', async () => {
    await page.goto('/candidate/jobs');
    await page.getByLabel('Search jobs').fill(job.title);
    await page.getByRole('button', { name: 'Search' }).click();
    const card = page.locator('article', { hasText: job.title });
    await expect(card).toHaveCount(1);
    await card.getByRole('link', { name: /View & apply/ }).click();
    await expect(page.getByLabel(/^Skills/)).toHaveValue(/SQL/);
    await page.getByRole('button', { name: 'Submit application' }).click();
    await expect(page.getByRole('heading', { name: 'Application submitted' })).toBeVisible();
    const [[row]] = await db.query(
      'SELECT a.id, a.status FROM applications a JOIN candidates c ON c.id = a.candidate_id WHERE a.job_id = ? AND c.email = ?',
      [jobId, candidate.email]
    );
    expect(row.status).toBe('APPLIED');
    appId = row.id;
  });

  await test.step('B10: application appears in the candidate dashboard and list', async () => {
    await page.goto('/candidate/dashboard');
    await expect(page.getByText(job.title).first()).toBeVisible();
    await page.goto('/candidate/applications');
    await expect(page.getByText(job.title).first()).toBeVisible();
    await logout(page);
  });

  await test.step('C11-C14: HR finds and opens the new application', async () => {
    await loginHR(page, run);
    await page.goto('/applications');
    await page.getByLabel('Search applications').fill(candidate.name);
    await page.getByLabel('Search applications').press('Enter');
    await page.getByRole('link', { name: candidate.name }).click();
    await expect(page).toHaveURL(new RegExp(`/applications/${appId}$`));
    await expect(page.getByText(candidate.email)).toBeVisible();
    await expect(headerBadge()).toHaveText(/APPLIED/i);
  });

  await test.step('C15-C17: HR screens and shortlists', async () => {
    await page.getByRole('button', { name: 'Start screening' }).click();
    await expect(headerBadge()).toHaveText(/SCREENING/i);
    expect((await appRow()).status).toBe('SCREENING');
    await page.getByRole('button', { name: 'Shortlist candidate' }).click();
    await expect(headerBadge()).toHaveText(/SHORTLISTED/i);
    expect((await appRow()).status).toBe('SHORTLISTED');
  });

  await test.step('C18: candidate portal shows Shortlisted', async () => {
    await logout(page);
    await loginCandidate(page, candidate.email, run.candidatePassword);
    await page.goto(`/candidate/applications/${appId}`);
    await expect(headerBadge()).toHaveText('Shortlisted');
    await logout(page);
  });

  await test.step('D19-D20: HR schedules an interview', async () => {
    await loginHR(page, run);
    await page.goto(`/applications/${appId}`);
    await scheduleInterviewUI(page, { when: dateTime(4, '10:30'), type: 'Technical Round 1', link: meetingLink });
    await expect(headerBadge()).toHaveText(/INTERVIEW SCHEDULED/i);
    await expect(page.getByText('Technical Round 1')).toBeVisible();
    await page.goto('/interviews');
    await expect(page.getByText(candidate.name).first()).toBeVisible();
    const [[iv]] = await db.query('SELECT type, meeting_link, result FROM interviews WHERE application_id = ?', [appId]);
    expect(iv).toEqual({ type: 'Technical Round 1', meeting_link: meetingLink, result: 'PENDING' });
  });

  await test.step('D21-D22: candidate sees interview details', async () => {
    await logout(page);
    await loginCandidate(page, candidate.email, run.candidatePassword);
    await page.goto(`/candidate/applications/${appId}`);
    await expect(headerBadge()).toHaveText('Interview Scheduled');
    await expect(page.getByText('Technical Round 1')).toBeVisible();
    await expect(page.locator(`a[href="${meetingLink}"]`)).toBeVisible();
    await logout(page);
  });

  await test.step('D23-D26: HR records passing feedback and selects the candidate', async () => {
    await loginHR(page, run);
    await page.goto(`/applications/${appId}`);
    await evaluateUI(page, 'PASS', 'Strong automation skills, clear communication.');
    await expect(headerBadge()).toHaveText(/INTERVIEWED/i);
    await expect(page.getByText('Strong automation skills, clear communication.')).toBeVisible();
    await page.getByRole('button', { name: 'Select for hire' }).click();
    await confirmDialog(page, 'Select candidate');
    await expect(headerBadge()).toHaveText(/SELECTED/i);
    const [[iv]] = await db.query('SELECT result, overall_rating FROM interviews WHERE application_id = ?', [appId]);
    expect(iv).toEqual({ result: 'PASS', overall_rating: 8 });
    expect((await appRow()).status).toBe('SELECTED');
  });

  await test.step('E27-E28: HR sends an offer and sees its details', async () => {
    await sendOfferUI(page, { designation: 'QA Automation Engineer II', salary: 1450000, notes: 'Health insurance and annual bonus.' });
    await expect(headerBadge()).toHaveText(/OFFER SENT/i);
    await expect(page.getByText('QA Automation Engineer II')).toBeVisible();
    await expect(page.getByText('Health insurance and annual bonus.')).toBeVisible();
    await page.goto('/offers');
    await expect(page.getByText(candidate.name).first()).toBeVisible();
    const [[offer]] = await db.query('SELECT designation, salary, status FROM offers WHERE application_id = ?', [appId]);
    expect(offer).toEqual({ designation: 'QA Automation Engineer II', salary: '1450000.00', status: 'SENT' });
  });

  await test.step('E29-E32: candidate views and accepts the offer', async () => {
    await logout(page);
    await loginCandidate(page, candidate.email, run.candidatePassword);
    await page.goto(`/candidate/applications/${appId}`);
    await expect(headerBadge()).toHaveText('Offer Received');
    await expect(page.getByText('QA Automation Engineer II')).toBeVisible();
    await page.getByRole('button', { name: 'Accept offer' }).click();
    await confirmDialog(page, 'Accept offer');
    await expect(headerBadge()).toHaveText('Offer Accepted');
    await logout(page);
  });

  await test.step('E33-E35: HR sees acceptance and completes the hire', async () => {
    await loginHR(page, run);
    await page.goto(`/applications/${appId}`);
    await expect(headerBadge()).toHaveText(/OFFER ACCEPTED/i);
    await expect(page.getByText('Accepted by the candidate.')).toBeVisible();
    await page.getByRole('button', { name: 'Mark as hired' }).click();
    await confirmDialog(page, 'Mark as hired');
    await expect(headerBadge()).toHaveText(/HIRED/i);
    const [[final]] = await db.query(
      'SELECT a.status AS app, o.status AS offer FROM applications a JOIN offers o ON o.application_id = a.id WHERE a.id = ?',
      [appId]
    );
    expect(final).toEqual({ app: 'HIRED', offer: 'ACCEPTED' });
    await logout(page);
    await loginCandidate(page, candidate.email, run.candidatePassword);
    await page.goto(`/candidate/applications/${appId}`);
    await expect(headerBadge()).toHaveText('Hired');
  });
});
