/**
 * RecruitFlow — Interviews Controller
 */

const recruitmentService = require('../services/recruitmentService');

/**
 * POST /api/interviews
 * Schedules an interview for a SHORTLISTED application (HR/Admin only).
 */
async function scheduleInterview(req, res, next) {
    try {
        const { application_id, interviewer_id, scheduled_at, type, meeting_link } = req.body;

        const interview = await recruitmentService.scheduleInterview({
            application_id: Number(application_id),
            interviewer_id: Number(interviewer_id),
            scheduled_at,
            type,
            meeting_link
        });

        res.status(201).json({
            success: true,
            message: 'Interview scheduled successfully. Application moved to INTERVIEW_SCHEDULED.',
            data: interview
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/interviews
 * Lists scheduled and completed interviews.
 * HR/Admin views all; Interviewers view their assigned rounds.
 */
async function getInterviews(req, res, next) {
    try {
        const interviews = await recruitmentService.getInterviews({
            interviewerId: req.user ? req.user.id : null,
            role: req.user ? req.user.role : 'HR'
        });

        res.status(200).json({
            success: true,
            data: interviews
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/interviews/:id
 * Fetches single interview round details.
 */
async function getInterviewById(req, res, next) {
    try {
        const id = Number(req.params.id);
        const interview = await recruitmentService.getInterviewById(id);

        if (!interview) {
            return res.status(404).json({
                success: false,
                message: 'Interview record not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: interview
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/interviews/:id/evaluate
 * Submits multi-criteria evaluation, score, feedback, and PASS/FAIL result.
 */
async function evaluateInterview(req, res, next) {
    try {
        const id = Number(req.params.id);
        const updated = await recruitmentService.evaluateInterview(id, req.body, req.user);

        res.status(200).json({
            success: true,
            message: 'Interview evaluated successfully. Application moved to INTERVIEWED.',
            data: updated
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    scheduleInterview,
    getInterviews,
    getInterviewById,
    evaluateInterview
};
