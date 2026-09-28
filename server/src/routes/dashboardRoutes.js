/**
 * RecruitFlow — Dashboard Statistics Routes
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get(
    '/stats',
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    dashboardController.getStats
);

module.exports = router;
