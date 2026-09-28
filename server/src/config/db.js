/**
 * RecruitFlow — Database Configuration & Connection Pool
 * Uses mysql2/promise for connection pooling and parameterized queries.
 */

const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

// Ensure server/.env is loaded
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const {
    DB_HOST = '127.0.0.1',
    DB_PORT = 3306,
    DB_USER = 'root',
    DB_PASSWORD = '',
    DB_NAME = 'recruitflow'
} = process.env;

// Create connection pool with sensible limits for robust local/demo usage
const pool = mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

/**
 * Executes a parameterized query using the pool.
 * @param {string} sql - SQL query with '?' placeholders
 * @param {Array} params - Parameters for the query
 * @returns {Promise<[Array, Object]>}
 */
async function query(sql, params = []) {
    return pool.execute(sql, params);
}

/**
 * Health check function to verify active database connectivity.
 * @returns {Promise<boolean>}
 */
async function checkDatabaseConnection() {
    try {
        const [rows] = await pool.query('SELECT 1 AS connected');
        return rows && rows[0] && rows[0].connected === 1;
    } catch (err) {
        console.error('[DB HEALTH CHECK ERROR]', err.message);
        return false;
    }
}

module.exports = {
    pool,
    query,
    checkDatabaseConnection
};
