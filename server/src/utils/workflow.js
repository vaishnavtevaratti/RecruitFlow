/**
 * RecruitFlow — Centralized Recruitment Workflow & State Machine Rules
 * Enforces business logic and valid status transitions across all operations.
 */

const JOB_STATES = Object.freeze({
    DRAFT: 'DRAFT',
    PUBLISHED: 'PUBLISHED',
    CLOSED: 'CLOSED'
});

const APPLICATION_STATES = Object.freeze({
    APPLIED: 'APPLIED',
    SCREENING: 'SCREENING',
    SHORTLISTED: 'SHORTLISTED',
    INTERVIEW_SCHEDULED: 'INTERVIEW_SCHEDULED',
    INTERVIEWED: 'INTERVIEWED',
    SELECTED: 'SELECTED',
    OFFER_SENT: 'OFFER_SENT',
    OFFER_ACCEPTED: 'OFFER_ACCEPTED',
    HIRED: 'HIRED',
    REJECTED: 'REJECTED'
});

const OFFER_STATES = Object.freeze({
    DRAFT: 'DRAFT',
    SENT: 'SENT',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    EXPIRED: 'EXPIRED'
});

const INTERVIEW_RESULTS = Object.freeze({
    PENDING: 'PENDING',
    PASS: 'PASS',
    FAIL: 'FAIL'
});

/**
 * Validates whether a job can be transitioned to PUBLISHED.
 * Only DRAFT jobs can be published. CLOSED jobs cannot be republished.
 */
function validateJobPublish(currentStatus) {
    if (currentStatus === JOB_STATES.CLOSED) {
        return { valid: false, message: 'Closed jobs cannot be republished.' };
    }
    if (currentStatus === JOB_STATES.PUBLISHED) {
        return { valid: false, message: 'Job is already published.' };
    }
    if (currentStatus !== JOB_STATES.DRAFT) {
        return { valid: false, message: `Invalid job status transition from ${currentStatus} to PUBLISHED.` };
    }
    return { valid: true };
}

/**
 * Validates whether a job can be transitioned to CLOSED.
 * Only PUBLISHED jobs can be closed.
 */
function validateJobClose(currentStatus) {
    if (currentStatus === JOB_STATES.CLOSED) {
        return { valid: false, message: 'Job is already closed.' };
    }
    if (currentStatus !== JOB_STATES.PUBLISHED) {
        return { valid: false, message: `Only published jobs can be closed. Current status: ${currentStatus}.` };
    }
    return { valid: true };
}

/**
 * Validates whether a job can accept new applications.
 */
function validateJobAcceptsApplications(job) {
    if (!job) {
        return { valid: false, message: 'Job opening does not exist.' };
    }
    if (job.status === JOB_STATES.CLOSED) {
        return { valid: false, message: 'Job opening is closed and cannot accept new applications.' };
    }
    if (job.status === JOB_STATES.DRAFT) {
        return { valid: false, message: 'Job opening is in draft status and not accepting applications.' };
    }
    if (job.status !== JOB_STATES.PUBLISHED) {
        return { valid: false, message: `Job is not open for applications. Current status: ${job.status}.` };
    }

    // Check application deadline
    if (job.deadline) {
        const deadlineDate = new Date(job.deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (deadlineDate < today) {
            return { valid: false, message: 'Application deadline for this job opening has passed.' };
        }
    }

    return { valid: true };
}

/**
 * Validates transition from APPLIED to SCREENING.
 */
function validateApplicationScreening(currentStatus) {
    if (currentStatus === APPLICATION_STATES.REJECTED) {
        return { valid: false, message: 'Cannot screen a rejected application.' };
    }
    if (currentStatus !== APPLICATION_STATES.APPLIED) {
        return { valid: false, message: `Cannot move to SCREENING from status '${currentStatus}'. Only APPLIED applications can be screened.` };
    }
    return { valid: true };
}

/**
 * Validates transition from SCREENING to SHORTLISTED.
 */
function validateApplicationShortlisting(currentStatus) {
    if (currentStatus === APPLICATION_STATES.REJECTED) {
        return { valid: false, message: 'Cannot shortlist a rejected application.' };
    }
    if (currentStatus === APPLICATION_STATES.APPLIED) {
        return { valid: false, message: 'Candidate must be screened before shortlisting. Direct APPLIED -> SHORTLISTED is prohibited.' };
    }
    if (currentStatus !== APPLICATION_STATES.SCREENING) {
        return { valid: false, message: `Cannot shortlist application with status '${currentStatus}'. Expected status: SCREENING.` };
    }
    return { valid: true };
}

/**
 * Validates whether an interview can be scheduled.
 * Only SHORTLISTED applications can receive an interview.
 */
function validateInterviewScheduling(currentStatus) {
    if (currentStatus === APPLICATION_STATES.REJECTED) {
        return { valid: false, message: 'Cannot schedule interview for a rejected candidate.' };
    }
    if (currentStatus !== APPLICATION_STATES.SHORTLISTED) {
        return { valid: false, message: `Only SHORTLISTED candidates can have interviews scheduled. Current status: ${currentStatus}.` };
    }
    return { valid: true };
}

/**
 * Validates whether an interview evaluation can be submitted.
 */
function validateInterviewEvaluation(interview, applicationStatus) {
    if (!interview) {
        return { valid: false, message: 'Interview record not found.' };
    }
    if (applicationStatus === APPLICATION_STATES.REJECTED) {
        return { valid: false, message: 'Cannot evaluate interview for a rejected application.' };
    }
    if (applicationStatus !== APPLICATION_STATES.INTERVIEW_SCHEDULED) {
        return { valid: false, message: `Application status must be INTERVIEW_SCHEDULED to submit evaluation. Current status: ${applicationStatus}.` };
    }
    return { valid: true };
}

/**
 * Validates selection: application must be INTERVIEWED and interview result must be PASS.
 */
function validateCandidateSelection(applicationStatus, latestInterviewResult) {
    if (applicationStatus === APPLICATION_STATES.REJECTED) {
        return { valid: false, message: 'Cannot select a rejected candidate.' };
    }
    if (applicationStatus !== APPLICATION_STATES.INTERVIEWED) {
        return { valid: false, message: `Candidate must complete interview before selection. Cannot select directly from status '${applicationStatus}'.` };
    }
    if (latestInterviewResult !== INTERVIEW_RESULTS.PASS) {
        return { valid: false, message: `Candidate must pass the interview before selection. Latest interview result: ${latestInterviewResult || 'NONE'}.` };
    }
    return { valid: true };
}

/**
 * Validates offer creation: application must be in SELECTED state.
 */
function validateOfferCreation(applicationStatus) {
    if (applicationStatus === APPLICATION_STATES.REJECTED) {
        return { valid: false, message: 'Cannot generate offer for a rejected candidate.' };
    }
    if (applicationStatus !== APPLICATION_STATES.SELECTED) {
        return { valid: false, message: `Only SELECTED candidates can receive an offer. Current status: ${applicationStatus}.` };
    }
    return { valid: true };
}

/**
 * Validates offer acceptance: offer must be SENT and not expired.
 */
function validateOfferAcceptance(offer) {
    if (!offer) {
        return { valid: false, message: 'Offer record not found.' };
    }
    if (offer.status === OFFER_STATES.ACCEPTED) {
        return { valid: false, message: 'Offer has already been accepted.' };
    }
    if (offer.status === OFFER_STATES.REJECTED) {
        return { valid: false, message: 'Cannot accept an offer that was previously rejected.' };
    }
    if (offer.status !== OFFER_STATES.SENT) {
        return { valid: false, message: `Offer must be in SENT status to be accepted. Current status: ${offer.status}.` };
    }

    if (offer.expiry_date) {
        const expiry = new Date(offer.expiry_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expiry < today) {
            return { valid: false, message: 'Offer has expired and can no longer be accepted.' };
        }
    }

    return { valid: true };
}

/**
 * Validates offer decline: offer must be SENT, not expired, and not already accepted/rejected.
 */
function validateOfferDecline(offer) {
    if (!offer) {
        return { valid: false, message: 'Offer record not found.' };
    }
    if (offer.status === OFFER_STATES.ACCEPTED) {
        return { valid: false, message: 'Cannot decline an offer that has already been accepted.' };
    }
    if (offer.status === OFFER_STATES.REJECTED) {
        return { valid: false, message: 'Offer has already been declined.' };
    }
    if (offer.status !== OFFER_STATES.SENT) {
        return { valid: false, message: `Offer must be in SENT status to be declined. Current status: ${offer.status}.` };
    }

    if (offer.expiry_date) {
        const expiry = new Date(offer.expiry_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expiry < today) {
            return { valid: false, message: 'Offer has expired and can no longer be declined.' };
        }
    }

    return { valid: true };
}

/**
 * Validates candidate rejection.
 */
function validateApplicationRejection(currentStatus) {
    if (currentStatus === APPLICATION_STATES.REJECTED) {
        return { valid: false, message: 'Application is already rejected.' };
    }
    if (currentStatus === APPLICATION_STATES.HIRED) {
        return { valid: false, message: 'Cannot reject a candidate who has already been hired.' };
    }
    return { valid: true };
}

module.exports = {
    JOB_STATES,
    APPLICATION_STATES,
    OFFER_STATES,
    INTERVIEW_RESULTS,
    validateJobPublish,
    validateJobClose,
    validateJobAcceptsApplications,
    validateApplicationScreening,
    validateApplicationShortlisting,
    validateInterviewScheduling,
    validateInterviewEvaluation,
    validateCandidateSelection,
    validateOfferCreation,
    validateOfferAcceptance,
    validateOfferDecline,
    validateApplicationRejection
};
