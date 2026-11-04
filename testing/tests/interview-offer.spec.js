// Interview and offer actions through the UI. Preconditions (getting an application to the
// right stage) are created through the real HR API; the action under test uses the browser.

const { test, expect, date, dateTime, evaluation, loginHR, loginCandidate } = require('../support/fixtures');
const { confirmDialog, scheduleInterviewUI, evaluateUI, sendOfferUI } = require('../support/ui');

async function applicationAt(api, run, label, until) {
  const hr = await api.hrToken(run);
  const job = await api.createJob(run, hr);
  const cand = await api.signupCandidate(run, label);
  const app = await api.post('/candidate/apply', { job_id: job.id }, { token: cand.token });
  expect(app.status).toBe(201);
  const { interviewId } = until ? await api.advance(app.body.data.id, hr, until) : {};
  return { hr, job, cand, appId: app.body.data.id, interviewId };
}

const badge = (page) => page.locator('.page-header .badge-rf').first();

test.describe('Interviews', () => {
  test('reschedule a pending interview', async ({ page, run, api, db }) => {
    const { appId, interviewId } = await applicationAt(api, run, 'Reschedule', 'interview');
    await loginHR(page, run);
    await page.goto(`/applications/${appId}`);
    await page.getByRole('button', { name: 'Reschedule' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reschedule interview' });
    await dialog.getByLabel('Date & time').fill(dateTime(9, '15:45'));
    await dialog.getByRole('button', { name: 'Save new time' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Interview rescheduled.')).toBeVisible();
    const [[iv]] = await db.query('SELECT scheduled_at, result FROM interviews WHERE id = ?', [interviewId]);
    // 15:45 in Asia/Kolkata (UTC+05:30) is stored as 10:15 UTC
    expect(iv).toEqual({ scheduled_at: `${date(9)} 10:15:00`, result: 'PENDING' });
  });

  test('cancel a pending interview returns the candidate to the shortlist', async ({ page, run, api, db }) => {
    const { appId, interviewId } = await applicationAt(api, run, 'CancelIv', 'interview');
    await loginHR(page, run);
    await page.goto(`/applications/${appId}`);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await confirmDialog(page, 'Cancel interview');
    await expect(badge(page)).toHaveText(/SHORTLISTED/i);
    await expect(page.getByText('No interviews scheduled yet.')).toBeVisible();
    const [rows] = await db.query('SELECT id FROM interviews WHERE id = ?', [interviewId]);
    expect(rows).toHaveLength(0);
    const [[app]] = await db.query('SELECT status FROM applications WHERE id = ?', [appId]);
    expect(app.status).toBe('SHORTLISTED');
  });

  test('past interview dates are rejected (UI and API)', async ({ page, run, api }) => {
    const { appId, hr } = await applicationAt(api, run, 'PastDate', 'shortlist');
    await loginHR(page, run);
    await page.goto(`/applications/${appId}`);
    await scheduleInterviewUI(page, { when: dateTime(-1) });
    await expect(page.getByRole('dialog').getByText('Interview must be scheduled in the future.')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(badge(page)).toHaveText(/SHORTLISTED/i);

    const ivs = await api.get('/interviews/interviewers', { token: hr });
    const body = { application_id: appId, interviewer_id: ivs.body.data[0].id, type: 'Technical' };
    expect((await api.post('/interviews', { ...body, scheduled_at: dateTime(-1) }, { token: hr })).status).toBe(400);
    expect((await api.post('/interviews', { ...body, scheduled_at: 'tomorrow at noon' }, { token: hr })).status).toBe(400);
    expect((await api.post('/interviews', { ...body, scheduled_at: '2027-02-30T10:00' }, { token: hr })).status).toBe(400);
  });

  test('failed interview blocks selection and offers; candidate sees the result', async ({ page, run, api, db }) => {
    const { appId, hr, cand } = await applicationAt(api, run, 'FailIv', 'interview');
    await loginHR(page, run);
    await page.goto(`/applications/${appId}`);
    await evaluateUI(page, 'FAIL', 'Did not meet the bar for testing depth.');
    await expect(badge(page)).toHaveText(/INTERVIEWED/i);
    await expect(page.getByText('The candidate did not pass the interview and cannot be selected.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select for hire' })).toHaveCount(0);

    expect((await api.patch(`/applications/${appId}/select`, undefined, { token: hr })).status).toBe(400);
    const offer = await api.post('/offers', { application_id: appId, salary: 100000, offer_date: date(0), joining_date: date(20), expiry_date: date(10) }, { token: hr });
    expect(offer.status).toBe(400);
    const [[row]] = await db.query('SELECT a.status, i.result FROM applications a JOIN interviews i ON i.application_id = a.id WHERE a.id = ?', [appId]);
    expect(row).toEqual({ status: 'INTERVIEWED', result: 'FAIL' });

    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await loginCandidate(page, cand.email, run.candidatePassword);
    await page.goto(`/candidate/applications/${appId}`);
    await expect(page.getByText('Not Passed')).toBeVisible();
  });

  test('invalid interview transitions are rejected by the API', async ({ api, run }) => {
    const applied = await applicationAt(api, run, 'NotShortlisted');
    const ivs = await api.get('/interviews/interviewers', { token: applied.hr });
    const schedule = await api.post('/interviews', { application_id: applied.appId, interviewer_id: ivs.body.data[0].id, scheduled_at: dateTime(3), type: 'Tech' }, { token: applied.hr });
    expect(schedule.status, 'schedule before shortlist').toBe(400);

    const done = await applicationAt(api, run, 'EvalTwice', 'pass');
    expect((await api.put(`/interviews/${done.interviewId}/evaluate`, evaluation('FAIL'), { token: done.hr })).status, 'evaluate twice').toBe(400);
    expect((await api.patch(`/interviews/${done.interviewId}/reschedule`, { scheduled_at: dateTime(5) }, { token: done.hr })).status, 'reschedule evaluated').toBe(400);
    expect((await api.patch(`/interviews/${done.interviewId}/cancel`, undefined, { token: done.hr })).status, 'cancel evaluated').toBe(400);

    const pending = await applicationAt(api, run, 'BadRating', 'interview');
    expect((await api.put(`/interviews/${pending.interviewId}/evaluate`, { ...evaluation('PASS'), overall_rating: 11 }, { token: pending.hr })).status, 'rating 11').toBe(400);
    expect((await api.put(`/interviews/${pending.interviewId}/evaluate`, { ...evaluation('PASS'), result: 'MAYBE' }, { token: pending.hr })).status, 'bad result').toBe(400);
    expect((await api.put(`/interviews/${pending.interviewId}/evaluate`, evaluation('PASS'), { token: pending.cand.token })).status, 'candidate evaluates').toBe(403);
  });
});

test.describe('Interview time zone', () => {
  // A viewer in New York must still see the IST time HR entered
  test.use({ timezoneId: 'America/New_York' });

  test('times are stored in UTC and shown in Asia/Kolkata whatever the browser time zone', async ({ page, run, api, db }) => {
    const { appId, cand } = await applicationAt(api, run, 'TimeZone', 'shortlist');
    expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('America/New_York');

    await loginHR(page, run);
    await page.goto(`/applications/${appId}`);
    await scheduleInterviewUI(page, { when: dateTime(6, '11:00'), type: 'Time Zone Round' });
    await expect(page.locator('.page-header .badge-rf').first()).toHaveText(/INTERVIEW SCHEDULED/i);

    const [[iv]] = await db.query('SELECT scheduled_at FROM interviews WHERE application_id = ?', [appId]);
    expect(iv.scheduled_at, '11:00 IST stored as 05:30 UTC').toBe(`${date(6)} 05:30:00`);
    await expect(page.getByText(/11:00 AM GMT\+5:30/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Reschedule' }).click();
    await expect(page.getByRole('dialog').getByLabel('Date & time')).toHaveValue(`${date(6)}T11:00`);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await loginCandidate(page, cand.email, run.candidatePassword);
    await page.goto(`/candidate/applications/${appId}`);
    await expect(page.getByText(/11:00 AM GMT\+5:30/).first()).toBeVisible();
  });
});

test.describe('Offers', () => {
  test('offer form validates dates; a valid offer shows its details', async ({ page, run, api, db }) => {
    const { appId } = await applicationAt(api, run, 'OfferForm', 'select');
    await loginHR(page, run);
    await page.goto(`/applications/${appId}`);
    await page.getByRole('button', { name: 'Create & send offer' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Annual salary/).fill('500000');
    await dialog.getByLabel('Joining date').fill(date(-5));
    await dialog.getByRole('button', { name: 'Send offer' }).click();
    await expect(dialog.getByText('Joining date cannot be before the offer date.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await sendOfferUI(page, { designation: 'Senior SDET', salary: 1750000, notes: 'Joining bonus included.' });
    await expect(badge(page)).toHaveText(/OFFER SENT/i);
    await expect(page.getByText('Senior SDET')).toBeVisible();
    const [[o]] = await db.query('SELECT designation, notes, status FROM offers WHERE application_id = ?', [appId]);
    expect(o).toEqual({ designation: 'Senior SDET', notes: 'Joining bonus included.', status: 'SENT' });
  });

  test('candidate declines an offer; both portals and MySQL agree and hiring is blocked', async ({ page, run, api, db }) => {
    const { appId, hr, cand } = await applicationAt(api, run, 'Decline', 'select');
    const offer = await api.post('/offers', { application_id: appId, designation: 'QA Engineer', salary: 900000, offer_date: date(0), joining_date: date(30), expiry_date: date(10) }, { token: hr });
    expect(offer.status).toBe(201);

    await loginCandidate(page, cand.email, run.candidatePassword);
    await page.goto(`/candidate/applications/${appId}`);
    await expect(page.getByText('QA Engineer', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Decline', exact: true }).click();
    await confirmDialog(page, 'Decline offer');
    await expect(badge(page)).toHaveText('Not Selected');
    await expect(page.getByRole('button', { name: 'Accept offer' })).toHaveCount(0);

    const [[row]] = await db.query('SELECT a.status AS app, o.status AS offer FROM applications a JOIN offers o ON o.application_id = a.id WHERE a.id = ?', [appId]);
    expect(row).toEqual({ app: 'REJECTED', offer: 'REJECTED' });
    expect((await api.patch(`/applications/${appId}/hire`, undefined, { token: hr })).status).toBe(400);
    expect((await api.post(`/candidate/applications/${appId}/accept-offer`, undefined, { token: cand.token })).status).toBe(400);

    const hrView = await api.get(`/offers/${offer.body.data.id}`, { token: hr });
    expect(hrView.body.data).toMatchObject({ status: 'REJECTED', application_status: 'REJECTED' });
  });

  test('duplicate and ineligible offers are rejected; candidates cannot change offers', async ({ api, run, db }) => {
    const sel = await applicationAt(api, run, 'DupOffer', 'select');
    const body = { application_id: sel.appId, salary: 800000, offer_date: date(0), joining_date: date(30), expiry_date: date(10) };
    expect((await api.post('/offers', body, { token: sel.hr })).status).toBe(201);
    // The first offer moves the application to OFFER_SENT, so the state check rejects the duplicate first (400)
    const dup = await api.post('/offers', body, { token: sel.hr });
    expect([400, 409], 'duplicate offer').toContain(dup.status);
    expect(dup.body.success).toBe(false);
    const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM offers WHERE application_id = ?', [sel.appId]);
    expect(n, 'still exactly one offer').toBe(1);

    const shortlisted = await applicationAt(api, run, 'EarlyOffer', 'shortlist');
    expect((await api.post('/offers', { ...body, application_id: shortlisted.appId }, { token: shortlisted.hr })).status, 'offer before interview').toBe(400);

    const offers = await api.get('/offers', { token: sel.hr });
    const offerId = offers.body.data.find((o) => o.application_id === sel.appId).id;
    expect((await api.patch(`/offers/${offerId}/accept`, undefined, { token: sel.cand.token })).status, 'candidate uses HR offer API').toBe(403);
    expect((await api.post(`/candidate/applications/${sel.appId}/accept-offer`, undefined, { token: shortlisted.cand.token })).status, 'other candidate accepts').not.toBe(200);
    expect((await api.post('/offers', { ...body, application_id: shortlisted.appId }, { token: sel.cand.token })).status, 'candidate creates offer').toBe(403);
  });
});
