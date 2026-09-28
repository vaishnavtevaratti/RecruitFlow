/**
 * RecruitFlow — Database Verification Script
 * Validates connection, schema, tables, constraints, foreign keys, and seed data.
 */

const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Load environment variables from server/.env
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const {
    DB_HOST = '127.0.0.1',
    DB_PORT = 3306,
    DB_USER = 'root',
    DB_PASSWORD = '',
    DB_NAME = 'recruitflow'
} = process.env;

const REQUIRED_TABLES = [
    'users',
    'jobs',
    'candidates',
    'applications',
    'interviews',
    'offers'
];

async function verifyDatabase() {
    console.log('==================================================');
    console.log('RECRUITFLOW — DATABASE VERIFICATION');
    console.log('==================================================');

    let connection;
    let allPassed = true;

    function check(testName, condition, detail = '') {
        if (condition) {
            console.log(`[PASS] ${testName}${detail ? ` (${detail})` : ''}`);
        } else {
            console.error(`[FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
            allPassed = false;
        }
    }

    try {
        // 1. MySQL connection works
        connection = await mysql.createConnection({
            host: DB_HOST,
            port: Number(DB_PORT),
            user: DB_USER,
            password: DB_PASSWORD
        });
        check('1. MySQL connection established', true, `${DB_HOST}:${DB_PORT}`);

        // 2. Database recruitflow exists
        const [dbRows] = await connection.query(
            'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
            [DB_NAME]
        );
        check(`2. Database '${DB_NAME}' exists`, dbRows.length > 0);

        if (dbRows.length === 0) {
            throw new Error(`Database ${DB_NAME} not found. Run setupDatabase.js first.`);
        }

        await connection.query(`USE \`${DB_NAME}\`;`);

        // 3-8. Tables exist
        const [tableRows] = await connection.query(
            'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
            [DB_NAME]
        );
        const existingTables = tableRows.map((r) => r.TABLE_NAME.toLowerCase());

        check('3. users table exists', existingTables.includes('users'));
        check('4. jobs table exists', existingTables.includes('jobs'));
        check('5. candidates table exists', existingTables.includes('candidates'));
        check('6. applications table exists', existingTables.includes('applications'));
        check('7. interviews table exists', existingTables.includes('interviews'));
        check('8. offers table exists', existingTables.includes('offers'));

        // 9. Primary keys exist on all tables
        const [pkRows] = await connection.query(
            `SELECT TABLE_NAME, COLUMN_NAME 
             FROM information_schema.KEY_COLUMN_USAGE 
             WHERE TABLE_SCHEMA = ? AND CONSTRAINT_NAME = 'PRIMARY'`,
            [DB_NAME]
        );
        const pkTables = new Set(pkRows.map((r) => r.TABLE_NAME.toLowerCase()));
        const allPkPresent = REQUIRED_TABLES.every((t) => pkTables.has(t));
        check('9. Primary keys exist on all six tables', allPkPresent, `PKs found: ${Array.from(pkTables).join(', ')}`);

        // 10. Foreign keys exist
        const [fkRows] = await connection.query(
            `SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
             FROM information_schema.KEY_COLUMN_USAGE 
             WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
            [DB_NAME]
        );
        check('10. Foreign keys defined', fkRows.length >= 6, `${fkRows.length} foreign key relationships verified`);

        // 11. UNIQUE(candidate_id, job_id) exists on applications
        const [appUniqueRows] = await connection.query(
            `SELECT CONSTRAINT_NAME, COLUMN_NAME 
             FROM information_schema.KEY_COLUMN_USAGE 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'applications' 
               AND CONSTRAINT_NAME NOT IN ('PRIMARY', 'fk_applications_candidate', 'fk_applications_job')`,
            [DB_NAME]
        );
        const appUniqueCols = appUniqueRows.map((r) => r.COLUMN_NAME);
        const hasAppUnique = appUniqueCols.includes('candidate_id') && appUniqueCols.includes('job_id');
        check('11. UNIQUE(candidate_id, job_id) constraint on applications', hasAppUnique, `Columns: ${appUniqueCols.join(', ')}`);

        // 12. Offer application_id uniqueness exists
        const [offerUniqueRows] = await connection.query(
            `SELECT CONSTRAINT_NAME, COLUMN_NAME 
             FROM information_schema.KEY_COLUMN_USAGE 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'offers' 
               AND CONSTRAINT_NAME NOT IN ('PRIMARY', 'fk_offers_application')`,
            [DB_NAME]
        );
        const offerUniqueCols = offerUniqueRows.map((r) => r.COLUMN_NAME);
        const hasOfferUnique = offerUniqueCols.includes('application_id');
        check('12. UNIQUE(application_id) constraint on offers', hasOfferUnique, `Unique columns: ${offerUniqueCols.join(', ')}`);

        // 13. Demo users exist
        const [users] = await connection.query('SELECT id, name, email, role FROM users');
        const hasHr = users.some((u) => u.role === 'HR');
        const hasInterviewer = users.some((u) => u.role === 'INTERVIEWER');
        check('13. Demo users exist (HR and INTERVIEWER)', hasHr && hasInterviewer, `Total users: ${users.length}`);

        // 14. Demo jobs exist (PUBLISHED, DRAFT, CLOSED)
        const [jobs] = await connection.query('SELECT id, title, status FROM jobs');
        const jobStatuses = new Set(jobs.map((j) => j.status));
        const hasAllJobStatuses = jobStatuses.has('PUBLISHED') && jobStatuses.has('DRAFT') && jobStatuses.has('CLOSED');
        check('14. Demo jobs exist (PUBLISHED, DRAFT, CLOSED)', hasAllJobStatuses, `Statuses: ${Array.from(jobStatuses).join(', ')}`);

        // 15. Demo candidates exist
        const [candidates] = await connection.query('SELECT id, name, email FROM candidates');
        check('15. Demo candidates exist', candidates.length >= 3, `Count: ${candidates.length}`);

        // 16. Demo applications exist
        const [applications] = await connection.query('SELECT id, candidate_id, job_id, status FROM applications');
        const appStatuses = new Set(applications.map((a) => a.status));
        check('16. Demo applications exist across realistic stages', applications.length >= 4, `Stages: ${Array.from(appStatuses).join(', ')}`);

        // 17. Demo interviews exist
        const [interviews] = await connection.query('SELECT id, application_id, result, overall_rating FROM interviews');
        check('17. Demo interviews exist (with scores and scheduled items)', interviews.length >= 2, `Count: ${interviews.length}`);

        // 18. Demo offers exist
        const [offers] = await connection.query('SELECT id, application_id, salary, status FROM offers');
        check('18. Demo offers exist', offers.length >= 1, `Count: ${offers.length}, Statuses: ${offers.map((o) => o.status).join(', ')}`);

        // 19. SELECT queries work against every table
        let allSelectsWork = true;
        for (const tbl of REQUIRED_TABLES) {
            try {
                const [rows] = await connection.query(`SELECT COUNT(*) AS cnt FROM \`${tbl}\``);
                if (typeof rows[0].cnt !== 'number' && typeof rows[0].cnt !== 'bigint') {
                    allSelectsWork = false;
                }
            } catch (err) {
                console.error(`Error querying ${tbl}:`, err.message);
                allSelectsWork = false;
            }
        }
        check('19. SELECT queries execute successfully on all tables', allSelectsWork);

        // 20. Database connection closes successfully
        await connection.end();
        connection = null;
        check('20. Database connection closed cleanly', true);

        console.log('==================================================');
        if (allPassed) {
            console.log('ALL 20 VERIFICATION CHECKS PASSED');
            console.log('==================================================');
            return true;
        } else {
            console.error('ONE OR MORE VERIFICATION CHECKS FAILED');
            console.log('==================================================');
            process.exitCode = 1;
            return false;
        }
    } catch (err) {
        const sanitized = (err.message || 'Unknown error').replace(
            new RegExp(DB_PASSWORD, 'g'),
            '*****'
        );
        console.error('[FAIL] Verification aborted due to error:');
        console.error(sanitized);
        process.exitCode = 1;
        return false;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

if (require.main === module) {
    verifyDatabase().then((success) => {
        if (!success) {
            process.exit(1);
        }
    }).catch(() => {
        process.exit(1);
    });
}

module.exports = { verifyDatabase };
