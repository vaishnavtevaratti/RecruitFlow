/**
 * RecruitFlow — Versioned, idempotent schema migrations. Nothing is ever dropped.
 *
 * Column migrations check information_schema first. Data migrations are recorded in
 * `schema_migrations` in the same transaction as their change, so each runs exactly once.
 *
 * Rollback (manual, only if you must undo):
 *   002_offer_details:
 *     ALTER TABLE offers DROP COLUMN notes, DROP COLUMN designation;
 *   003_interview_times_utc:
 *     UPDATE interviews SET scheduled_at = CONVERT_TZ(scheduled_at, '+00:00', '+05:30');
 *     DELETE FROM schema_migrations WHERE id = '003_interview_times_utc';
 */

const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { sslOptions } = require('../src/config/ssl');

// Production settings come only from the environment, never from the development server/.env
if (process.env.NODE_ENV !== 'production') dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Interview times written before 003 are wall-clock time in the app's time zone (IST, UTC+05:30).
// shortcut: fixed offset is exact for Asia/Kolkata (no DST); compute per-row offsets for a DST zone.
const LEGACY_OFFSET = '+05:30';

const COLUMN_MIGRATIONS = [
    {
        id: '002_offer_details',
        table: 'offers',
        column: 'designation',
        sql: 'ALTER TABLE offers ADD COLUMN designation VARCHAR(150) NULL AFTER application_id, ADD COLUMN notes TEXT NULL AFTER expiry_date'
    }
];

const DATA_MIGRATIONS = [
    {
        id: '003_interview_times_utc',
        run: (conn) => conn.query('UPDATE interviews SET scheduled_at = CONVERT_TZ(scheduled_at, ?, ?)', [LEGACY_OFFSET, '+00:00'])
    }
];

async function runMigrations(connection, dbName) {
    for (const m of COLUMN_MIGRATIONS) {
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

    await connection.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
            id VARCHAR(100) PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB`
    );
    for (const m of DATA_MIGRATIONS) {
        await connection.beginTransaction();
        try {
            // The marker row is locked and written first, so concurrent runs cannot both apply it
            const [ins] = await connection.query('INSERT IGNORE INTO schema_migrations (id) VALUES (?)', [m.id]);
            if (ins.affectedRows === 0) {
                await connection.rollback();
                console.log(`[INFO] ${m.id} already applied.`);
                continue;
            }
            const [res] = await m.run(connection);
            await connection.commit();
            console.log(`[PASS] ${m.id} applied (${res.affectedRows ?? 0} rows).`);
        } catch (err) {
            await connection.rollback();
            throw err;
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
        ssl: sslOptions()
    })
        .then(async (conn) => {
            try {
                await runMigrations(conn, DB_NAME);
            } finally {
                await conn.end();
            }
        })
        .catch((err) => {
            console.error('[FAIL] Migration error:', err.code || err.message);
            process.exit(1);
        });
}

module.exports = { runMigrations };
