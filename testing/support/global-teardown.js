// Removes only the records this run created (tagged with the run id) from the E2E database.
// Set E2E_KEEP=1 to keep them for inspection.

const fs = require('fs');
const mysql = require('mysql2/promise');
const env = require('./env');

module.exports = async function globalTeardown() {
  if (env.KEEP || !fs.existsSync(env.RUN_FILE)) return;
  const { runId } = JSON.parse(fs.readFileSync(env.RUN_FILE, 'utf8'));
  const conn = await mysql.createConnection(env.DB_CONFIG);
  try {
    const emailLike = `e2e.${runId}.%`;
    const titleLike = `E2E ${runId} %`;
    const [apps] = await conn.query(
      `SELECT a.id FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = a.job_id
       WHERE c.email LIKE ? OR j.title LIKE ?`,
      [emailLike, titleLike]
    );
    const appIds = apps.map((a) => a.id);
    if (appIds.length) {
      await conn.query('DELETE FROM offers WHERE application_id IN (?)', [appIds]);
      await conn.query('DELETE FROM interviews WHERE application_id IN (?)', [appIds]);
      await conn.query('DELETE FROM applications WHERE id IN (?)', [appIds]);
    }
    await conn.query('DELETE FROM candidates WHERE email LIKE ?', [emailLike]);
    await conn.query("DELETE FROM users WHERE email LIKE ? AND role = 'CANDIDATE'", [emailLike]);
    await conn.query('DELETE FROM jobs WHERE title LIKE ?', [titleLike]);
    console.log(`[e2e] Removed records for run ${runId} (${appIds.length} applications).`);
  } finally {
    await conn.end();
  }
};
