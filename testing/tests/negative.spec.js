// Negative business-logic and security checks against the real API (plus UI where it shows the rule).

const { test, expect, date, dateTime, jobData, loginCandidate } = require('../support/fixtures');

test.describe('Business rules', () => {
  test('applications: duplicates, closed jobs, draft jobs and expired jobs are rejected', async ({ api, run, db, page }) => {
    const hr = await api.hrToken(run);
    const cand = await api.signupCandidate(run, 'Rules');

    const open = await api.createJob(run, hr);
    expect((await api.post('/candidate/apply', { job_id: open.id }, { token: cand.token })).status).toBe(201);
    expect((await api.post('/candidate/apply', { job_id: open.id }, { token: cand.token })).status, 'duplicate').toBe(409);

    const closed = await api.createJob(run, hr);
    await api.patch(`/jobs/${closed.id}/close`, undefined, { token: hr });
    expect((await api.post('/candidate/apply', { job_id: closed.id }, { token: cand.token })).status, 'closed').toBe(400);

    const draft = await api.createJob(run, hr, {}, { publish: false });
    expect((await api.post('/candidate/apply', { job_id: draft.id }, { token: cand.token })).status, 'draft').toBe(400);

    // Expired job: time is simulated by moving this test job's deadline into the past (not a user action)
    const expired = await api.createJob(run, hr);
    await db.query('UPDATE jobs SET deadline = ? WHERE id = ? AND title LIKE ?', [date(-2), expired.id, `E2E ${run.runId} %`]);
    expect((await api.post('/candidate/apply', { job_id: expired.id }, { token: cand.token })).status, 'expired').toBe(400);
    const board = await api.get('/jobs');
    expect(board.body.data.some((j) => j.id === expired.id), 'expired job hidden from board').toBe(false);

    await loginCandidate(page, cand.email, run.candidatePassword);
    await page.goto(`/candidate/jobs/${expired.id}/apply`);
    await expect(page.getByRole('button', { name: 'Submit application' })).toHaveCount(0);

    expect((await api.post('/candidate/apply', { job_id: 99999999 }, { token: cand.token })).status, 'missing job').toBe(404);
    expect((await api.post('/candidate/apply', {}, { token: cand.token })).status, 'no job id').toBe(400);
  });

  test('pipeline steps cannot be skipped or repeated', async ({ api, run }) => {
    const hr = await api.hrToken(run);
    const job = await api.createJob(run, hr);
    const cand = await api.signupCandidate(run, 'Skip');
    const appId = (await api.post('/candidate/apply', { job_id: job.id }, { token: cand.token })).body.data.id;

    expect((await api.patch(`/applications/${appId}/shortlist`, undefined, { token: hr })).status, 'shortlist before screening').toBe(400);
    expect((await api.patch(`/applications/${appId}/select`, undefined, { token: hr })).status, 'select before interview').toBe(400);
    expect((await api.patch(`/applications/${appId}/hire`, undefined, { token: hr })).status, 'hire before offer').toBe(400);
    expect((await api.patch(`/applications/${appId}/screen`, undefined, { token: hr })).status).toBe(200);
    expect((await api.patch(`/applications/${appId}/screen`, undefined, { token: hr })).status, 'screen twice').toBe(400);
    expect((await api.patch(`/applications/${appId}/reject`, undefined, { token: hr })).status).toBe(200);
    for (const step of ['screen', 'shortlist', 'select', 'hire', 'reject']) {
      expect((await api.patch(`/applications/${appId}/${step}`, undefined, { token: hr })).status, `${step} after reject`).toBe(400);
    }
  });

  test('missing fields and invalid values are rejected with 400', async ({ api, run }) => {
    const hr = await api.hrToken(run);
    const cases = [
      ['post', '/jobs', { ...jobData(run), description: undefined }],
      ['post', '/jobs', jobData(run, { salary_min: 'lots' })],
      ['post', '/jobs', jobData(run, { title: 'x'.repeat(200) })],
      ['post', '/interviews', { application_id: 1 }],
      ['post', '/offers', { application_id: 1 }],
      ['post', '/offers', { application_id: 1, salary: -1, offer_date: date(0), joining_date: date(10), expiry_date: date(5) }],
      ['post', '/offers', { application_id: 1, salary: 1000, offer_date: date(0), joining_date: date(10), expiry_date: date(-5) }],
      ['post', '/auth/candidate/signup', { email: 'no.name@example.test', password: run.candidatePassword }]
    ];
    for (const [method, path, body] of cases) {
      const r = await api[method](path, body, { token: hr });
      expect(r.status, `${method.toUpperCase()} ${path} ${JSON.stringify(body).slice(0, 80)}`).toBe(400);
      expect(r.body?.success).toBe(false);
    }
    const badJson = await api.call('POST', '/jobs', { token: hr, body: '{not json', headers: { 'Content-Type': 'application/json' } });
    expect(badJson.status).toBe(400);
    expect((await api.get('/jobs/abc', { token: hr })).status, 'non-numeric id').toBe(400);
  });
});

test.describe('Access control', () => {
  test("candidates cannot read or act on another candidate's records", async ({ api, run }) => {
    const hr = await api.hrToken(run);
    const job = await api.createJob(run, hr);
    const a = await api.signupCandidate(run, 'OwnerA');
    const b = await api.signupCandidate(run, 'IntruderB');
    const appA = (await api.post('/candidate/apply', { job_id: job.id }, { token: a.token })).body.data.id;
    await api.advance(appA, hr, 'select');
    await api.post('/offers', { application_id: appA, salary: 700000, offer_date: date(0), joining_date: date(30), expiry_date: date(10) }, { token: hr });

    const view = await api.get(`/candidate/applications/${appA}`, { token: b.token });
    expect([403, 404]).toContain(view.status);
    expect(JSON.stringify(view.body)).not.toContain(a.email);
    expect([403, 404]).toContain((await api.post(`/candidate/applications/${appA}/accept-offer`, undefined, { token: b.token })).status);
    expect([403, 404]).toContain((await api.post(`/candidate/applications/${appA}/reject-offer`, undefined, { token: b.token })).status);
    expect((await api.get(`/applications/${appA}`, { token: b.token })).status).toBe(403);
    expect((await api.get(`/candidates/${a.candidate.id}`, { token: b.token })).status).toBe(403);

    // Identity comes from the token, never from the request body
    const spoof = await api.put('/candidate/profile', { name: 'Spoofed', candidate_id: a.candidate.id, user_id: a.user.id }, { token: b.token });
    expect(spoof.status).toBe(200);
    const aProfile = await api.get('/candidate/me', { token: a.token });
    expect(JSON.stringify(aProfile.body)).not.toContain('Spoofed');

    const mine = await api.get('/candidate/applications', { token: b.token });
    expect(mine.body.data).toEqual([]);
  });

  test('HR-only endpoints reject candidates and anonymous callers', async ({ api, run }) => {
    const cand = await api.signupCandidate(run, 'HrOnly');
    const endpoints = [
      ['post', '/interviews', { application_id: 1, interviewer_id: 1, scheduled_at: dateTime(3), type: 'x' }],
      ['patch', '/interviews/1/reschedule', { scheduled_at: dateTime(3) }],
      ['patch', '/interviews/1/cancel'],
      ['post', '/offers', { application_id: 1, salary: 1, offer_date: date(0), joining_date: date(1), expiry_date: date(1) }],
      ['patch', '/offers/1/reject'],
      ['patch', '/applications/1/reject'],
      ['patch', '/applications/1/hire'],
      ['get', '/applications/1/skill-match'],
      ['get', '/interviews/interviewers']
    ];
    for (const [method, path, body] of endpoints) {
      const anon = method === 'get' ? await api.get(path) : await api[method](path, body);
      expect(anon.status, `anonymous ${method} ${path}`).toBe(401);
      const asCand = method === 'get' ? await api.get(path, { token: cand.token }) : await api[method](path, body, { token: cand.token });
      expect(asCand.status, `candidate ${method} ${path}`).toBe(403);
    }
  });

  test('error responses never leak stack traces or SQL', async ({ api, run }) => {
    const hr = await api.hrToken(run);
    const responses = [
      await api.post('/jobs', jobData(run, { deadline: 'not-a-date' }), { token: hr }),
      await api.get('/applications/999999999', { token: hr }),
      await api.call('POST', '/auth/login', { body: '{bad', headers: { 'Content-Type': 'application/json' } })
    ];
    for (const r of responses) {
      const text = JSON.stringify(r.body);
      expect(text).not.toMatch(/at \w+ \(|node_modules|SELECT |INSERT |ER_[A-Z_]+|stack/i);
    }
  });
});
