// Test environment and safety guard. Loaded by the config, setup, teardown and fixtures.
// DB connection settings come from server/.env; only DB_NAME is replaced by E2E_DB_NAME.

const fs = require('fs');
const path = require('path');

for (const file of [path.join(__dirname, '..', '.env.e2e'), path.join(__dirname, '..', '..', 'server', '.env')]) {
  // process.loadEnvFile never overrides variables already set in the shell
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

const DEV_DB_NAME = process.env.DB_NAME || 'recruitflow';
const DB_NAME = process.env.E2E_DB_NAME || 'recruitflow_e2e';
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const API_PORT = Number(process.env.E2E_API_PORT || 5100);
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 5174);

// Hard stop: these tests create and delete data, so they only ever run on a local, dedicated test database
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1'];
const problems = [];
if (!LOCAL_HOSTS.includes(DB_HOST)) problems.push(`DB_HOST must be local (got "${DB_HOST}")`);
if (!/_(e2e|test)$/.test(DB_NAME)) problems.push(`E2E_DB_NAME must end in _e2e or _test (got "${DB_NAME}")`);
if (DB_NAME === DEV_DB_NAME) problems.push('E2E_DB_NAME must differ from the development DB_NAME');
if (process.env.NODE_ENV === 'production') problems.push('NODE_ENV is production');
if (problems.length) {
  throw new Error(`Refusing to run RecruitFlow E2E tests:\n - ${problems.join('\n - ')}`);
}

module.exports = {
  DB_NAME,
  DB_CONFIG: {
    host: DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: DB_NAME,
    dateStrings: true
  },
  API_PORT,
  WEB_PORT,
  API_URL: `http://127.0.0.1:${API_PORT}/api`,
  WEB_URL: `http://127.0.0.1:${WEB_PORT}`,
  HR_EMAIL: process.env.E2E_HR_EMAIL || 'e2e.hr@recruitflow.test',
  RUN_FILE: path.join(__dirname, '..', '.auth', 'run.json'),
  KEEP: process.env.E2E_KEEP === '1'
};
