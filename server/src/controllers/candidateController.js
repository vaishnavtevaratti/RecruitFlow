/**
 * RecruitFlow — Candidates Controller
 */

const recruitmentService = require('../services/recruitmentService');

/**
 * GET /api/candidates
 * Lists all candidate profiles (HR/Admin only).
 */
async function getCandidates(req, res, next) {
    try {
        const { search } = req.query;
        const candidates = await recruitmentService.getCandidates({ search });

        res.status(200).json({
            success: true,
            data: candidates
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/candidates/:id
 * Fetches single candidate details by ID.
 */
async function getCandidateById(req, res, next) {
    try {
        const id = Number(req.params.id);
        const candidate = await recruitmentService.getCandidateById(id);

        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate profile not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: candidate
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/candidates
 * Manually registers a candidate profile (HR/Admin only).
 */
async function createCandidate(req, res, next) {
    try {
        const candidate = await recruitmentService.createCandidate(req.body);

        res.status(201).json({
            success: true,
            message: 'Candidate profile created successfully.',
            data: candidate
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/candidates/:id
 * Updates an existing candidate's information.
 */
async function updateCandidate(req, res, next) {
    try {
        const id = Number(req.params.id);
        const updated = await recruitmentService.updateCandidate(id, req.body);

        res.status(200).json({
            success: true,
            message: 'Candidate profile updated successfully.',
            data: updated
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getCandidates,
    getCandidateById,
    createCandidate,
    updateCandidate
};
