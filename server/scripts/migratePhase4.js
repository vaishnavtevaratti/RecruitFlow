/**
 * RecruitFlow — Phase 4 Database Migration Script
 * Safely and idempotently adds CANDIDATE role to users.role ENUM
 * and user_id foreign key to candidates table without dropping or losing data.
 */

const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const {
    DB_HOST = '127.0.0.1',
    DB_PORT = 3306,
    DB_USER = 'root',
    DB_PASSWORD = '',
    DB_NAME = 'recruitflow'
} = process.env;

async function runMigration() {
    console.log('--------------------------------------------------');
    console.log('RecruitFlow — Phase 4 Migration');
    console.log('--------------------------------------------------');

    let connection;
    try {
        connection = await mysql.createConnection({
            host: DB_HOST,
            port: Number(DB_PORT),
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME
        });

        console.log('[PASS] Connected to MySQL database.');

        // 1. Inspect users.role ENUM
        const [roleCol] = await connection.query(
            `SELECT COLUMN_TYPE FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`,
            [DB_NAME]
        );

        if (roleCol.length > 0) {
            const colType = roleCol[0].COLUMN_TYPE;
            if (!colType.includes('CANDIDATE')) {
                console.log('Updating users.role ENUM to include CANDIDATE...');
                await connection.query(
                    `ALTER TABLE users MODIFY COLUMN role ENUM('HR', 'INTERVIEWER', 'ADMIN', 'CANDIDATE') NOT NULL`
                );
                console.log('[PASS] users.role updated successfully to include CANDIDATE.');
            } else {
                console.log('[INFO] users.role ENUM already supports CANDIDATE.');
            }
        }

        // 2. Inspect candidates table for user_id column
        const [userIdCol] = await connection.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'candidates' AND COLUMN_NAME = 'user_id'`,
            [DB_NAME]
        );

        if (userIdCol.length === 0) {
            console.log('Adding user_id column and foreign key constraint to candidates table...');
            await connection.query(
                `ALTER TABLE candidates ADD COLUMN user_id INT NULL UNIQUE AFTER id`
            );
            await connection.query(
                `ALTER TABLE candidates ADD CONSTRAINT fk_candidates_user 
                 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL`
            );
            console.log('[PASS] candidates.user_id added with foreign key constraint.');
        } else {
            console.log('[INFO] candidates.user_id column already exists.');
        }

        // 3. Verify data preservation
        const [userCount] = await connection.query('SELECT COUNT(*) as cnt FROM users');
        const [jobCount] = await connection.query('SELECT COUNT(*) as cnt FROM jobs');
        const [candCount] = await connection.query('SELECT COUNT(*) as cnt FROM candidates');
        const [appCount] = await connection.query('SELECT COUNT(*) as cnt FROM applications');
        const [ivCount] = await connection.query('SELECT COUNT(*) as cnt FROM interviews');
        const [offerCount] = await connection.query('SELECT COUNT(*) as cnt FROM offers');

        console.log('--- Migration Verification ---');
        console.log(`Users: ${userCount[0].cnt}`);
        console.log(`Jobs: ${jobCount[0].cnt}`);
        console.log(`Candidates: ${candCount[0].cnt}`);
        console.log(`Applications: ${appCount[0].cnt}`);
        console.log(`Interviews: ${ivCount[0].cnt}`);
        console.log(`Offers: ${offerCount[0].cnt}`);
        console.log('--------------------------------------------------');
        console.log('PHASE 4 DATABASE MIGRATION COMPLETED SUCCESSFULLY');
        console.log('--------------------------------------------------');

        return true;
    } catch (err) {
        const sanitized = (err.message || '').replace(new RegExp(DB_PASSWORD, 'g'), '*****');
        console.error('[FAIL] Migration encountered an error:', sanitized);
        process.exitCode = 1;
        throw err;
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed.');
        }
    }
}

if (require.main === module) {
    runMigration().catch(() => process.exit(1));
}

module.exports = { runMigration };
