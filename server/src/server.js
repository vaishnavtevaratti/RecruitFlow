/**
 * RecruitFlow — Backend Server Entry Point
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = require('./app');
const { checkDatabaseConnection, pool } = require('./config/db');

const PORT = process.env.PORT || 5000;

async function startServer() {
    console.log('--------------------------------------------------');
    console.log('Starting RecruitFlow Backend Server...');
    console.log('--------------------------------------------------');

    if (!process.env.JWT_SECRET) {
        console.error('[FATAL] JWT_SECRET is not set in server/.env. Refusing to start without a signing secret.');
        process.exit(1);
    }

    // Test database connection before opening port
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
        console.error('[WARNING] Initial database connection check failed. Ensure MySQL service is running.');
    } else {
        console.log(`[PASS] Connected to MySQL database '${process.env.DB_NAME || 'recruitflow'}'.`);
    }

    const server = app.listen(PORT, () => {
        console.log(`[PASS] Server running on port ${PORT}`);
        console.log(`[READY] Health check: http://localhost:${PORT}/api/health`);
        console.log(`[READY] Database check: http://localhost:${PORT}/api/health/db`);
        console.log('--------------------------------------------------');
    });

    // Graceful shutdown handling
    function shutdown(signal) {
        console.log(`\nReceived ${signal}. Shutting down gracefully...`);
        server.close(async () => {
            console.log('HTTP server closed.');
            try {
                await pool.end();
                console.log('Database pool drained.');
            } catch (err) {
                console.error('Error closing database pool:', err.message);
            }
            process.exit(0);
        });
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
}

if (require.main === module) {
    startServer();
}

module.exports = { startServer };
