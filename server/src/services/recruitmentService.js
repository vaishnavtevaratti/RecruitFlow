/**
 * RecruitFlow — Core Recruitment Service
 * Handles business logic, transactional database queries, and state management.
 *
 * Concurrency: every status transition runs inside a transaction that locks the
 * application row (SELECT ... FOR UPDATE) before validating, so duplicate clicks or
 * concurrent requests cannot both pass the same state check.
 */

const crypto = require('crypto');
const { pool } = require('../config/db');
const workflow = require('../utils/workflow');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');
const { isValidDateOnly, isPastDate, normalizeDateTime, dateTimeToDate } = require('../utils/dates');
const { isValidEmail, isHttpUrl, badRequest, assertStringFields } = require('../middleware/validationMiddleware');

function httpError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

/**
 * SQL expression for an offer's effective status: a SENT offer past its expiry
 * date is reported as EXPIRED without rewriting the stored row.
 */
function offerStatusSql(alias = 'o') {
    return `CASE WHEN ${alias}.status = 'SENT' AND ${alias}.expiry_date < CURDATE() THEN 'EXPIRED' ELSE ${alias}.status END`;
}

const STAFF_ROLES = ['HR', 'ADMIN', 'INTERVIEWER'];
const MAX_SALARY = 9999999999; // DECIMAL(12,2)

const CANDIDATE_FIELD_RULES = {
    name: { max: 100, label: 'Name' },
    phone: { max: 50, label: 'Phone' },
    education: { max: 255, label: 'Education' },
    skills: { max: 2000, label: 'Skills' },
    experience: { max: 50, label: 'Experience' }
};

const JOB_FIELD_RULES = {
    title: { max: 150, required: true, label: 'Title' },
    department: { max: 100, required: true, label: 'Department' },
    description: { max: 10000, required: true, label: 'Description' },
    skills: { max: 2000, required: true, label: 'Skills' },
    experience_required: { max: 50, required: true, label: 'Experience required' },
    location: { max: 100, required: true, label: 'Location' },
    employment_type: { max: 50, label: 'Employment type' }
};

function trimOrNull(value) {
    if (value === undefined || value === null) return null;
    const t = String(value).trim();
    return t === '' ? null : t;
}

/**
 * Validates candidate profile fields (all optional unless requireName).
 */
function validateCandidateInput(data, { requireName = false } = {}) {
    const rules = { ...CANDIDATE_FIELD_RULES, name: { ...CANDIDATE_FIELD_RULES.name, required: requireName } };
    assertStringFields(data, rules);
    if (data.name !== undefined && data.name !== null && String(data.name).trim() === '') {
        throw badRequest('Name cannot be empty.');
    }
    if (data.phone && !/^[0-9+()\-.\s]{5,50}$/.test(String(data.phone).trim())) {
        throw badRequest('Phone number may only contain digits, spaces, and + ( ) - . characters.');
    }
    if (data.resume_url && !isHttpUrl(String(data.resume_url).trim())) {
        throw badRequest('Resume URL must be a valid http(s) link.');
    }
}

function parseSalary(value, label) {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0 || num > MAX_SALARY) {
        throw badRequest(`${label} must be a non-negative number.`);
    }
    return num;
}

/**
 * Validates a complete job record (used for create and for the merged result of an update).
 */
function validateJobInput(job, { isCreate }) {
    assertStringFields(job, JOB_FIELD_RULES);
    const salaryMin = parseSalary(job.salary_min, 'Minimum salary');
    const salaryMax = parseSalary(job.salary_max, 'Maximum salary');
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
        throw badRequest('Minimum salary cannot be greater than maximum salary.');
    }
    if (!isValidDateOnly(job.deadline)) {
        throw badRequest('Deadline must be a valid date (YYYY-MM-DD).');
    }
    if (isCreate && isPastDate(job.deadline)) {
        throw badRequest('Deadline cannot be in the past.');
    }
    return { salaryMin, salaryMax };
}

class RecruitmentService {
    // =========================================================================
    // 0. TRANSACTION HELPERS
    // =========================================================================

    async withTransaction(fn) {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const result = await fn(conn);
            await conn.commit();
            return result;
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async lockApplication(conn, id) {
        const [rows] = await conn.execute(
            'SELECT id, candidate_id, job_id, status FROM applications WHERE id = ? FOR UPDATE',
            [id]
        );
        if (!rows[0]) throw httpError(404, 'Application not found');
        return rows[0];
    }

    async lockOfferByApplication(conn, applicationId) {
        const [rows] = await conn.execute(
            'SELECT id, application_id, status, expiry_date FROM offers WHERE application_id = ? FOR UPDATE',
            [applicationId]
        );
        return rows[0] || null;
    }

    /**
     * Generic validated status transition on an application.
     */
    async transitionApplication(id, validate, toStatus) {
        await this.withTransaction(async (conn) => {
            const app = await this.lockApplication(conn, id);
            const validation = validate(app.status);
            if (!validation.valid) throw httpError(400, validation.message);
            await conn.execute('UPDATE applications SET status = ? WHERE id = ?', [toStatus, id]);
        });
        return this.getApplicationById(id);
    }

    // =========================================================================
    // 1. AUTH & USERS
    // =========================================================================

    async findUserByEmail(email) {
        const [rows] = await pool.execute(
            'SELECT id, name, email, password, role FROM users WHERE email = ?',
            [email.toLowerCase().trim()]
        );
        return rows[0] || null;
    }

    async findUserById(id) {
        const [rows] = await pool.execute(
            'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Staff users who can be assigned as interviewers.
     */
    async getInterviewers() {
        const [rows] = await pool.execute(
            `SELECT id, name, email, role FROM users
             WHERE role IN ('INTERVIEWER', 'HR', 'ADMIN')
             ORDER BY FIELD(role, 'INTERVIEWER', 'HR', 'ADMIN'), name`
        );
        return rows;
    }

    // =========================================================================
    // 2. JOBS
    // =========================================================================

    async getJobs({ status, search, department, location, employment_type, publicOnly = false } = {}) {
        let sql = `
            SELECT j.id, j.title, j.department, j.description, j.skills,
                   j.experience_required, j.location, j.employment_type,
                   j.salary_min, j.salary_max, j.deadline, j.status,
                   j.created_by, u.name AS creator_name, j.created_at, j.updated_at,
                   (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS application_count
            FROM jobs j
            LEFT JOIN users u ON j.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (publicOnly) {
            // Candidates only see openings they can actually apply to
            sql += ` AND j.status = 'PUBLISHED' AND j.deadline >= CURDATE()`;
        } else if (status) {
            sql += ` AND j.status = ?`;
            params.push(status);
        }

        if (department) {
            sql += ` AND j.department = ?`;
            params.push(department);
        }

        if (location) {
            sql += ` AND j.location = ?`;
            params.push(location);
        }

        if (employment_type) {
            sql += ` AND j.employment_type = ?`;
            params.push(employment_type);
        }

        if (search) {
            sql += ` AND (j.title LIKE ? OR j.skills LIKE ? OR j.description LIKE ?)`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        sql += ` ORDER BY j.created_at DESC`;

        const [rows] = await pool.execute(sql, params);
        if (publicOnly) {
            // application_count is internal pipeline information
            return rows.map(({ application_count, ...job }) => job);
        }
        return rows;
    }

    async getJobById(id) {
        const [rows] = await pool.execute(
            `SELECT j.id, j.title, j.department, j.description, j.skills,
                    j.experience_required, j.location, j.employment_type,
                    j.salary_min, j.salary_max, j.deadline, j.status,
                    j.created_by, u.name AS creator_name, j.created_at, j.updated_at
             FROM jobs j
             LEFT JOIN users u ON j.created_by = u.id
             WHERE j.id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    async createJob(data, userId) {
        const job = {
            title: trimOrNull(data.title),
            department: trimOrNull(data.department),
            description: trimOrNull(data.description),
            skills: trimOrNull(data.skills),
            experience_required: trimOrNull(data.experience_required),
            location: trimOrNull(data.location),
            employment_type: trimOrNull(data.employment_type) || 'Full-time',
            salary_min: data.salary_min,
            salary_max: data.salary_max,
            deadline: data.deadline
        };
        const { salaryMin, salaryMax } = validateJobInput(job, { isCreate: true });

        const [result] = await pool.execute(
            `INSERT INTO jobs (
                title, department, description, skills, experience_required,
                location, employment_type, salary_min, salary_max, deadline,
                status, created_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
            [
                job.title, job.department, job.description, job.skills, job.experience_required,
                job.location, job.employment_type, salaryMin, salaryMax, job.deadline,
                userId
            ]
        );

        return this.getJobById(result.insertId);
    }

    async updateJob(id, data) {
        const existing = await this.getJobById(id);
        if (!existing) throw httpError(404, 'Job not found');
        if (existing.status === workflow.JOB_STATES.CLOSED) {
            throw httpError(400, 'Closed jobs cannot be edited.');
        }

        const pick = (field) => (data[field] !== undefined ? data[field] : existing[field]);
        const job = {
            title: trimOrNull(pick('title')),
            department: trimOrNull(pick('department')),
            description: trimOrNull(pick('description')),
            skills: trimOrNull(pick('skills')),
            experience_required: trimOrNull(pick('experience_required')),
            location: trimOrNull(pick('location')),
            employment_type: trimOrNull(pick('employment_type')) || 'Full-time',
            salary_min: pick('salary_min'),
            salary_max: pick('salary_max'),
            deadline: pick('deadline')
        };
        const { salaryMin, salaryMax } = validateJobInput(job, { isCreate: false });
        if (data.deadline !== undefined && data.deadline !== existing.deadline && isPastDate(job.deadline)) {
            throw badRequest('Deadline cannot be moved into the past.');
        }

        await pool.execute(
            `UPDATE jobs
             SET title = ?, department = ?, description = ?, skills = ?,
                 experience_required = ?, location = ?, employment_type = ?,
                 salary_min = ?, salary_max = ?, deadline = ?
             WHERE id = ?`,
            [
                job.title, job.department, job.description, job.skills,
                job.experience_required, job.location, job.employment_type,
                salaryMin, salaryMax, job.deadline, id
            ]
        );

        return this.getJobById(id);
    }

    async setJobStatus(id, validate, toStatus) {
        await this.withTransaction(async (conn) => {
            const [rows] = await conn.execute('SELECT id, status FROM jobs WHERE id = ? FOR UPDATE', [id]);
            if (!rows[0]) throw httpError(404, 'Job not found');
            const validation = validate(rows[0].status);
            if (!validation.valid) throw httpError(400, validation.message);
            await conn.execute('UPDATE jobs SET status = ? WHERE id = ?', [toStatus, id]);
        });
        return this.getJobById(id);
    }

    async publishJob(id) {
        const job = await this.getJobById(id);
        if (job && job.status === workflow.JOB_STATES.DRAFT && isPastDate(job.deadline)) {
            throw httpError(400, 'Cannot publish a job whose application deadline has already passed. Update the deadline first.');
        }
        return this.setJobStatus(id, workflow.validateJobPublish, workflow.JOB_STATES.PUBLISHED);
    }

    async closeJob(id) {
        return this.setJobStatus(id, workflow.validateJobClose, workflow.JOB_STATES.CLOSED);
    }

    async reopenJob(id) {
        const job = await this.getJobById(id);
        if (job && job.status === workflow.JOB_STATES.CLOSED && isPastDate(job.deadline)) {
            throw httpError(400, 'Cannot reopen a job whose application deadline has passed.');
        }
        return this.setJobStatus(id, workflow.validateJobReopen, workflow.JOB_STATES.PUBLISHED);
    }

    /**
     * Deletes a job only when no application references it, so pipeline history is never lost.
     */
    async deleteJob(id) {
        await this.withTransaction(async (conn) => {
            const [rows] = await conn.execute('SELECT id FROM jobs WHERE id = ? FOR UPDATE', [id]);
            if (!rows[0]) throw httpError(404, 'Job not found');
            const [[{ n }]] = await conn.execute('SELECT COUNT(*) AS n FROM applications WHERE job_id = ?', [id]);
            if (n > 0) throw httpError(409, 'This job has applications and cannot be deleted. Close it instead.');
            await conn.execute('DELETE FROM jobs WHERE id = ?', [id]);
        });
    }

    // =========================================================================
    // 3. CANDIDATES
    // =========================================================================

    async getCandidates({ search } = {}) {
        let sql = `SELECT c.id, c.user_id, c.name, c.email, c.phone, c.education, c.skills, c.experience, c.resume_url,
                          c.created_at, c.updated_at,
                          (SELECT COUNT(*) FROM applications a WHERE a.candidate_id = c.id) AS application_count
                   FROM candidates c WHERE 1=1`;
        const params = [];

        if (search) {
            sql += ` AND (c.name LIKE ? OR c.email LIKE ? OR c.skills LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        sql += ` ORDER BY c.created_at DESC`;
        const [rows] = await pool.execute(sql, params);
        return rows;
    }

    async getCandidateById(id) {
        const [rows] = await pool.execute(
            `SELECT id, user_id, name, email, phone, education, skills, experience, resume_url, created_at, updated_at
             FROM candidates WHERE id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    async findCandidateByEmail(email) {
        const [rows] = await pool.execute(
            `SELECT id, user_id, name, email, phone, education, skills, experience, resume_url, created_at, updated_at
             FROM candidates WHERE email = ?`,
            [email.toLowerCase().trim()]
        );
        return rows[0] || null;
    }

    async findCandidateByUserId(userId) {
        const [rows] = await pool.execute(
            `SELECT id, user_id, name, email, phone, education, skills, experience, resume_url, created_at, updated_at
             FROM candidates WHERE user_id = ?`,
            [userId]
        );
        if (rows[0]) return rows[0];

        // Fallback: link an unlinked candidate record that shares the account email
        const user = await this.findUserById(userId);
        if (user) {
            const candidate = await this.findCandidateByEmail(user.email);
            if (candidate && !candidate.user_id) {
                await pool.execute('UPDATE candidates SET user_id = ? WHERE id = ? AND user_id IS NULL', [userId, candidate.id]);
                candidate.user_id = userId;
                return candidate;
            }
            return candidate && candidate.user_id === userId ? candidate : null;
        }
        return null;
    }

    async createCandidate(data) {
        const {
            name,
            email,
            phone = '',
            education = '',
            skills = '',
            experience = '',
            resume_url = null,
            user_id = null
        } = data;

        if (!isValidEmail(email)) throw badRequest('A valid email address is required.');
        validateCandidateInput({ name, phone, education, skills, experience, resume_url }, { requireName: true });

        const normalizedEmail = email.toLowerCase().trim();

        // candidates.email has no UNIQUE constraint, so find-or-create is serialized per email
        // with a MySQL named lock to stop concurrent requests creating duplicate profiles.
        const lockName = `rf_cand_${crypto.createHash('sha1').update(normalizedEmail).digest('hex')}`;
        const conn = await pool.getConnection();
        try {
            const [lockRows] = await conn.query('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
            if (!lockRows[0] || lockRows[0].acquired !== 1) {
                throw httpError(503, 'Server is busy. Please retry.');
            }

            // Reuse if candidate already exists by email
            const existing = await this.findCandidateByEmail(normalizedEmail);
            if (existing) {
                if (user_id && !existing.user_id) {
                    await conn.execute('UPDATE candidates SET user_id = ? WHERE id = ?', [user_id, existing.id]);
                    existing.user_id = user_id;
                }
                return existing;
            }

            const [result] = await conn.execute(
                `INSERT INTO candidates (user_id, name, email, phone, education, skills, experience, resume_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    user_id,
                    String(name).trim(),
                    normalizedEmail,
                    trimOrNull(phone) || '',
                    trimOrNull(education) || '',
                    trimOrNull(skills) || '',
                    trimOrNull(experience) || '',
                    trimOrNull(resume_url)
                ]
            );

            return this.getCandidateById(result.insertId);
        } finally {
            await conn.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {});
            conn.release();
        }
    }

    async updateCandidate(id, data) {
        const existing = await this.getCandidateById(id);
        if (!existing) throw httpError(404, 'Candidate not found');

        validateCandidateInput(data);

        const pick = (field) => (data[field] !== undefined ? trimOrNull(data[field]) : existing[field]);

        await pool.execute(
            `UPDATE candidates
             SET name = ?, phone = ?, education = ?, skills = ?, experience = ?, resume_url = ?
             WHERE id = ?`,
            [
                pick('name') || existing.name,
                pick('phone') || '',
                pick('education') || '',
                pick('skills') || '',
                pick('experience') || '',
                pick('resume_url'),
                id
            ]
        );

        return this.getCandidateById(id);
    }

    // =========================================================================
    // 4. APPLICATIONS & PIPELINE
    // =========================================================================

    /**
     * Inserts an APPLIED application after checking the job and duplicate rules.
     * The UNIQUE(candidate_id, job_id) constraint is the final guard against races.
     */
    async createApplication(jobId, candidateId) {
        if (!Number.isInteger(jobId) || jobId <= 0) {
            throw badRequest('A valid job_id is required.');
        }

        const job = await this.getJobById(jobId);
        const jobValidation = workflow.validateJobAcceptsApplications(job);
        if (!jobValidation.valid) throw httpError(job ? 400 : 404, jobValidation.message);

        const [existingApps] = await pool.execute(
            `SELECT id FROM applications WHERE candidate_id = ? AND job_id = ?`,
            [candidateId, jobId]
        );
        if (existingApps.length > 0) {
            throw httpError(409, 'Candidate has already applied for this job opening.');
        }

        try {
            const [result] = await pool.execute(
                `INSERT INTO applications (candidate_id, job_id, status) VALUES (?, ?, 'APPLIED')`,
                [candidateId, jobId]
            );
            return this.getApplicationById(result.insertId);
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                throw httpError(409, 'Candidate has already applied for this job opening.');
            }
            throw err;
        }
    }

    /**
     * Public (unauthenticated) application. Emails that belong to a registered account
     * must apply through the authenticated candidate portal so nobody can submit
     * applications into another person's account.
     */
    async applyForJob({ job_id, candidate }) {
        if (!candidate || !candidate.name || !isValidEmail(candidate.email)) {
            throw badRequest('Candidate name and valid email are required.');
        }
        validateCandidateInput(candidate, { requireName: true });

        const registeredUser = await this.findUserByEmail(candidate.email);
        if (registeredUser) {
            throw httpError(409, 'An account is registered with this email address. Please sign in to the candidate portal to apply.');
        }

        // Validate the job before creating any candidate record
        const job = await this.getJobById(job_id);
        const jobValidation = workflow.validateJobAcceptsApplications(job);
        if (!jobValidation.valid) throw httpError(job ? 400 : 404, jobValidation.message);

        let candidateRecord = await this.findCandidateByEmail(candidate.email);
        if (!candidateRecord) {
            candidateRecord = await this.createCandidate({ ...candidate, user_id: null });
        }

        return this.createApplication(job_id, candidateRecord.id);
    }

    async getApplications({ job_id, status, search } = {}) {
        let sql = `
            SELECT a.id, a.candidate_id, a.job_id, a.status, a.applied_at, a.updated_at,
                   c.name AS candidate_name, c.email AS candidate_email, c.phone AS candidate_phone,
                   c.education AS candidate_education, c.skills AS candidate_skills,
                   c.experience AS candidate_experience, c.resume_url,
                   j.title AS job_title, j.department AS job_department, j.status AS job_status
            FROM applications a
            JOIN candidates c ON a.candidate_id = c.id
            JOIN jobs j ON a.job_id = j.id
            WHERE 1=1
        `;
        const params = [];

        if (job_id) {
            sql += ` AND a.job_id = ?`;
            params.push(job_id);
        }

        if (status) {
            sql += ` AND a.status = ?`;
            params.push(status);
        }

        if (search) {
            sql += ` AND (c.name LIKE ? OR c.email LIKE ? OR j.title LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        sql += ` ORDER BY a.applied_at DESC`;

        const [rows] = await pool.execute(sql, params);
        return rows;
    }

    async getApplicationById(id) {
        const [rows] = await pool.execute(
            `SELECT a.id, a.candidate_id, a.job_id, a.status, a.applied_at, a.updated_at,
                    c.name AS candidate_name, c.email AS candidate_email, c.phone AS candidate_phone,
                    c.education AS candidate_education, c.skills AS candidate_skills,
                    c.experience AS candidate_experience, c.resume_url,
                    j.title AS job_title, j.department AS job_department, j.status AS job_status,
                    j.location AS job_location, j.employment_type AS job_employment_type,
                    j.skills AS job_skills, j.description AS job_description,
                    j.experience_required AS job_experience_required
             FROM applications a
             JOIN candidates c ON a.candidate_id = c.id
             JOIN jobs j ON a.job_id = j.id
             WHERE a.id = ?`,
            [id]
        );

        if (!rows[0]) return null;

        const application = rows[0];

        // Fetch associated interviews
        const [interviews] = await pool.execute(
            `SELECT i.id, i.interviewer_id, u.name AS interviewer_name, i.scheduled_at,
                    i.type, i.meeting_link, i.technical_rating, i.communication_rating,
                    i.problem_solving_rating, i.overall_rating, i.feedback, i.result,
                    i.created_at, i.updated_at
             FROM interviews i
             JOIN users u ON i.interviewer_id = u.id
             WHERE i.application_id = ?
             ORDER BY i.scheduled_at ASC, i.id ASC`,
            [id]
        );
        application.interviews = interviews;

        // Fetch associated offer
        const [offers] = await pool.execute(
            `SELECT o.id, o.designation, o.notes, o.salary, o.offer_date, o.joining_date, o.expiry_date,
                    ${offerStatusSql('o')} AS status, o.created_at, o.updated_at
             FROM offers o
             WHERE o.application_id = ?`,
            [id]
        );
        application.offer = offers[0] || null;

        return application;
    }

    /**
     * True when the interviewer is assigned to at least one interview on the application.
     */
    async isInterviewerAssigned(applicationId, userId) {
        const [rows] = await pool.execute(
            'SELECT 1 FROM interviews WHERE application_id = ? AND interviewer_id = ? LIMIT 1',
            [applicationId, userId]
        );
        return rows.length > 0;
    }

    async screenApplication(id) {
        return this.transitionApplication(id, workflow.validateApplicationScreening, workflow.APPLICATION_STATES.SCREENING);
    }

    async shortlistApplication(id) {
        return this.transitionApplication(id, workflow.validateApplicationShortlisting, workflow.APPLICATION_STATES.SHORTLISTED);
    }

    async rejectApplication(id) {
        await this.withTransaction(async (conn) => {
            const app = await this.lockApplication(conn, id);
            const offer = await this.lockOfferByApplication(conn, id);

            const validation = workflow.validateApplicationRejection(app.status, offer);
            if (!validation.valid) throw httpError(400, validation.message);

            // Close out an unanswered offer that has passed its expiry date
            if (offer && workflow.isOfferExpired(offer) && offer.status === workflow.OFFER_STATES.SENT) {
                await conn.execute(`UPDATE offers SET status = 'EXPIRED' WHERE id = ?`, [offer.id]);
            }
            await conn.execute(`UPDATE applications SET status = 'REJECTED' WHERE id = ?`, [id]);
        });
        return this.getApplicationById(id);
    }

    async selectApplication(id) {
        await this.withTransaction(async (conn) => {
            const app = await this.lockApplication(conn, id);
            const [latest] = await conn.execute(
                `SELECT result FROM interviews WHERE application_id = ?
                 ORDER BY scheduled_at DESC, id DESC LIMIT 1`,
                [id]
            );
            const validation = workflow.validateCandidateSelection(app.status, latest[0] ? latest[0].result : null);
            if (!validation.valid) throw httpError(400, validation.message);
            await conn.execute(`UPDATE applications SET status = 'SELECTED' WHERE id = ?`, [id]);
        });
        return this.getApplicationById(id);
    }

    /**
     * Final hiring step, performed by HR after the candidate accepted the offer.
     */
    async hireApplication(id) {
        await this.withTransaction(async (conn) => {
            const app = await this.lockApplication(conn, id);
            const offer = await this.lockOfferByApplication(conn, id);
            const validation = workflow.validateHire(app.status, offer);
            if (!validation.valid) throw httpError(400, validation.message);
            await conn.execute(`UPDATE applications SET status = 'HIRED' WHERE id = ?`, [id]);
        });
        return this.getApplicationById(id);
    }

    // =========================================================================
    // 5. INTERVIEWS
    // =========================================================================

    /**
     * Validates interview scheduling fields and returns the normalized DATETIME string.
     */
    validateScheduleInput({ scheduled_at, type, meeting_link }, { requireType = true } = {}) {
        const normalized = normalizeDateTime(scheduled_at);
        if (!normalized) {
            throw badRequest('Interview date and time must be a valid datetime (YYYY-MM-DDTHH:mm).');
        }
        if (dateTimeToDate(normalized) <= new Date()) {
            throw badRequest('Interview must be scheduled for a future date and time.');
        }
        assertStringFields({ type }, { type: { max: 50, required: requireType, label: 'Interview type' } });
        if (meeting_link && !isHttpUrl(String(meeting_link).trim())) {
            throw badRequest('Meeting link must be a valid http(s) URL.');
        }
        return normalized;
    }

    async assertValidInterviewer(interviewerId) {
        if (!Number.isInteger(interviewerId) || interviewerId <= 0) {
            throw badRequest('A valid interviewer_id is required.');
        }
        const interviewer = await this.findUserById(interviewerId);
        if (!interviewer) throw httpError(404, 'Interviewer user not found');
        if (!STAFF_ROLES.includes(interviewer.role)) {
            throw badRequest('Interviewer must be an HR, Admin, or Interviewer staff account.');
        }
    }

    async scheduleInterview({ application_id, interviewer_id, scheduled_at, type, meeting_link }) {
        const scheduledAt = this.validateScheduleInput({ scheduled_at, type, meeting_link });
        await this.assertValidInterviewer(interviewer_id);

        const interviewId = await this.withTransaction(async (conn) => {
            const app = await this.lockApplication(conn, application_id);
            const validation = workflow.validateInterviewScheduling(app.status);
            if (!validation.valid) throw httpError(400, validation.message);

            const [result] = await conn.execute(
                `INSERT INTO interviews (application_id, interviewer_id, scheduled_at, type, meeting_link, result)
                 VALUES (?, ?, ?, ?, ?, 'PENDING')`,
                [application_id, interviewer_id, scheduledAt, String(type).trim(), trimOrNull(meeting_link)]
            );

            await conn.execute(
                `UPDATE applications SET status = 'INTERVIEW_SCHEDULED' WHERE id = ?`,
                [application_id]
            );
            return result.insertId;
        });

        return this.getInterviewById(interviewId);
    }

    /**
     * Reschedules a pending interview (date/time, link, interviewer, or round type).
     */
    async rescheduleInterview(id, { scheduled_at, meeting_link, interviewer_id, type }) {
        const interview = await this.getInterviewById(id);
        if (!interview) throw httpError(404, 'Interview not found');

        const scheduledAt = this.validateScheduleInput(
            { scheduled_at, type: type !== undefined ? type : interview.type, meeting_link },
            { requireType: true }
        );
        const newInterviewerId = interviewer_id !== undefined && interviewer_id !== null && interviewer_id !== ''
            ? Number(interviewer_id)
            : interview.interviewer_id;
        await this.assertValidInterviewer(newInterviewerId);

        await this.withTransaction(async (conn) => {
            const app = await this.lockApplication(conn, interview.application_id);
            const [ivRows] = await conn.execute('SELECT result FROM interviews WHERE id = ? FOR UPDATE', [id]);
            if (ivRows[0].result !== workflow.INTERVIEW_RESULTS.PENDING) {
                throw httpError(400, 'Only pending interviews can be rescheduled.');
            }
            if (app.status !== workflow.APPLICATION_STATES.INTERVIEW_SCHEDULED) {
                throw httpError(400, `Interview cannot be rescheduled while the application is ${app.status}.`);
            }
            await conn.execute(
                `UPDATE interviews SET scheduled_at = ?, meeting_link = ?, interviewer_id = ?, type = ? WHERE id = ?`,
                [
                    scheduledAt,
                    meeting_link !== undefined ? trimOrNull(meeting_link) : interview.meeting_link,
                    newInterviewerId,
                    String(type !== undefined ? type : interview.type).trim(),
                    id
                ]
            );
        });

        return this.getInterviewById(id);
    }

    /**
     * Cancels a PENDING interview: the unevaluated row is removed and the application
     * returns to SHORTLISTED so a new interview can be scheduled.
     */
    async cancelInterview(id) {
        const interview = await this.getInterviewById(id);
        if (!interview) throw httpError(404, 'Interview not found');

        await this.withTransaction(async (conn) => {
            const app = await this.lockApplication(conn, interview.application_id);
            const [ivRows] = await conn.execute('SELECT result FROM interviews WHERE id = ? FOR UPDATE', [id]);
            if (!ivRows[0] || ivRows[0].result !== workflow.INTERVIEW_RESULTS.PENDING) {
                throw httpError(400, 'Only pending interviews can be cancelled.');
            }
            if (app.status !== workflow.APPLICATION_STATES.INTERVIEW_SCHEDULED) {
                throw httpError(400, `Interview cannot be cancelled while the application is ${app.status}.`);
            }
            await conn.execute('DELETE FROM interviews WHERE id = ?', [id]);
            await conn.execute('UPDATE applications SET status = ? WHERE id = ?', [workflow.APPLICATION_STATES.SHORTLISTED, app.id]);
        });

        return this.getApplicationById(interview.application_id);
    }

    async getInterviews({ interviewerId = null, role = 'HR' } = {}) {
        let sql = `
            SELECT i.id, i.application_id, i.interviewer_id, i.scheduled_at,
                   i.type, i.meeting_link, i.technical_rating, i.communication_rating,
                   i.problem_solving_rating, i.overall_rating, i.feedback, i.result,
                   i.created_at, i.updated_at,
                   u.name AS interviewer_name, u.email AS interviewer_email,
                   a.status AS application_status, a.candidate_id, a.job_id,
                   c.name AS candidate_name, c.email AS candidate_email,
                   j.title AS job_title
            FROM interviews i
            JOIN users u ON i.interviewer_id = u.id
            JOIN applications a ON i.application_id = a.id
            JOIN candidates c ON a.candidate_id = c.id
            JOIN jobs j ON a.job_id = j.id
            WHERE 1=1
        `;
        const params = [];

        // Interviewers only see their assigned interviews
        if (role === 'INTERVIEWER') {
            sql += ` AND i.interviewer_id = ?`;
            params.push(interviewerId);
        }

        sql += ` ORDER BY i.scheduled_at ASC`;
        const [rows] = await pool.execute(sql, params);
        return rows;
    }

    async getInterviewById(id) {
        const [rows] = await pool.execute(
            `SELECT i.id, i.application_id, i.interviewer_id, i.scheduled_at,
                    i.type, i.meeting_link, i.technical_rating, i.communication_rating,
                    i.problem_solving_rating, i.overall_rating, i.feedback, i.result,
                    i.created_at, i.updated_at,
                    u.name AS interviewer_name, u.email AS interviewer_email,
                    a.status AS application_status, a.candidate_id, a.job_id,
                    c.name AS candidate_name, c.email AS candidate_email,
                    j.title AS job_title
             FROM interviews i
             JOIN users u ON i.interviewer_id = u.id
             JOIN applications a ON i.application_id = a.id
             JOIN candidates c ON a.candidate_id = c.id
             JOIN jobs j ON a.job_id = j.id
             WHERE i.id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    async evaluateInterview(id, evaluationData, currentUser) {
        const interview = await this.getInterviewById(id);
        if (!interview) throw httpError(404, 'Interview not found');

        // Interviewer can only evaluate their own interview; HR/Admin can evaluate any
        if (currentUser.role === 'INTERVIEWER' && interview.interviewer_id !== currentUser.id) {
            throw httpError(403, 'Forbidden. You can only evaluate interviews assigned to you.');
        }

        const {
            technical_rating,
            communication_rating,
            problem_solving_rating,
            overall_rating,
            feedback,
            result
        } = evaluationData;

        if (!['PASS', 'FAIL'].includes(result)) {
            throw badRequest("Interview result must be 'PASS' or 'FAIL'.");
        }

        // Ratings are optional, but when given must be whole numbers 1-10
        const ratings = [technical_rating, communication_rating, problem_solving_rating, overall_rating].map((r) => {
            if (r === undefined || r === null || r === '') return null;
            const num = Number(r);
            if (!Number.isInteger(num) || num < 1 || num > 10) {
                throw badRequest('Ratings must be whole numbers between 1 and 10.');
            }
            return num;
        });
        assertStringFields({ feedback }, { feedback: { max: 5000, label: 'Feedback' } });

        await this.withTransaction(async (conn) => {
            const app = await this.lockApplication(conn, interview.application_id);
            const [ivRows] = await conn.execute('SELECT id, result FROM interviews WHERE id = ? FOR UPDATE', [id]);
            const validation = workflow.validateInterviewEvaluation(ivRows[0], app.status);
            if (!validation.valid) throw httpError(400, validation.message);

            await conn.execute(
                `UPDATE interviews
                 SET technical_rating = ?, communication_rating = ?, problem_solving_rating = ?,
                     overall_rating = ?, feedback = ?, result = ?
                 WHERE id = ?`,
                [...ratings, trimOrNull(feedback), result, id]
            );

            // Progress application to INTERVIEWED
            await conn.execute(
                `UPDATE applications SET status = 'INTERVIEWED' WHERE id = ?`,
                [interview.application_id]
            );
        });

        return this.getInterviewById(id);
    }

    // =========================================================================
    // 6. OFFERS & HIRING
    // =========================================================================

    async createOffer({ application_id, designation, notes, salary, offer_date, joining_date, expiry_date }) {
        assertStringFields({ designation, notes }, {
            designation: { max: 150, label: 'Designation' },
            notes: { max: 5000, label: 'Offer details' }
        });
        const numSalary = Number(salary);
        if (!Number.isFinite(numSalary) || numSalary <= 0 || numSalary > MAX_SALARY) {
            throw badRequest('Offer salary must be a positive number.');
        }
        for (const [label, value] of [['Offer date', offer_date], ['Joining date', joining_date], ['Expiry date', expiry_date]]) {
            if (!isValidDateOnly(value)) throw badRequest(`${label} must be a valid date (YYYY-MM-DD).`);
        }
        if (expiry_date < offer_date) throw badRequest('Expiry date cannot be before the offer date.');
        if (joining_date < offer_date) throw badRequest('Joining date cannot be before the offer date.');
        if (isPastDate(expiry_date)) throw badRequest('Expiry date cannot be in the past.');

        const offerId = await this.withTransaction(async (conn) => {
            const app = await this.lockApplication(conn, application_id);
            const validation = workflow.validateOfferCreation(app.status);
            if (!validation.valid) throw httpError(400, validation.message);

            const existing = await this.lockOfferByApplication(conn, application_id);
            if (existing) throw httpError(409, 'An offer already exists for this application.');

            const [result] = await conn.execute(
                `INSERT INTO offers (application_id, designation, salary, offer_date, joining_date, expiry_date, notes, status)
                 VALUES (?, COALESCE(?, (SELECT title FROM jobs WHERE id = ?)), ?, ?, ?, ?, ?, 'SENT')`,
                [application_id, trimOrNull(designation), app.job_id, numSalary, offer_date, joining_date, expiry_date, trimOrNull(notes)]
            );

            await conn.execute(
                `UPDATE applications SET status = 'OFFER_SENT' WHERE id = ?`,
                [application_id]
            );
            return result.insertId;
        });

        return this.getOfferById(offerId);
    }

    async getOffers({ status } = {}) {
        let sql = `
            SELECT o.id, o.application_id, o.designation, o.notes, o.salary, o.offer_date, o.joining_date,
                   o.expiry_date, ${offerStatusSql('o')} AS status, o.created_at, o.updated_at,
                   a.status AS application_status, a.candidate_id, a.job_id,
                   c.name AS candidate_name, c.email AS candidate_email,
                   j.title AS job_title
            FROM offers o
            JOIN applications a ON o.application_id = a.id
            JOIN candidates c ON a.candidate_id = c.id
            JOIN jobs j ON a.job_id = j.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            sql += ` AND ${offerStatusSql('o')} = ?`;
            params.push(status);
        }

        sql += ` ORDER BY o.created_at DESC`;
        const [rows] = await pool.execute(sql, params);
        return rows;
    }

    async getOfferById(id) {
        const [rows] = await pool.execute(
            `SELECT o.id, o.application_id, o.designation, o.notes, o.salary, o.offer_date, o.joining_date,
                    o.expiry_date, ${offerStatusSql('o')} AS status, o.created_at, o.updated_at,
                    a.status AS application_status, a.candidate_id, a.job_id,
                    c.name AS candidate_name, c.email AS candidate_email,
                    j.title AS job_title
             FROM offers o
             JOIN applications a ON o.application_id = a.id
             JOIN candidates c ON a.candidate_id = c.id
             JOIN jobs j ON a.job_id = j.id
             WHERE o.id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    /**
     * Records a response to an offer atomically (offer + application).
     * Acceptance moves the application to OFFER_ACCEPTED; HR completes hiring separately.
     */
    async respondToOffer(offerId, accept) {
        await this.withTransaction(async (conn) => {
            const [offerRows] = await conn.execute(
                'SELECT id, application_id, status, expiry_date FROM offers WHERE id = ? FOR UPDATE',
                [offerId]
            );
            const offer = offerRows[0];
            if (!offer) throw httpError(404, 'Offer not found');

            const app = await this.lockApplication(conn, offer.application_id);
            const validation = accept
                ? workflow.validateOfferAcceptance(offer, app.status)
                : workflow.validateOfferDecline(offer, app.status);
            if (!validation.valid) throw httpError(400, validation.message);

            await conn.execute('UPDATE offers SET status = ? WHERE id = ?', [accept ? 'ACCEPTED' : 'REJECTED', offerId]);
            await conn.execute('UPDATE applications SET status = ? WHERE id = ?', [
                accept ? 'OFFER_ACCEPTED' : 'REJECTED',
                offer.application_id
            ]);
        });
        return this.getOfferById(offerId);
    }

    async acceptOffer(id) {
        return this.respondToOffer(id, true);
    }

    async rejectOffer(id) {
        return this.respondToOffer(id, false);
    }

    // =========================================================================
    // 7. DASHBOARD & RECRUITMENT FUNNEL STATS
    // =========================================================================

    async getDashboardStats() {
        const [jobStats] = await pool.query(`
            SELECT
                COUNT(*) AS totalJobs,
                SUM(CASE WHEN status = 'PUBLISHED' THEN 1 ELSE 0 END) AS activeJobs,
                SUM(CASE WHEN status = 'DRAFT' THEN 1 ELSE 0 END) AS draftJobs,
                SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) AS closedJobs
            FROM jobs
        `);

        const [candidateStats] = await pool.query(`
            SELECT COUNT(*) AS totalCandidates FROM candidates
        `);

        const [appStats] = await pool.query(`
            SELECT
                COUNT(*) AS totalApplications,
                SUM(CASE WHEN status = 'APPLIED' THEN 1 ELSE 0 END) AS applied,
                SUM(CASE WHEN status = 'SCREENING' THEN 1 ELSE 0 END) AS screening,
                SUM(CASE WHEN status = 'SHORTLISTED' THEN 1 ELSE 0 END) AS shortlisted,
                SUM(CASE WHEN status = 'INTERVIEW_SCHEDULED' THEN 1 ELSE 0 END) AS interviewScheduled,
                SUM(CASE WHEN status = 'INTERVIEWED' THEN 1 ELSE 0 END) AS interviewed,
                SUM(CASE WHEN status = 'SELECTED' THEN 1 ELSE 0 END) AS selected,
                SUM(CASE WHEN status = 'OFFER_SENT' THEN 1 ELSE 0 END) AS offerSent,
                SUM(CASE WHEN status = 'OFFER_ACCEPTED' THEN 1 ELSE 0 END) AS offerAccepted,
                SUM(CASE WHEN status = 'HIRED' THEN 1 ELSE 0 END) AS hired,
                SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected
            FROM applications
        `);

        const [interviewStats] = await pool.query(`
            SELECT
                COUNT(*) AS totalInterviews,
                SUM(CASE WHEN result = 'PENDING' THEN 1 ELSE 0 END) AS pendingInterviews,
                SUM(CASE WHEN result = 'PASS' THEN 1 ELSE 0 END) AS passedInterviews,
                SUM(CASE WHEN result = 'FAIL' THEN 1 ELSE 0 END) AS failedInterviews
            FROM interviews
        `);

        const [offerStats] = await pool.query(`
            SELECT
                COUNT(*) AS totalOffers,
                SUM(CASE WHEN ${offerStatusSql('o')} = 'SENT' THEN 1 ELSE 0 END) AS activeOffers,
                SUM(CASE WHEN o.status = 'ACCEPTED' THEN 1 ELSE 0 END) AS acceptedOffers,
                SUM(CASE WHEN o.status = 'REJECTED' THEN 1 ELSE 0 END) AS rejectedOffers,
                SUM(CASE WHEN ${offerStatusSql('o')} = 'EXPIRED' THEN 1 ELSE 0 END) AS expiredOffers
            FROM offers o
        `);

        const [recentActivity] = await pool.query(`
            SELECT a.id, a.status, a.updated_at, c.name AS candidate_name, j.title AS job_title
            FROM applications a
            JOIN candidates c ON a.candidate_id = c.id
            JOIN jobs j ON a.job_id = j.id
            ORDER BY a.updated_at DESC, a.id DESC
            LIMIT 8
        `);

        const j = jobStats[0];
        const c = candidateStats[0];
        const a = appStats[0];
        const i = interviewStats[0];
        const o = offerStats[0];

        return {
            totalJobs: Number(j.totalJobs || 0),
            activeJobs: Number(j.activeJobs || 0),
            draftJobs: Number(j.draftJobs || 0),
            closedJobs: Number(j.closedJobs || 0),
            totalCandidates: Number(c.totalCandidates || 0),
            totalApplications: Number(a.totalApplications || 0),
            pendingScreening: Number(a.applied || 0) + Number(a.screening || 0),
            shortlisted: Number(a.shortlisted || 0),
            interviews: Number(i.totalInterviews || 0),
            pendingInterviews: Number(i.pendingInterviews || 0),
            selected: Number(a.selected || 0),
            awaitingHire: Number(a.offerAccepted || 0),
            hired: Number(a.hired || 0),
            funnel: {
                applied: Number(a.applied || 0),
                screening: Number(a.screening || 0),
                shortlisted: Number(a.shortlisted || 0),
                interviewScheduled: Number(a.interviewScheduled || 0),
                interviewed: Number(a.interviewed || 0),
                selected: Number(a.selected || 0),
                offerSent: Number(a.offerSent || 0),
                offerAccepted: Number(a.offerAccepted || 0),
                hired: Number(a.hired || 0),
                rejected: Number(a.rejected || 0)
            },
            interviewsBreakdown: {
                pending: Number(i.pendingInterviews || 0),
                passed: Number(i.passedInterviews || 0),
                failed: Number(i.failedInterviews || 0)
            },
            recentActivity,
            offersBreakdown: {
                total: Number(o.totalOffers || 0),
                sent: Number(o.activeOffers || 0),
                accepted: Number(o.acceptedOffers || 0),
                rejected: Number(o.rejectedOffers || 0),
                expired: Number(o.expiredOffers || 0)
            }
        };
    }

    // =========================================================================
    // 8. PHASE 4 — CANDIDATE PORTAL & TRACKING
    // =========================================================================

    /**
     * Candidate Registration
     * Creates user with role='CANDIDATE' and links or creates candidate profile.
     */
    async candidateSignup({ name, email, password, phone, education, skills, experience, resume_url }) {
        if (!isValidEmail(email)) throw badRequest('A valid email address is required.');
        if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
            throw badRequest('Password must be between 6 and 72 characters long.');
        }
        validateCandidateInput({ name, phone, education, skills, experience, resume_url }, { requireName: true });

        const normalizedEmail = email.toLowerCase().trim();
        const cleanName = String(name).trim();

        // 1. Check if user already exists
        const existingUser = await this.findUserByEmail(normalizedEmail);
        if (existingUser) {
            throw httpError(409, 'An account with this email address already exists.');
        }

        // 2. Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let userId;
        let candidateId;
        try {
            await this.withTransaction(async (conn) => {
                // 3. Create user with role 'CANDIDATE'
                const [userResult] = await conn.execute(
                    `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'CANDIDATE')`,
                    [cleanName, normalizedEmail, hashedPassword]
                );
                userId = userResult.insertId;

                // 4. Link a candidate record created earlier through the public application form
                const [existingCandidates] = await conn.execute(
                    `SELECT id, user_id FROM candidates WHERE email = ? FOR UPDATE`,
                    [normalizedEmail]
                );

                if (existingCandidates.length > 0) {
                    candidateId = existingCandidates[0].id;
                    await conn.execute(
                        `UPDATE candidates
                         SET user_id = ?,
                             name = COALESCE(?, name),
                             phone = COALESCE(?, phone),
                             education = COALESCE(?, education),
                             skills = COALESCE(?, skills),
                             experience = COALESCE(?, experience),
                             resume_url = COALESCE(?, resume_url)
                         WHERE id = ?`,
                        [
                            userId,
                            cleanName,
                            trimOrNull(phone),
                            trimOrNull(education),
                            trimOrNull(skills),
                            trimOrNull(experience),
                            trimOrNull(resume_url),
                            candidateId
                        ]
                    );
                } else {
                    const [candResult] = await conn.execute(
                        `INSERT INTO candidates (user_id, name, email, phone, education, skills, experience, resume_url)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            userId,
                            cleanName,
                            normalizedEmail,
                            trimOrNull(phone) || '',
                            trimOrNull(education) || '',
                            trimOrNull(skills) || '',
                            trimOrNull(experience) || '',
                            trimOrNull(resume_url)
                        ]
                    );
                    candidateId = candResult.insertId;
                }
            });
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                throw httpError(409, 'An account with this email address already exists.');
            }
            throw err;
        }

        const token = generateToken({
            id: userId,
            email: normalizedEmail,
            role: 'CANDIDATE',
            name: cleanName
        });

        const candidate = await this.getCandidateById(candidateId);

        return {
            user: {
                id: userId,
                name: cleanName,
                email: normalizedEmail,
                role: 'CANDIDATE'
            },
            candidate,
            token
        };
    }

    /**
     * Candidate Login
     */
    async candidateLogin(email, password) {
        const normalizedEmail = email.toLowerCase().trim();
        const user = await this.findUserByEmail(normalizedEmail);

        if (!user) throw httpError(401, 'Invalid email or password.');

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw httpError(401, 'Invalid email or password.');

        if (user.role !== 'CANDIDATE') {
            throw httpError(403, 'Access denied. This login portal is for candidates only.');
        }

        // Link candidate record if not linked yet
        const candidate = await this.findCandidateByUserId(user.id);

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: 'CANDIDATE',
            name: user.name
        });

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: 'CANDIDATE'
            },
            candidate,
            token
        };
    }

    /**
     * Get Candidate Profile by User ID
     */
    async getCandidateProfile(userId) {
        const user = await this.findUserById(userId);
        if (!user) throw httpError(404, 'User not found.');

        const candidate = await this.findCandidateByUserId(userId);
        return {
            user,
            candidate: candidate || null
        };
    }

    /**
     * Update Candidate Profile (identity always comes from the JWT, never from the body)
     */
    async updateCandidateProfile(userId, { name, phone, education, skills, experience, resume_url }) {
        const user = await this.findUserById(userId);
        if (!user) throw httpError(404, 'User not found.');

        validateCandidateInput({ name, phone, education, skills, experience, resume_url });

        let candidate = await this.findCandidateByUserId(userId);
        if (!candidate) {
            candidate = await this.createCandidate({
                name: trimOrNull(name) || user.name,
                email: user.email,
                phone,
                education,
                skills,
                experience,
                resume_url,
                user_id: userId
            });
        } else {
            const pick = (value, current) => (value !== undefined ? trimOrNull(value) || '' : current);
            await pool.execute(
                `UPDATE candidates
                 SET name = ?, phone = ?, education = ?, skills = ?, experience = ?, resume_url = ?
                 WHERE id = ?`,
                [
                    trimOrNull(name) || candidate.name,
                    pick(phone, candidate.phone),
                    pick(education, candidate.education),
                    pick(skills, candidate.skills),
                    pick(experience, candidate.experience),
                    resume_url !== undefined ? trimOrNull(resume_url) : candidate.resume_url,
                    candidate.id
                ]
            );
        }

        if (trimOrNull(name) && name.trim() !== user.name) {
            await pool.execute('UPDATE users SET name = ? WHERE id = ?', [name.trim(), userId]);
        }

        return this.getCandidateProfile(userId);
    }

    /**
     * Get All Applications for Authenticated Candidate
     */
    async getCandidateApplications(userId) {
        const candidate = await this.findCandidateByUserId(userId);
        if (!candidate) {
            return [];
        }

        const [rows] = await pool.execute(
            `SELECT a.id, a.candidate_id, a.job_id, a.status, a.applied_at, a.updated_at,
                    j.title AS job_title, j.department AS job_department, j.location AS job_location,
                    j.employment_type AS job_employment_type, j.status AS job_status,
                    j.salary_min, j.salary_max, j.deadline,
                    (SELECT COUNT(*) FROM interviews WHERE application_id = a.id) AS interview_count,
                    (SELECT ${offerStatusSql('o')} FROM offers o WHERE o.application_id = a.id LIMIT 1) AS offer_status
             FROM applications a
             JOIN jobs j ON a.job_id = j.id
             WHERE a.candidate_id = ?
             ORDER BY a.applied_at DESC`,
            [candidate.id]
        );

        return rows;
    }

    /**
     * Get Detailed Application with IDOR Protection, Timeline, Interview, and Offer
     */
    async getCandidateApplicationDetails(userId, applicationId) {
        const candidate = await this.findCandidateByUserId(userId);
        if (!candidate) throw httpError(404, 'Candidate profile not found.');

        const [appRows] = await pool.execute(
            `SELECT a.id, a.candidate_id, a.job_id, a.status, a.applied_at, a.updated_at,
                    j.title AS job_title, j.department AS job_department, j.description AS job_description,
                    j.skills AS job_skills, j.experience_required AS job_experience_required,
                    j.location AS job_location, j.employment_type AS job_employment_type,
                    j.salary_min, j.salary_max, j.deadline, j.status AS job_status
             FROM applications a
             JOIN jobs j ON a.job_id = j.id
             WHERE a.id = ?`,
            [applicationId]
        );

        if (!appRows[0]) throw httpError(404, 'Application not found.');

        const application = appRows[0];

        // CRITICAL IDOR VERIFICATION: Ensure application belongs strictly to authenticated candidate
        if (application.candidate_id !== candidate.id) {
            throw httpError(403, 'Forbidden. You do not have permission to view this application.');
        }

        // Fetch interviews
        const [interviews] = await pool.execute(
            `SELECT i.id, i.scheduled_at, i.type, i.meeting_link,
                    i.technical_rating, i.communication_rating, i.problem_solving_rating,
                    i.overall_rating, i.feedback, i.result, i.created_at,
                    u.name AS interviewer_name
             FROM interviews i
             LEFT JOIN users u ON i.interviewer_id = u.id
             WHERE i.application_id = ?
             ORDER BY i.scheduled_at DESC`,
            [applicationId]
        );

        // Sanitize interview feedback/ratings if result is still pending evaluation
        const sanitizedInterviews = interviews.map((iv) => {
            if (iv.result === 'PENDING') {
                return {
                    id: iv.id,
                    scheduled_at: iv.scheduled_at,
                    type: iv.type,
                    meeting_link: iv.meeting_link,
                    interviewer_name: iv.interviewer_name,
                    result: 'PENDING',
                    created_at: iv.created_at
                };
            }
            return iv;
        });

        // Fetch offer
        const [offers] = await pool.execute(
            `SELECT o.id, o.designation, o.notes, o.salary, o.offer_date, o.joining_date, o.expiry_date,
                    ${offerStatusSql('o')} AS status, o.created_at, o.updated_at
             FROM offers o
             WHERE o.application_id = ?`,
            [applicationId]
        );

        const offer = offers[0] || null;

        // Recruitment Lifecycle Timeline Mapping
        const STAGE_ORDER = [
            'APPLIED',
            'SCREENING',
            'SHORTLISTED',
            'INTERVIEW_SCHEDULED',
            'INTERVIEWED',
            'SELECTED',
            'OFFER_SENT',
            'OFFER_ACCEPTED',
            'HIRED'
        ];

        const isRejected = application.status === 'REJECTED';
        const currentIndex = STAGE_ORDER.indexOf(application.status);

        const timeline = STAGE_ORDER.map((stage, idx) => {
            let state = 'upcoming'; // upcoming, current, completed

            if (isRejected) {
                state = 'stopped';
            } else if (currentIndex >= 0) {
                if (idx < currentIndex || (stage === 'HIRED' && idx === currentIndex)) {
                    state = 'completed';
                } else if (idx === currentIndex) {
                    state = 'current';
                } else {
                    state = 'upcoming';
                }
            }

            return {
                stage,
                label: stage.replace(/_/g, ' '),
                state
            };
        });

        return {
            application: {
                id: application.id,
                status: application.status,
                applied_at: application.applied_at,
                updated_at: application.updated_at,
                is_rejected: isRejected
            },
            candidate: {
                id: candidate.id,
                name: candidate.name,
                email: candidate.email,
                phone: candidate.phone,
                education: candidate.education,
                skills: candidate.skills,
                experience: candidate.experience,
                resume_url: candidate.resume_url
            },
            job: {
                id: application.job_id,
                title: application.job_title,
                department: application.job_department,
                description: application.job_description,
                skills: application.job_skills,
                experience_required: application.job_experience_required,
                location: application.job_location,
                employment_type: application.job_employment_type,
                salary_min: application.salary_min,
                salary_max: application.salary_max,
                deadline: application.deadline,
                status: application.job_status
            },
            interviews: sanitizedInterviews,
            offer,
            timeline
        };
    }

    /**
     * Candidate Submits Application (authenticated). The candidate is resolved from the
     * JWT user id; any candidate/email fields in the request body are ignored.
     */
    async applyAsCandidate(userId, { job_id, education, skills, experience, resume_url, phone }) {
        const jobId = Number(job_id);
        if (!Number.isInteger(jobId) || jobId <= 0) {
            throw badRequest('A valid job_id is required.');
        }

        const user = await this.findUserById(userId);
        if (!user) throw httpError(404, 'User not found.');

        let candidate = await this.findCandidateByUserId(userId);
        if (!candidate) {
            candidate = await this.createCandidate({
                name: user.name,
                email: user.email,
                phone,
                education,
                skills,
                experience,
                resume_url,
                user_id: userId
            });
        }

        return this.createApplication(jobId, candidate.id);
    }

    /**
     * Loads an application and verifies it belongs to the authenticated candidate.
     */
    async getOwnedApplicationOffer(userId, applicationId, verb) {
        const candidate = await this.findCandidateByUserId(userId);
        if (!candidate) throw httpError(404, 'Candidate profile not found.');

        const [apps] = await pool.execute('SELECT id, candidate_id FROM applications WHERE id = ?', [applicationId]);
        if (!apps[0]) throw httpError(404, 'Application not found.');

        // IDOR Verification
        if (apps[0].candidate_id !== candidate.id) {
            throw httpError(403, `Forbidden. You can only ${verb} offers for your own applications.`);
        }

        const [offers] = await pool.execute('SELECT id FROM offers WHERE application_id = ?', [applicationId]);
        if (!offers[0]) throw httpError(404, 'No offer found for this application.');
        return offers[0].id;
    }

    /**
     * Candidate Accepts Offer
     * Atomic transition: offers.status = 'ACCEPTED', applications.status = 'OFFER_ACCEPTED'.
     * HR then completes the hire (OFFER_ACCEPTED -> HIRED).
     */
    async candidateAcceptOffer(userId, applicationId) {
        const offerId = await this.getOwnedApplicationOffer(userId, applicationId, 'accept');
        const updatedOffer = await this.acceptOffer(offerId);
        const updatedApplication = await this.getApplicationById(applicationId);
        return { offer: updatedOffer, application: updatedApplication };
    }

    /**
     * Candidate Declines Offer
     * Atomic transition: offers.status = 'REJECTED', applications.status = 'REJECTED'.
     */
    async candidateRejectOffer(userId, applicationId) {
        const offerId = await this.getOwnedApplicationOffer(userId, applicationId, 'reject');
        const updatedOffer = await this.rejectOffer(offerId);
        const updatedApplication = await this.getApplicationById(applicationId);
        return { offer: updatedOffer, application: updatedApplication };
    }

    /**
     * Get Candidate Dashboard Statistics
     */
    async getCandidateDashboardStats(userId) {
        const candidate = await this.findCandidateByUserId(userId);
        if (!candidate) {
            return {
                totalApplications: 0,
                activeApplications: 0,
                interviews: 0,
                selected: 0,
                offers: 0,
                hired: 0,
                recentApplications: []
            };
        }

        const [statsRows] = await pool.execute(
            `SELECT
                COUNT(*) AS totalApplications,
                SUM(CASE WHEN a.status NOT IN ('REJECTED', 'HIRED') THEN 1 ELSE 0 END) AS activeApplications,
                SUM(CASE WHEN a.status = 'SELECTED' THEN 1 ELSE 0 END) AS selected,
                SUM(CASE WHEN a.status IN ('OFFER_SENT', 'OFFER_ACCEPTED') THEN 1 ELSE 0 END) AS offers,
                SUM(CASE WHEN a.status = 'HIRED' THEN 1 ELSE 0 END) AS hired
             FROM applications a
             WHERE a.candidate_id = ?`,
            [candidate.id]
        );

        const [ivRows] = await pool.execute(
            `SELECT COUNT(*) AS totalInterviews
             FROM interviews i
             JOIN applications a ON i.application_id = a.id
             WHERE a.candidate_id = ?`,
            [candidate.id]
        );

        const [recent] = await pool.execute(
            `SELECT a.id, a.status, a.applied_at, a.updated_at,
                    j.title AS job_title, j.department AS job_department, j.location AS job_location,
                    j.employment_type AS job_employment_type
             FROM applications a
             JOIN jobs j ON a.job_id = j.id
             WHERE a.candidate_id = ?
             ORDER BY a.applied_at DESC
             LIMIT 5`,
            [candidate.id]
        );

        const s = statsRows[0];

        return {
            totalApplications: Number(s.totalApplications || 0),
            activeApplications: Number(s.activeApplications || 0),
            interviews: Number(ivRows[0]?.totalInterviews || 0),
            selected: Number(s.selected || 0),
            offers: Number(s.offers || 0),
            hired: Number(s.hired || 0),
            recentApplications: recent
        };
    }

    /**
     * Public Application Status Lookup (Email + Application ID verification)
     */
    async getPublicApplicationStatus(applicationId, email) {
        if (!Number.isInteger(applicationId) || applicationId <= 0 || !isValidEmail(email)) {
            throw badRequest('A valid application ID and email address are required.');
        }
        const normalizedEmail = email.toLowerCase().trim();

        const [rows] = await pool.execute(
            `SELECT a.id, a.status, a.applied_at, a.updated_at,
                    j.title AS job_title, j.department AS job_department, j.location AS job_location,
                    c.name AS candidate_name, c.email AS candidate_email
             FROM applications a
             JOIN candidates c ON a.candidate_id = c.id
             JOIN jobs j ON a.job_id = j.id
             WHERE a.id = ? AND LOWER(c.email) = ?`,
            [applicationId, normalizedEmail]
        );

        if (!rows[0]) {
            throw httpError(404, 'No matching application found for the provided Application ID and email.');
        }

        const application = rows[0];

        // Interview summary (no interviewer notes or ratings)
        const [interviews] = await pool.execute(
            `SELECT scheduled_at, type, meeting_link, result
             FROM interviews
             WHERE application_id = ?
             ORDER BY scheduled_at DESC`,
            [applicationId]
        );

        const [offers] = await pool.execute(
            `SELECT ${offerStatusSql('o')} AS status, o.offer_date, o.expiry_date
             FROM offers o
             WHERE o.application_id = ?`,
            [applicationId]
        );

        return {
            application,
            interviews: interviews.map(i => ({
                scheduled_at: i.scheduled_at,
                type: i.type,
                meeting_link: i.meeting_link,
                result: i.result
            })),
            offer: offers[0] || null
        };
    }
}

module.exports = new RecruitmentService();
