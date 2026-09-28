/**
 * RecruitFlow — Authentication Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireFields, validateEmailField } = require('../middleware/validationMiddleware');

// POST /api/auth/login
router.post(
    '/login',
    requireFields(['email', 'password']),
    validateEmailField('email'),
    authController.login
);

// POST /api/auth/candidate/signup
router.post(
    '/candidate/signup',
    requireFields(['name', 'email', 'password']),
    validateEmailField('email'),
    authController.candidateSignup
);

// POST /api/auth/candidate/login
router.post(
    '/candidate/login',
    requireFields(['email', 'password']),
    validateEmailField('email'),
    authController.candidateLogin
);

// GET /api/auth/me
router.get(
    '/me',
    authenticateToken,
    authController.getMe
);

module.exports = router;

