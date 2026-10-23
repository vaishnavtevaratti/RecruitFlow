/**
 * RecruitFlow — Applications Controller & Pipeline Workflow
 */

const recruitmentService = require('../services/recruitmentService');
const { computeSkillMatch } = require('../services/skillMatchService');

/**
 * POST /api/applications
 * Public endpoint allowing candidates to submit applications for PUBLISHED openings.
 */
async function apply(req, res, next) {
    try {
        const { job_id, candidate, name, email, phone, education, skills, experience, resume_url } = req.body;

        if (!job_id) {
            return res.status(400).json({
                success: false,
                message: 'job_id is required to submit an application.'
            });
        }

        // Support both candidate nested object or flattened payload (only whitelisted profile fields)
        const source = candidate && typeof candidate === 'object' ? candidate : { name, email, phone, education, skills, experience, resume_url };
        const candidateData = {
            name: source.name,
            email: source.email,
            phone: source.phone,
            education: source.education,
            skills: source.skills,
            experience: source.experience,
            resume_url: source.resume_url
        };

        if (!candidateData.name || !candidateData.email) {
            return res.status(400).json({
                success: false,
                message: 'Candidate name and valid email are required.'
            });
        }

        const application = await recruitmentService.applyForJob({
            job_id: Number(job_id),
            candidate: candidateData
        });

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
 * GET /api/applications
 * Lists applications with optional filters (job_id, status, search).
 */
async function getApplications(req, res, next) {
    try {
        const { job_id, status, search } = req.query;
        const applications = await recruitmentService.getApplications({
            job_id: job_id ? Number(job_id) : undefined,
            status,
            search
        });

        res.status(200).json({
            success: true,
            data: applications
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/applications/:id
 * Fetches application details with interview history and offer.
 */
async function getApplicationById(req, res, next) {
    try {
        const id = Number(req.params.id);
        const application = await recruitmentService.getApplicationById(id);

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found.'
            });
        }

        // Interviewers may only open applications they are assigned to interview
        if (req.user.role === 'INTERVIEWER' && !(await recruitmentService.isInterviewerAssigned(id, req.user.id))) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden. You are not assigned to an interview for this application.'
            });
        }

        res.status(200).json({
            success: true,
            data: application
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/applications/:id/screen
 * Progresses application from APPLIED to SCREENING.
 */
async function screenApplication(req, res, next) {
    try {
        const id = Number(req.params.id);
        const updated = await recruitmentService.screenApplication(id);

        res.status(200).json({
            success: true,
            message: 'Application advanced to SCREENING status.',
            data: updated
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/applications/:id/shortlist
 * Progresses application from SCREENING to SHORTLISTED.
 */
async function shortlistApplication(req, res, next) {
    try {
        const id = Number(req.params.id);
        const updated = await recruitmentService.shortlistApplication(id);

        res.status(200).json({
            success: true,
            message: 'Application shortlisted successfully. Ready for interview scheduling.',
            data: updated
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/applications/:id/reject
 * Marks an active application as REJECTED (terminal state).
 */
async function rejectApplication(req, res, next) {
    try {
        const id = Number(req.params.id);
        const updated = await recruitmentService.rejectApplication(id);

        res.status(200).json({
            success: true,
            message: 'Application marked as REJECTED.',
            data: updated
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/applications/:id/select
 * Selects candidate following passing interview evaluation.
 */
async function selectApplication(req, res, next) {
    try {
        const id = Number(req.params.id);
        const updated = await recruitmentService.selectApplication(id);

        res.status(200).json({
            success: true,
            message: 'Candidate selected for hire. Ready for offer generation.',
            data: updated
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/applications/:id/hire
 * Completes hiring for a candidate who accepted the offer (OFFER_ACCEPTED -> HIRED).
 */
async function hireApplication(req, res, next) {
    try {
        const id = Number(req.params.id);
        const updated = await recruitmentService.hireApplication(id);

        res.status(200).json({
            success: true,
            message: 'Candidate marked as HIRED. Recruitment workflow complete.',
            data: updated
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/applications/:id/skill-match
 * Rule-based, explainable comparison of job skills vs. candidate profile (HR/Admin).
 * Advisory only: it never changes the application's status.
 */
async function getSkillMatch(req, res, next) {
    try {
        const id = Number(req.params.id);
        const application = await recruitmentService.getApplicationById(id);
        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }
        const result = computeSkillMatch(
            { title: application.job_title, skills: application.job_skills },
            {
                skills: application.candidate_skills,
                experience: application.candidate_experience,
                education: application.candidate_education
            }
        );
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/applications/public/status
 * Public status lookup using application_id and candidate email.
 */
async function getPublicStatus(req, res, next) {
    try {
        const { application_id, email } = req.body;
        if (!application_id || !email) {
            return res.status(400).json({
                success: false,
                message: 'Both application_id and candidate email are required.'
            });
        }

        const data = await recruitmentService.getPublicApplicationStatus(Number(application_id), email);
        res.status(200).json({
            success: true,
            data
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    apply,
    getApplications,
    getApplicationById,
    screenApplication,
    shortlistApplication,
    rejectApplication,
    selectApplication,
    hireApplication,
    getSkillMatch,
    getPublicStatus
};

