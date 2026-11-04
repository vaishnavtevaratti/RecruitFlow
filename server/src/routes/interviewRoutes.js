/**
 * RecruitFlow — Interview Routes
 */

const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { requireFields, validateParamId } = require('../middleware/validationMiddleware');

// Interview data is staff-only. Candidates see their own interviews through /api/candidate.
router.use(authenticateToken, authorizeRoles('HR', 'ADMIN', 'INTERVIEWER'));

// Schedule interview (HR/Admin)
router.post(
    '/',
    authorizeRoles('HR', 'ADMIN'),
    requireFields(['application_id', 'interviewer_id', 'scheduled_at', 'type']),
    interviewController.scheduleInterview
);

// Staff users that can be assigned to interviews (HR/Admin)
router.get('/interviewers', authorizeRoles('HR', 'ADMIN'), interviewController.getInterviewers);

// View interviews (HR sees all, Interviewer sees assigned)
router.get('/', interviewController.getInterviews);
router.get('/:id', validateParamId('id'), interviewController.getInterviewById);

// Reschedule a pending interview (HR/Admin)
router.patch(
    '/:id/reschedule',
    validateParamId('id'),
    authorizeRoles('HR', 'ADMIN'),
    requireFields(['scheduled_at']),
    interviewController.rescheduleInterview
);

// Cancel a pending interview (HR/Admin)
router.patch('/:id/cancel', validateParamId('id'), authorizeRoles('HR', 'ADMIN'), interviewController.cancelInterview);

// Submit interview evaluation (Interviewer or HR/Admin)
router.put(
    '/:id/evaluate',
    validateParamId('id'),
    requireFields(['result']),
    interviewController.evaluateInterview
);

module.exports = router;
