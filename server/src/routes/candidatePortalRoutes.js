/**
 * RecruitFlow — Candidate Portal Routes
 * Role-protected endpoints for candidate self-service, tracking, and offer acceptance.
 */

const express = require('express');
const router = express.Router();
const candidatePortalController = require('../controllers/candidatePortalController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { validateParamId } = require('../middleware/validationMiddleware');

// All candidate portal routes require authentication and CANDIDATE role
router.use(authenticateToken);
router.use(authorizeRoles('CANDIDATE'));

// Profile & Dashboard
router.get('/me', candidatePortalController.getProfile);
router.put('/profile', candidatePortalController.updateProfile);
router.get('/dashboard', candidatePortalController.getDashboard);

// Applications
router.get('/applications', candidatePortalController.getApplications);
router.get(
    '/applications/:id',
    validateParamId('id'),
    candidatePortalController.getApplicationDetails
);
router.post('/apply', candidatePortalController.apply);

// Offer Responses
router.post(
    '/applications/:id/accept-offer',
    validateParamId('id'),
    candidatePortalController.acceptOffer
);
router.post(
    '/applications/:id/reject-offer',
    validateParamId('id'),
    candidatePortalController.rejectOffer
);

module.exports = router;
