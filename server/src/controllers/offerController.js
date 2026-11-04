/**
 * RecruitFlow — Offers & Hiring Controller
 */

const recruitmentService = require('../services/recruitmentService');

/**
 * POST /api/offers
 * Issues formal job offer to a SELECTED candidate (HR/Admin only).
 */
async function createOffer(req, res, next) {
    try {
        const { application_id, designation, notes, salary, offer_date, joining_date, expiry_date } = req.body;

        const offer = await recruitmentService.createOffer({
            application_id: Number(application_id),
            designation,
            notes,
            salary,
            offer_date,
            joining_date,
            expiry_date
        });

        res.status(201).json({
            success: true,
            message: 'Offer letter issued successfully. Application moved to OFFER_SENT.',
            data: offer
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/offers
 * Lists all offer records (HR/Admin only).
 */
async function getOffers(req, res, next) {
    try {
        const { status } = req.query;
        const offers = await recruitmentService.getOffers({ status });

        res.status(200).json({
            success: true,
            data: offers
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/offers/:id
 * Fetches single offer details by ID.
 */
async function getOfferById(req, res, next) {
    try {
        const id = Number(req.params.id);
        const offer = await recruitmentService.getOfferById(id);

        if (!offer) {
            return res.status(404).json({
                success: false,
                message: 'Offer record not found.'
            });
        }

        res.status(200).json({
            success: true,
            data: offer
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/offers/:id/accept
 * HR records a candidate acceptance received outside the portal; marks offer ACCEPTED
 * and application OFFER_ACCEPTED. Hiring is a separate HR step (PATCH /applications/:id/hire).
 */
async function acceptOffer(req, res, next) {
    try {
        const id = Number(req.params.id);
        const accepted = await recruitmentService.acceptOffer(id);

        res.status(200).json({
            success: true,
            message: 'Offer acceptance recorded. Application moved to OFFER_ACCEPTED.',
            data: accepted
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/offers/:id/reject
 * HR records a candidate decline received outside the portal; marks offer REJECTED and application REJECTED.
 */
async function rejectOffer(req, res, next) {
    try {
        const id = Number(req.params.id);
        const rejected = await recruitmentService.rejectOffer(id);

        res.status(200).json({
            success: true,
            message: 'Offer declined. Application marked as REJECTED.',
            data: rejected
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    createOffer,
    getOffers,
    getOfferById,
    acceptOffer,
    rejectOffer
};
