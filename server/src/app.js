/**
 * RecruitFlow — Express Application Setup
 */

const express = require('express');
const cors = require('cors');
const { checkDatabaseConnection } = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const jobRoutes = require('./routes/jobRoutes');
const candidateRoutes = require('./routes/candidateRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const offerRoutes = require('./routes/offerRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const candidatePortalRoutes = require('./routes/candidatePortalRoutes');

// Import middleware
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Enable CORS for frontend clients
app.use(cors());

// Parse incoming JSON payloads
app.use(express.json());

// -----------------------------------------------------------------------------
// Health Check Endpoints
// -----------------------------------------------------------------------------

// Basic API health
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'RecruitFlow API is running'
    });
});

// Database connectivity health check
app.get('/api/health/db', async (req, res) => {
    try {
        const isConnected = await checkDatabaseConnection();
        if (isConnected) {
            return res.status(200).json({
                success: true,
                message: 'Database connection is healthy',
                database: process.env.DB_NAME || 'recruitflow'
            });
        }
        res.status(503).json({
            success: false,
            message: 'Database connection failed'
        });
    } catch (err) {
        res.status(503).json({
            success: false,
            message: 'Database connection check encountered an error'
        });
    }
});

// -----------------------------------------------------------------------------
// API Routes Mount
// -----------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/candidate', candidatePortalRoutes);


// -----------------------------------------------------------------------------
// Error Handlers
// -----------------------------------------------------------------------------
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
