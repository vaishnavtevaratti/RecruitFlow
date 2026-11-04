/**
 * RecruitFlow — Job Opening Routes
 */

const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { authenticateToken, optionalAuthenticate, authorizeRoles } = require('../middleware/authMiddleware');
const { requireFields, validateParamId } = require('../middleware/validationMiddleware');

// Public listing (or all for authenticated staff)
router.get('/', optionalAuthenticate, jobController.getJobs);
router.get('/:id', validateParamId('id'), optionalAuthenticate, jobController.getJobById);

// Protected HR/Admin actions
router.post(
    '/',
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    requireFields(['title', 'department', 'description', 'skills', 'experience_required', 'location', 'deadline']),
    jobController.createJob
);

router.put(
    '/:id',
    validateParamId('id'),
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    jobController.updateJob
);

router.patch(
    '/:id/publish',
    validateParamId('id'),
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    jobController.publishJob
);

router.patch(
    '/:id/close',
    validateParamId('id'),
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    jobController.closeJob
);

router.patch(
    '/:id/reopen',
    validateParamId('id'),
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    jobController.reopenJob
);

router.delete(
    '/:id',
    validateParamId('id'),
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    jobController.deleteJob
);

module.exports = router;
