// Prepares the isolated E2E database and the run's credentials.
// - Creates/updates the schema in E2E_DB_NAME with the project's own setup script (demo seed included).
// - Sets the HR test account password: E2E_HR_PASSWORD if given, otherwise a random one per run.
// - Writes run credentials to .auth/run.json (git-ignored) for the test workers.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const env = require('./env');

module.exports = async function globalSetup() {
  const randomPassword = () => `E2e!${crypto.randomBytes(9).toString('base64url')}9a`;
  const run = {
    runId: Date.now().toString(36),
    hrEmail: env.HR_EMAIL,
    hrPassword: process.env.E2E_HR_PASSWORD || randomPassword(),
    candidatePassword: process.env.E2E_CANDIDATE_PASSWORD || randomPassword()
  };

  execFileSync(process.execPath, [path.join(__dirname, '..', '..', 'server', 'scripts', 'setupDatabase.js')], {
    env: {
      ...process.env,
      DB_NAME: env.DB_NAME,
      DEMO_HR_EMAIL: run.hrEmail,
      DEMO_HR_PASSWORD: run.hrPassword,
      NODE_ENV: 'test',
      SEED_DEMO_DATA: 'true'
    },
    stdio: 'pipe'
  });

  fs.mkdirSync(path.dirname(env.RUN_FILE), { recursive: true });
  fs.writeFileSync(env.RUN_FILE, JSON.stringify(run, null, 2));
  console.log(`[e2e] Database '${env.DB_NAME}' ready. Run id: ${run.runId}`);
};
