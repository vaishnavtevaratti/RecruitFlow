/**
 * RecruitFlow — Unit checks for time zone handling and MySQL TLS options (no database needed).
 * Runs with APP_TIMEZONE=Asia/Kolkata regardless of this machine's own time zone.
 */

process.env.APP_TIMEZONE = 'Asia/Kolkata';
process.env.TZ = 'America/New_York'; // prove nothing depends on the host's time zone

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { normalizeDateTime, dateTimeToDate, todayDateOnly, isPastDate, isValidDateOnly } = require('../src/utils/dates');
const { sslOptions } = require('../src/config/ssl');

let passed = 0;
function check(name, fn) {
    fn();
    passed += 1;
    console.log(`[PASS] ${name}`);
}

check('IST wall time from a form is stored as UTC', () => {
    assert.strictEqual(normalizeDateTime('2026-11-10T11:00'), '2026-11-10 05:30:00');
    assert.strictEqual(normalizeDateTime('2026-11-10 00:15:30'), '2026-11-09 18:45:30');
});
check('Explicit offsets are honoured', () => {
    assert.strictEqual(normalizeDateTime('2026-11-10T11:00:00Z'), '2026-11-10 11:00:00');
    assert.strictEqual(normalizeDateTime('2026-11-10T11:00+05:30'), '2026-11-10 05:30:00');
    assert.strictEqual(normalizeDateTime('2026-11-10T11:00:00.000-05:00'), '2026-11-10 16:00:00');
});
check('Invalid date-times are rejected', () => {
    for (const bad of ['2026-02-30T10:00', '2026-11-10T24:00', 'tomorrow', '', null, '2026-11-10T10:00+5:30']) {
        assert.strictEqual(normalizeDateTime(bad), null, String(bad));
    }
});
check('Stored UTC converts back to the same instant', () => {
    assert.strictEqual(dateTimeToDate('2026-11-10 05:30:00').toISOString(), '2026-11-10T05:30:00.000Z');
});
check('"Today" is the Asia/Kolkata calendar date', () => {
    // 20:00 UTC on 4 Nov is 01:30 on 5 Nov in India
    assert.strictEqual(todayDateOnly(new Date('2026-11-04T20:00:00Z')), '2026-11-05');
    assert.strictEqual(todayDateOnly(new Date('2026-11-04T18:00:00Z')), '2026-11-04');
});
check('Calendar-date helpers', () => {
    assert.ok(isValidDateOnly('2028-02-29'));
    assert.ok(!isValidDateOnly('2027-02-29'));
    assert.ok(isPastDate('2000-01-01'));
    assert.ok(!isPastDate('2999-01-01'));
});

check('SSL off unless DB_SSL=true', () => {
    assert.strictEqual(sslOptions({}), undefined);
    assert.strictEqual(sslOptions({ DB_SSL: 'false', DB_SSL_CA: 'x' }), undefined);
});
check('SSL without a CA still verifies against public CAs', () => {
    assert.deepStrictEqual(sslOptions({ DB_SSL: 'true' }), { rejectUnauthorized: true });
});
const PEM = '-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----';
check('SSL CA accepted as inline PEM (including \\n-escaped single line)', () => {
    assert.deepStrictEqual(sslOptions({ DB_SSL: 'true', DB_SSL_CA: PEM }), { ca: PEM, rejectUnauthorized: true });
    assert.strictEqual(sslOptions({ DB_SSL: 'true', DB_SSL_CA: PEM.replace(/\n/g, '\\n') }).ca, PEM);
});
check('SSL CA accepted as a file path; invalid content rejected', () => {
    const file = path.join(os.tmpdir(), `rf-ca-${process.pid}.pem`);
    fs.writeFileSync(file, PEM);
    try {
        assert.deepStrictEqual(sslOptions({ DB_SSL: 'true', DB_SSL_CA: file }), { ca: PEM, rejectUnauthorized: true });
        fs.writeFileSync(file, 'not a certificate');
        assert.throws(() => sslOptions({ DB_SSL: 'true', DB_SSL_CA: file }), /PEM certificate/);
    } finally {
        fs.unlinkSync(file);
    }
});

console.log(`\nTIME & SSL UNIT RESULTS: ${passed} PASSED, 0 FAILED`);
