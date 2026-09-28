/**
 * RecruitFlow — Offers & Hiring Routes
 */

const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');
const { authenticateToken, authorizeRoles, optionalAuthenticate } = require('../middleware/authMiddleware');
const { requireFields, validateParamId } = require('../middleware/validationMiddleware');

// Issue offer (HR/Admin)
router.post(
    '/',
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    requireFields(['application_id', 'salary', 'offer_date', 'joining_date', 'expiry_date']),
    offerController.createOffer
);

// View offers (HR/Admin)
router.get(
    '/',
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    offerController.getOffers
);

router.get(
    '/:id',
    validateParamId('id'),
    authenticateToken,
    authorizeRoles('HR', 'ADMIN'),
    offerController.getOfferById
);

// Candidate / HR acceptance and rejection of offer
router.patch(
    '/:id/accept',
    validateParamId('id'),
    optionalAuthenticate,
    offerController.acceptOffer
);

router.patch(
    '/:id/reject',
    validateParamId('id'),
    optionalAuthenticate,
    offerController.rejectOffer
);

module.exports = router;
