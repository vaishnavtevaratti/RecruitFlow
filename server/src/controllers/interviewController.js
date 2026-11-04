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
 * GET /api/interviews/interviewers
 * Lists staff accounts that can be assigned as interviewers (HR/Admin only).
 */
async function getInterviewers(req, res, next) {
    try {
        const interviewers = await recruitmentService.getInterviewers();
        res.status(200).json({
            success: true,
            data: interviewers
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
            interviewerId: req.user.id,
            role: req.user.role
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

        if (req.user.role === 'INTERVIEWER' && interview.interviewer_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden. You can only view interviews assigned to you.'
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
 * PATCH /api/interviews/:id/reschedule
 * Moves a pending interview to a new date/time (HR/Admin only).
 */
async function rescheduleInterview(req, res, next) {
    try {
        const id = Number(req.params.id);
        const { scheduled_at, meeting_link, interviewer_id, type } = req.body;
        const updated = await recruitmentService.rescheduleInterview(id, {
            scheduled_at,
            meeting_link,
            interviewer_id,
            type
        });

        res.status(200).json({
            success: true,
            message: 'Interview rescheduled successfully.',
            data: updated
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

/**
 * PATCH /api/interviews/:id/cancel
 * Cancels a pending interview; the application returns to SHORTLISTED (HR/Admin only).
 */
async function cancelInterview(req, res, next) {
    try {
        const application = await recruitmentService.cancelInterview(Number(req.params.id));
        res.status(200).json({ success: true, message: 'Interview cancelled. The candidate is back on the shortlist.', data: application });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    cancelInterview,
    scheduleInterview,
    getInterviewers,
    getInterviews,
    getInterviewById,
    rescheduleInterview,
    evaluateInterview
};
