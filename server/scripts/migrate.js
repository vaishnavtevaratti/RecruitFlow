/**
 * RecruitFlow — Versioned, idempotent schema migrations.
 * Each migration checks information_schema first, so re-running is safe and no data is dropped.
 *
 * Rollback (manual, only if you must undo):
 *   002_offer_details: ALTER TABLE offers DROP COLUMN notes, DROP COLUMN designation;
 */

const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const MIGRATIONS = [
    {
        id: '002_offer_details',
        table: 'offers',
        column: 'designation',
        sql: 'ALTER TABLE offers ADD COLUMN designation VARCHAR(150) NULL AFTER application_id, ADD COLUMN notes TEXT NULL AFTER expiry_date'
    }
];

async function runMigrations(connection, dbName) {
    for (const m of MIGRATIONS) {
        const [rows] = await connection.query(
            'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [dbName, m.table, m.column]
        );
        if (rows.length) {
            console.log(`[INFO] ${m.id} already applied.`);
        } else {
            await connection.query(m.sql);
            console.log(`[PASS] ${m.id} applied.`);
        }
    }
}

if (require.main === module) {
    const { DB_HOST = '127.0.0.1', DB_PORT = 3306, DB_USER = 'root', DB_PASSWORD = '', DB_NAME = 'recruitflow' } = process.env;
    mysql.createConnection({
        host: DB_HOST,
        port: Number(DB_PORT),
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    })
        .then(async (conn) => {
            try {
                await runMigrations(conn, DB_NAME);
            } finally {
                await conn.end();
            }
        })
        .catch((err) => {
            console.error('[FAIL] Migration error:', err.code || 'unknown');
            process.exit(1);
        });
}

module.exports = { runMigrations };
