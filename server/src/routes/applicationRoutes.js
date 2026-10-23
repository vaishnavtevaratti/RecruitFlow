/**
 * RecruitFlow — Application & Pipeline Routes
 */

const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { validateParamId } = require('../middleware/validationMiddleware');

// Public application submission
router.post('/', applicationController.apply);

// Public application status lookup (requires application_id + candidate email)
router.post('/public/status', applicationController.getPublicStatus);

// Protected routes

router.get(
    '/',
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    applicationController.getApplications
);

router.get(
    '/:id',
    validateParamId('id'),
    authenticateToken,
    authorizeRoles('HR', 'ADMIN', 'INTERVIEWER'),
    applicationController.getApplicationById
);

router.patch(
    '/:id/screen',
    validateParamId('id'),
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    applicationController.screenApplication
);

router.patch(
    '/:id/shortlist',
    validateParamId('id'),
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    applicationController.shortlistApplication
);

router.patch(
    '/:id/reject',
    validateParamId('id'),
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    applicationController.rejectApplication
);

router.patch(
    '/:id/select',
    validateParamId('id'),
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    applicationController.selectApplication
);

// Advisory skill match (HR/Admin only)
router.get(
    '/:id/skill-match',
    validateParamId('id'),
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    applicationController.getSkillMatch
);

// Final hiring step after the candidate accepted the offer
router.patch(
    '/:id/hire',
    validateParamId('id'),
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    applicationController.hireApplication
);

module.exports = router;
