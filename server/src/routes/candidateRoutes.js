/**
 * RecruitFlow — Candidates Routes
 */

const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidateController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { requireFields, validateEmailField, validateParamId } = require('../middleware/validationMiddleware');

router.use(authenticateToken, authorizeRoles('HR', 'ADMIN'));

router.get('/', candidateController.getCandidates);
router.get('/:id', validateParamId('id'), candidateController.getCandidateById);

router.post(
    '/',
    requireFields(['name', 'email', 'phone', 'education', 'skills', 'experience']),
    validateEmailField('email'),
    candidateController.createCandidate
);

router.put(
    '/:id',
    validateParamId('id'),
    candidateController.updateCandidate
);

module.exports = router;
