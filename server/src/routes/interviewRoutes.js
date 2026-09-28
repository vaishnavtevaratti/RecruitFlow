/**
 * RecruitFlow — Interview Routes
 */

const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { requireFields, validateParamId } = require('../middleware/validationMiddleware');

router.use(authenticateToken);

// Schedule interview (HR/Admin)
router.post(
    '/',
    authorizeRoles('HR', 'ADMIN'),
    requireFields(['application_id', 'interviewer_id', 'scheduled_at', 'type']),
    interviewController.scheduleInterview
);

// View interviews (HR sees all, Interviewer sees assigned)
router.get('/', interviewController.getInterviews);
router.get('/:id', validateParamId('id'), interviewController.getInterviewById);

// Submit interview evaluation (Interviewer or HR/Admin)
router.put(
    '/:id/evaluate',
    validateParamId('id'),
    requireFields(['result']),
    interviewController.evaluateInterview
);

module.exports = router;
