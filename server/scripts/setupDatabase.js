/**
 * RecruitFlow — Database Setup Script
 * Sets up MySQL database, applies schema.sql and migrations, and seeds demo data (non-production).
 * Safe and idempotent: tables are only created if missing and nothing is dropped.
 *
 * Production (NODE_ENV=production):
 * - server/.env is NOT read; every setting must come from the environment, e.g.
 *   node --env-file=.env.production scripts/setupDatabase.js
 * - demo seed data (with its public demo passwords) is never imported,
 * - the HR account is created only if its email does not exist yet; existing users are never changed.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { runMigrations } = require('./migrate');
const { sslOptions } = require('../src/config/ssl');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// 1. Load server/.env for local use only; production must never fall back to development values
if (!IS_PRODUCTION) dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const {
    DB_HOST = '127.0.0.1',
    DB_PORT = 3306,
    DB_USER = 'root',
    DB_PASSWORD = '',
    DB_NAME = 'recruitflow',
    DEMO_HR_EMAIL = 'hr@recruitflow.com',
    DEMO_HR_PASSWORD = 'Admin@123'
} = process.env;

// The SQL files name `recruitflow` for manual mysql CLI use; setup targets DB_NAME instead
function withoutDatabaseSwitch(sql) {
    return sql.replace(/^\s*(CREATE DATABASE|USE)\b[^;]*;/gim, '');
}

async function setupDatabase() {
    if (IS_PRODUCTION) {
        const missing = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DEMO_HR_EMAIL', 'DEMO_HR_PASSWORD'].filter((k) => !process.env[k]);
        if (missing.length) {
            console.error(`[FAIL] Production setup needs these settings: ${missing.join(', ')}`);
            process.exitCode = 1;
            return false;
        }
        if (DEMO_HR_PASSWORD === 'Admin@123' || DEMO_HR_PASSWORD.length < 12) {
            console.error('[FAIL] In production DEMO_HR_PASSWORD must be a strong password (12+ characters, not the demo default).');
            process.exitCode = 1;
            return false;
        }
    }

    console.log('--------------------------------------------------');
    console.log('RecruitFlow Database Setup');
    console.log('--------------------------------------------------');
    console.log(`Connecting to MySQL host: ${DB_HOST}:${DB_PORT} as user: ${DB_USER}`);

    let connection;
    try {
        // Connect to server (without database selected) to ensure DB exists
        connection = await mysql.createConnection({
            host: DB_HOST,
            port: Number(DB_PORT),
            user: DB_USER,
            password: DB_PASSWORD,
            ssl: sslOptions(),
            timezone: 'Z',
            multipleStatements: true
        });
        // Same UTC session as the API pool, so seed and migration times are written as UTC
        await connection.query("SET time_zone = '+00:00'");

        console.log(`[PASS] Connected to MySQL server${sslOptions() ? ' over verified TLS' : ''}.`);

        // 2. Create database if not exists
        console.log(`Creating database '${DB_NAME}' if it does not exist...`);
        try {
            await connection.query(
                `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
            );
        } catch (err) {
            // Managed MySQL often pre-creates the database and denies CREATE DATABASE
            console.log(`[INFO] Could not create database (${err.code}); using existing '${DB_NAME}'.`);
        }
        console.log(`[PASS] Database '${DB_NAME}' is ready.`);

        // Switch to the database
        await connection.query(`USE \`${DB_NAME}\`;`);

        // 3. Apply schema.sql
        const schemaPath = path.resolve(__dirname, '..', '..', 'database', 'schema.sql');
        console.log(`Reading schema from: ${schemaPath}`);
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found at ${schemaPath}`);
        }
        const schemaSql = withoutDatabaseSwitch(fs.readFileSync(schemaPath, 'utf8'));
        console.log('Applying database schema...');
        await connection.query(schemaSql);
        console.log('[PASS] Database schema applied successfully.');

        // Bring older databases up to the current schema (idempotent)
        await runMigrations(connection, DB_NAME);

        // 4. Apply seed.sql (demo data with public demo passwords — never in production)
        if (IS_PRODUCTION) {
            console.log('[INFO] Production: demo seed data skipped.');
        } else if (process.env.SEED_DEMO_DATA !== 'false') {
        const seedPath = path.resolve(__dirname, '..', '..', 'database', 'seed.sql');
        console.log(`Reading seed data from: ${seedPath}`);
        if (!fs.existsSync(seedPath)) {
            throw new Error(`Seed file not found at ${seedPath}`);
        }
        const seedSql = withoutDatabaseSwitch(fs.readFileSync(seedPath, 'utf8'));
        console.log('Applying seed data...');
        await connection.query(seedSql);
        console.log('[PASS] Base seed data applied successfully.');
        }

        // 5. HR account
        console.log(`Ensuring HR account for email: ${DEMO_HR_EMAIL}...`);
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(DEMO_HR_PASSWORD, salt);

        if (IS_PRODUCTION) {
            // Create only; never change an existing user's password or role
            const [res] = await connection.query(
                `INSERT INTO users (name, email, password, role)
                 SELECT ?, ?, ?, 'HR' FROM DUAL
                 WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = ?)`,
                ['HR Manager', DEMO_HR_EMAIL, hashedPassword, DEMO_HR_EMAIL]
            );
            console.log(res.affectedRows ? '[PASS] HR account created.' : '[INFO] A user with this email already exists; left unchanged.');
        } else {
        await connection.query(
            `INSERT INTO users (name, email, password, role)
             VALUES (?, ?, ?, 'HR')
             ON DUPLICATE KEY UPDATE 
                name = VALUES(name),
                password = VALUES(password),
                role = 'HR';`,
            ['HR Manager', DEMO_HR_EMAIL, hashedPassword]
        );
        console.log('[PASS] Demo HR user account verified with secure bcrypt hash.');
        }

        console.log('--------------------------------------------------');
        console.log('DATABASE SETUP COMPLETED SUCCESSFULLY');
        console.log('--------------------------------------------------');
        return true;
    } catch (err) {
        // Sanitize error to ensure password/secrets are never printed
        const sanitizedMessage = (err.message || 'Unknown error').replace(
            new RegExp(DB_PASSWORD, 'g'),
            '*****'
        );
        console.error('[FAIL] Database setup encountered an error:');
        console.error(sanitizedMessage);
        if (err.sql) {
            console.error('SQL Error Code:', err.code);
        }
        process.exitCode = 1;
        throw err;
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed.');
        }
    }
}

// Run setup if invoked directly
if (require.main === module) {
    setupDatabase().catch(() => {
        process.exit(1);
    });
}

module.exports = { setupDatabase };
