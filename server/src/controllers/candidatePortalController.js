/**
 * RecruitFlow — Candidate Portal Controller
 * Provides authenticated candidate profile, application tracking, and offer acceptance.
 */

const recruitmentService = require('../services/recruitmentService');

/**
 * GET /api/candidate/me
 * Retrieves candidate and user profile for authenticated candidate.
 */
async function getProfile(req, res, next) {
    try {
        const profile = await recruitmentService.getCandidateProfile(req.user.id);
        res.status(200).json({
            success: true,
            data: profile
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PUT /api/candidate/profile
 * Updates candidate profile details.
 */
async function updateProfile(req, res, next) {
    try {
        const updated = await recruitmentService.updateCandidateProfile(req.user.id, req.body);
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully.',
            data: updated
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/candidate/dashboard
 * Summary statistics and recent applications for candidate.
 */
async function getDashboard(req, res, next) {
    try {
        const stats = await recruitmentService.getCandidateDashboardStats(req.user.id);
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/candidate/applications
 * Returns all applications submitted by authenticated candidate.
 */
async function getApplications(req, res, next) {
    try {
        const applications = await recruitmentService.getCandidateApplications(req.user.id);
        res.status(200).json({
            success: true,
            data: applications
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/candidate/applications/:id
 * Detailed application view including timeline, interview status, and offer details.
 * Strictly verifies candidate ownership to prevent IDOR vulnerabilities.
 */
async function getApplicationDetails(req, res, next) {
    try {
        const applicationId = Number(req.params.id);
        const details = await recruitmentService.getCandidateApplicationDetails(req.user.id, applicationId);
        res.status(200).json({
            success: true,
            data: details
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/candidate/apply
 * Authenticated candidate applies to a published job opening.
 */
async function apply(req, res, next) {
    try {
        const { job_id } = req.body;
        if (!job_id) {
            return res.status(400).json({
                success: false,
                message: 'job_id is required to submit an application.'
            });
        }

        const application = await recruitmentService.applyAsCandidate(req.user.id, req.body);
        res.status(201).json({
            success: true,
            message: 'Application submitted successfully. Status is APPLIED.',
            data: application
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/candidate/applications/:id/accept-offer
 * Candidate accepts job offer.
 * Performs atomic transaction: offers.status = 'ACCEPTED', applications.status = 'OFFER_ACCEPTED'.
 */
async function acceptOffer(req, res, next) {
    try {
        const applicationId = Number(req.params.id);
        const result = await recruitmentService.candidateAcceptOffer(req.user.id, applicationId);

        res.status(200).json({
            success: true,
            message: 'Offer accepted. The hiring team will confirm your onboarding shortly.',
            data: result
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/candidate/applications/:id/reject-offer
 * Candidate declines job offer.
 */
async function rejectOffer(req, res, next) {
    try {
        const applicationId = Number(req.params.id);
        const result = await recruitmentService.candidateRejectOffer(req.user.id, applicationId);

        res.status(200).json({
            success: true,
            message: 'Offer declined.',
            data: result
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getProfile,
    updateProfile,
    getDashboard,
    getApplications,
    getApplicationDetails,
    apply,
    acceptOffer,
    rejectOffer
};
