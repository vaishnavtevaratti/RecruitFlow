/**
 * RecruitFlow — Dashboard Statistics Controller
 */

const recruitmentService = require('../services/recruitmentService');

/**
 * GET /api/dashboard/stats
 * Returns live recruitment dashboard statistics and pipeline funnel counts.
 */
async function getStats(req, res, next) {
    try {
        const stats = await recruitmentService.getDashboardStats();

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getStats
};
