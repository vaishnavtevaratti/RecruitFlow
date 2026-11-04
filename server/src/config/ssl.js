/**
 * RecruitFlow — MySQL TLS options (shared by the API pool and the database scripts).
 *
 * DB_SSL=true   → TLS with the server certificate always verified (rejectUnauthorized: true).
 * DB_SSL_CA     → the provider's CA certificate, either the PEM text itself (a "\n"-escaped
 *                 single line is accepted) or a path to a .pem file. Without it, Node's built-in
 *                 public CA list is used, which works for providers with publicly trusted certs.
 * There is intentionally no option to skip verification.
 */

const fs = require('fs');

function sslOptions(env = process.env) {
    if (env.DB_SSL !== 'true') return undefined;
    const ca = (env.DB_SSL_CA || '').trim();
    if (!ca) return { rejectUnauthorized: true };
    const pem = ca.includes('-----BEGIN CERTIFICATE-----') ? ca.replace(/\\n/g, '\n') : fs.readFileSync(ca, 'utf8');
    if (!pem.includes('-----BEGIN CERTIFICATE-----')) {
        throw new Error('DB_SSL_CA must be a PEM certificate or a path to one.');
    }
    return { ca: pem, rejectUnauthorized: true };
}

module.exports = { sslOptions };
