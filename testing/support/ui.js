// UI action helpers for HR pipeline screens. All actions go through the real React UI.

const { expect } = require('@playwright/test');

/** Clicks the confirm button inside the open dialog. */
async function confirmDialog(page, buttonName) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: buttonName, exact: true }).click();
  await expect(dialog).toBeHidden();
}

/** Fills and submits the HR job form (create or edit). */
async function fillJobForm(page, job) {
  const fields = [
    ['Job title', job.title],
    ['Department', job.department],
    ['Description', job.description],
    ['Required skills', job.skills],
    ['Experience required', job.experience_required],
    ['Location', job.location],
    ['Minimum salary', job.salary_min],
    ['Maximum salary', job.salary_max],
    ['Application deadline', job.deadline]
  ];
  for (const [label, value] of fields) {
    if (value !== undefined) await page.getByLabel(label).fill(String(value));
  }
  if (job.employment_type) await page.getByLabel('Employment type').selectOption(job.employment_type);
}

async function createJobUI(page, job) {
  await page.goto('/jobs/new');
  await fillJobForm(page, job);
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page).toHaveURL(/\/jobs\/\d+$/);
  await expect(page.getByRole('heading', { level: 1, name: job.title })).toBeVisible();
  return Number(page.url().match(/\/jobs\/(\d+)$/)[1]);
}

async function scheduleInterviewUI(page, { when, type = 'Technical Interview', link = '' }) {
  await page.getByRole('button', { name: 'Schedule interview' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Round type').fill(type);
  await dialog.getByLabel('Interviewer').selectOption({ index: 1 });
  await dialog.getByLabel('Date & time').fill(when);
  if (link) await dialog.getByLabel(/Meeting link/).fill(link);
  await dialog.getByRole('button', { name: 'Schedule interview' }).click();
}

async function evaluateUI(page, result, feedback = `Automated ${result} feedback.`) {
  await page.getByRole('button', { name: /Record (interview )?evaluation/ }).first().click();
  const dialog = page.getByRole('dialog');
  for (const label of ['Technical skills', 'Communication', 'Problem solving', 'Overall']) {
    await dialog.getByLabel(label).fill(result === 'PASS' ? '8' : '3');
  }
  await dialog.getByLabel('Feedback').fill(feedback);
  await dialog.getByText(result === 'PASS' ? 'Pass' : 'Fail', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Submit evaluation' }).click();
  await expect(dialog).toBeHidden();
}

async function sendOfferUI(page, { designation, salary, notes }) {
  await page.getByRole('button', { name: 'Create & send offer' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Designation').fill(designation);
  await dialog.getByLabel(/Annual salary/).fill(String(salary));
  if (notes) await dialog.getByLabel(/Offer details/).fill(notes);
  await dialog.getByRole('button', { name: 'Send offer' }).click();
  await expect(dialog).toBeHidden();
}

/** Status badge text in the application page header. */
function headerStatus(page) {
  return page.locator('.page-header').first();
}

module.exports = { confirmDialog, fillJobForm, createJobUI, scheduleInterviewUI, evaluateUI, sendOfferUI, headerStatus };
