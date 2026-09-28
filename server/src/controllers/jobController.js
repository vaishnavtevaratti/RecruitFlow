/**
 * RecruitFlow — Jobs Controller
 */

const recruitmentService = require('../services/recruitmentService');

/**
 * GET /api/jobs
 * Lists jobs. Public users receive only PUBLISHED jobs.
 * Authenticated HR/Admin can filter across all statuses.
 */
async function getJobs(req, res, next) {
    try {
        const isStaff = req.user && ['HR', 'ADMIN', 'INTERVIEWER'].includes(req.user.role);
        const { status, search, department } = req.query;

        const jobs = await recruitmentService.getJobs({
            status: isStaff ? status : 'PUBLISHED',
            search,
            department,
            publicOnly: !isStaff
        });

        res.status(200).json({
            success: true,
            data: jobs
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/jobs/:id
 * Fetches single job details by ID.
 */
async function getJobById(req, res, next) {
    try {
        const id = Number(req.params.id);
        const job = await recruitmentService.getJobById(id);

        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job opening not found.'
            });
        }

        // Public users cannot view DRAFT jobs
        const isStaff = req.user && ['HR', 'ADMIN', 'INTERVIEWER'].includes(req.user.role);
        if (!isStaff && job.status === 'DRAFT') {
            return res.status(404).json({
                success: false,
                message: 'Job opening not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: job
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/jobs
 * Creates a new job opening in DRAFT status (HR/Admin only).
 */
async function createJob(req, res, next) {
    try {
        const {
            title,
            department,
            description,
            skills,
            experience_required,
            location,
            employment_type,
            salary_min,
            salary_max,
            deadline
        } = req.body;

        const job = await recruitmentService.createJob(
            {
                title,
                department,
                description,
                skills,
                experience_required,
                location,
                employment_type,
                salary_min,
                salary_max,
                deadline
            },
            req.user.id
        );

        res.status(201).json({
            success: true,
            message: 'Job opening created in DRAFT status successfully.',
            data: job
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/jobs/:id
 * Updates job requisition details (HR/Admin only).
 */
async function updateJob(req, res, next) {
    try {
        const id = Number(req.params.id);
        const updated = await recruitmentService.updateJob(id, req.body);

        res.status(200).json({
            success: true,
            message: 'Job opening updated successfully.',
            data: updated
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/jobs/:id/publish
 * Publishes a DRAFT job (HR/Admin only).
 */
async function publishJob(req, res, next) {
    try {
        const id = Number(req.params.id);
        const published = await recruitmentService.publishJob(id);

        res.status(200).json({
            success: true,
            message: 'Job opening published successfully. Now accepting applications.',
            data: published
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/jobs/:id/close
 * Closes an active PUBLISHED job (HR/Admin only).
 */
async function closeJob(req, res, next) {
    try {
        const id = Number(req.params.id);
        const closed = await recruitmentService.closeJob(id);

        res.status(200).json({
            success: true,
            message: 'Job opening closed successfully. Applications are now locked.',
            data: closed
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getJobs,
    getJobById,
    createJob,
    updateJob,
    publishJob,
    closeJob
};
