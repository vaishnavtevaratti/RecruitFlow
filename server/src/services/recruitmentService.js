/**
 * RecruitFlow — Core Recruitment Service
 * Handles business logic, transactional database queries, and state management.
 */

const { pool } = require('../config/db');
const workflow = require('../utils/workflow');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');

class RecruitmentService {
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

    // =========================================================================
    // 2. JOBS
    // =========================================================================

    async getJobs({ status, search, department, publicOnly = false } = {}) {
        let sql = `
            SELECT j.id, j.title, j.department, j.description, j.skills, 
                   j.experience_required, j.location, j.employment_type, 
                   j.salary_min, j.salary_max, j.deadline, j.status, 
                   j.created_by, u.name AS creator_name, j.created_at, j.updated_at
            FROM jobs j
            LEFT JOIN users u ON j.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (publicOnly) {
            sql += ` AND j.status = 'PUBLISHED'`;
        } else if (status) {
            sql += ` AND j.status = ?`;
            params.push(status);
        }

        if (department) {
            sql += ` AND j.department = ?`;
            params.push(department);
        }

        if (search) {
            sql += ` AND (j.title LIKE ? OR j.skills LIKE ? OR j.description LIKE ?)`;
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }

        sql += ` ORDER BY j.created_at DESC`;

        const [rows] = await pool.execute(sql, params);
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
        const {
            title,
            department,
            description,
            skills,
            experience_required,
            location,
            employment_type = 'Full-time',
            salary_min = null,
            salary_max = null,
            deadline
        } = data;

        const [result] = await pool.execute(
            `INSERT INTO jobs (
                title, department, description, skills, experience_required, 
                location, employment_type, salary_min, salary_max, deadline, 
                status, created_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
            [
                title, department, description, skills, experience_required,
                location, employment_type, salary_min, salary_max, deadline,
                userId
            ]
        );

        return this.getJobById(result.insertId);
    }

    async updateJob(id, data) {
        const existing = await this.getJobById(id);
        if (!existing) {
            const err = new Error('Job not found');
            err.statusCode = 404;
            throw err;
        }

        const {
            title = existing.title,
            department = existing.department,
            description = existing.description,
            skills = existing.skills,
            experience_required = existing.experience_required,
            location = existing.location,
            employment_type = existing.employment_type,
            salary_min = existing.salary_min,
            salary_max = existing.salary_max,
            deadline = existing.deadline
        } = data;

        await pool.execute(
            `UPDATE jobs 
             SET title = ?, department = ?, description = ?, skills = ?, 
                 experience_required = ?, location = ?, employment_type = ?, 
                 salary_min = ?, salary_max = ?, deadline = ?
             WHERE id = ?`,
            [
                title, department, description, skills,
                experience_required, location, employment_type,
                salary_min, salary_max, deadline, id
            ]
        );

        return this.getJobById(id);
    }

    async publishJob(id) {
        const job = await this.getJobById(id);
        if (!job) {
            const err = new Error('Job not found');
            err.statusCode = 404;
            throw err;
        }

        const validation = workflow.validateJobPublish(job.status);
        if (!validation.valid) {
            const err = new Error(validation.message);
            err.statusCode = 400;
            throw err;
        }

        await pool.execute(
            `UPDATE jobs SET status = 'PUBLISHED' WHERE id = ?`,
            [id]
        );

        return this.getJobById(id);
    }

    async closeJob(id) {
        const job = await this.getJobById(id);
        if (!job) {
            const err = new Error('Job not found');
            err.statusCode = 404;
            throw err;
        }

        const validation = workflow.validateJobClose(job.status);
        if (!validation.valid) {
            const err = new Error(validation.message);
            err.statusCode = 400;
            throw err;
        }

        await pool.execute(
            `UPDATE jobs SET status = 'CLOSED' WHERE id = ?`,
            [id]
        );

        return this.getJobById(id);
    }

    // =========================================================================
    // 3. CANDIDATES
    // =========================================================================

    async getCandidates({ search } = {}) {
        let sql = `SELECT id, user_id, name, email, phone, education, skills, experience, resume_url, created_at, updated_at FROM candidates WHERE 1=1`;
        const params = [];

        if (search) {
            sql += ` AND (name LIKE ? OR email LIKE ? OR skills LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        sql += ` ORDER BY created_at DESC`;
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

        // Fallback: check if candidate has matching email with user
        const user = await this.findUserById(userId);
        if (user) {
            const candidate = await this.findCandidateByEmail(user.email);
            if (candidate && !candidate.user_id) {
                // Link candidate to user
                await pool.execute('UPDATE candidates SET user_id = ? WHERE id = ?', [userId, candidate.id]);
                candidate.user_id = userId;
                return candidate;
            }
            return candidate || null;
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

        const normalizedEmail = email.toLowerCase().trim();

        // Reuse if candidate already exists by email
        const existing = await this.findCandidateByEmail(normalizedEmail);
        if (existing) {
            if (user_id && !existing.user_id) {
                await pool.execute('UPDATE candidates SET user_id = ? WHERE id = ?', [user_id, existing.id]);
                existing.user_id = user_id;
            }
            return existing;
        }

        const [result] = await pool.execute(
            `INSERT INTO candidates (user_id, name, email, phone, education, skills, experience, resume_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user_id,
                name,
                normalizedEmail,
                phone || '',
                education || '',
                skills || '',
                experience || '',
                resume_url || null
            ]
        );

        return this.getCandidateById(result.insertId);

    }

    async updateCandidate(id, data) {
        const existing = await this.getCandidateById(id);
        if (!existing) {
            const err = new Error('Candidate not found');
            err.statusCode = 404;
            throw err;
        }

        const {
            name = existing.name,
            phone = existing.phone,
            education = existing.education,
            skills = existing.skills,
            experience = existing.experience,
            resume_url = existing.resume_url
        } = data;

        await pool.execute(
            `UPDATE candidates 
             SET name = ?, phone = ?, education = ?, skills = ?, experience = ?, resume_url = ?
             WHERE id = ?`,
            [name, phone, education, skills, experience, resume_url, id]
        );

        return this.getCandidateById(id);
    }

    // =========================================================================
    // 4. APPLICATIONS & PIPELINE
    // =========================================================================

    async applyForJob({ job_id, candidate }) {
        // 1. Verify job exists and accepts applications
        const job = await this.getJobById(job_id);
        const jobValidation = workflow.validateJobAcceptsApplications(job);
        if (!jobValidation.valid) {
            const err = new Error(jobValidation.message);
            err.statusCode = 400;
            throw err;
        }

        // 2. Find or create candidate profile
        let candidateRecord = await this.findCandidateByEmail(candidate.email);
        if (!candidateRecord) {
            candidateRecord = await this.createCandidate(candidate);
        }

        // 3. Check for duplicate application (same candidate to same job)
        const [existingApps] = await pool.execute(
            `SELECT id, status, applied_at FROM applications WHERE candidate_id = ? AND job_id = ?`,
            [candidateRecord.id, job_id]
        );

        if (existingApps.length > 0) {
            const err = new Error('Candidate has already applied for this job opening.');
            err.statusCode = 409;
            throw err;
        }

        // 4. Create new application in APPLIED status
        const [result] = await pool.execute(
            `INSERT INTO applications (candidate_id, job_id, status)
             VALUES (?, ?, 'APPLIED')`,
            [candidateRecord.id, job_id]
        );

        return this.getApplicationById(result.insertId);
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
                    j.location AS job_location, j.employment_type AS job_employment_type
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
             ORDER BY i.scheduled_at ASC`,
            [id]
        );
        application.interviews = interviews;

        // Fetch associated offer
        const [offers] = await pool.execute(
            `SELECT id, salary, offer_date, joining_date, expiry_date, status, created_at, updated_at
             FROM offers
             WHERE application_id = ?`,
            [id]
        );
        application.offer = offers[0] || null;

        return application;
    }

    async screenApplication(id) {
        const application = await this.getApplicationById(id);
        if (!application) {
            const err = new Error('Application not found');
            err.statusCode = 404;
            throw err;
        }

        const validation = workflow.validateApplicationScreening(application.status);
        if (!validation.valid) {
            const err = new Error(validation.message);
            err.statusCode = 400;
            throw err;
        }

        await pool.execute(
            `UPDATE applications SET status = 'SCREENING' WHERE id = ?`,
            [id]
        );

        return this.getApplicationById(id);
    }

    async shortlistApplication(id) {
        const application = await this.getApplicationById(id);
        if (!application) {
            const err = new Error('Application not found');
            err.statusCode = 404;
            throw err;
        }

        const validation = workflow.validateApplicationShortlisting(application.status);
        if (!validation.valid) {
            const err = new Error(validation.message);
            err.statusCode = 400;
            throw err;
        }

        await pool.execute(
            `UPDATE applications SET status = 'SHORTLISTED' WHERE id = ?`,
            [id]
        );

        return this.getApplicationById(id);
    }

    async rejectApplication(id) {
        const application = await this.getApplicationById(id);
        if (!application) {
            const err = new Error('Application not found');
            err.statusCode = 404;
            throw err;
        }

        const validation = workflow.validateApplicationRejection(application.status);
        if (!validation.valid) {
            const err = new Error(validation.message);
            err.statusCode = 400;
            throw err;
        }

        await pool.execute(
            `UPDATE applications SET status = 'REJECTED' WHERE id = ?`,
            [id]
        );

        return this.getApplicationById(id);
    }

    async selectApplication(id) {
        const application = await this.getApplicationById(id);
        if (!application) {
            const err = new Error('Application not found');
            err.statusCode = 404;
            throw err;
        }

        // Get latest interview result
        const latestInterview = application.interviews && application.interviews.length > 0
            ? application.interviews[application.interviews.length - 1]
            : null;

        const validation = workflow.validateCandidateSelection(
            application.status,
            latestInterview ? latestInterview.result : null
        );

        if (!validation.valid) {
            const err = new Error(validation.message);
            err.statusCode = 400;
            throw err;
        }

        await pool.execute(
            `UPDATE applications SET status = 'SELECTED' WHERE id = ?`,
            [id]
        );

        return this.getApplicationById(id);
    }

    // =========================================================================
    // 5. INTERVIEWS
    // =========================================================================

    async scheduleInterview({ application_id, interviewer_id, scheduled_at, type, meeting_link }) {
        const application = await this.getApplicationById(application_id);
        if (!application) {
            const err = new Error('Application not found');
            err.statusCode = 404;
            throw err;
        }

        const validation = workflow.validateInterviewScheduling(application.status);
        if (!validation.valid) {
            const err = new Error(validation.message);
            err.statusCode = 400;
            throw err;
        }

        const interviewer = await this.findUserById(interviewer_id);
        if (!interviewer) {
            const err = new Error('Interviewer user not found');
            err.statusCode = 404;
            throw err;
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [result] = await conn.execute(
                `INSERT INTO interviews (application_id, interviewer_id, scheduled_at, type, meeting_link, result)
                 VALUES (?, ?, ?, ?, ?, 'PENDING')`,
                [application_id, interviewer_id, scheduled_at, type, meeting_link || null]
            );

            // Update application status to INTERVIEW_SCHEDULED
            await conn.execute(
                `UPDATE applications SET status = 'INTERVIEW_SCHEDULED' WHERE id = ?`,
                [application_id]
            );

            await conn.commit();
            return this.getInterviewById(result.insertId);
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
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
        if (role === 'INTERVIEWER' && interviewerId) {
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
        if (!interview) {
            const err = new Error('Interview not found');
            err.statusCode = 404;
            throw err;
        }

        // Interviewer can only evaluate their own interview; HR/Admin can evaluate any
        if (currentUser.role === 'INTERVIEWER' && interview.interviewer_id !== currentUser.id) {
            const err = new Error('Forbidden. You can only evaluate interviews assigned to you.');
            err.statusCode = 403;
            throw err;
        }

        const application = await this.getApplicationById(interview.application_id);
        const validation = workflow.validateInterviewEvaluation(interview, application ? application.status : null);
        if (!validation.valid) {
            const err = new Error(validation.message);
            err.statusCode = 400;
            throw err;
        }

        const {
            technical_rating,
            communication_rating,
            problem_solving_rating,
            overall_rating,
            feedback,
            result
        } = evaluationData;

        // Validate ratings 1-10
        const ratings = [technical_rating, communication_rating, problem_solving_rating, overall_rating];
        for (const r of ratings) {
            if (r !== undefined && r !== null) {
                const num = Number(r);
                if (isNaN(num) || num < 1 || num > 10) {
                    const err = new Error('Ratings must be numbers between 1 and 10.');
                    err.statusCode = 400;
                    throw err;
                }
            }
        }

        if (!['PASS', 'FAIL'].includes(result)) {
            const err = new Error("Interview result must be 'PASS' or 'FAIL'.");
            err.statusCode = 400;
            throw err;
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            await conn.execute(
                `UPDATE interviews 
                 SET technical_rating = ?, communication_rating = ?, problem_solving_rating = ?,
                     overall_rating = ?, feedback = ?, result = ?
                 WHERE id = ?`,
                [
                    technical_rating || null,
                    communication_rating || null,
                    problem_solving_rating || null,
                    overall_rating || null,
                    feedback || null,
                    result,
                    id
                ]
            );

            // Progress application to INTERVIEWED
            await conn.execute(
                `UPDATE applications SET status = 'INTERVIEWED' WHERE id = ?`,
                [interview.application_id]
            );

            await conn.commit();
            return this.getInterviewById(id);
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    // =========================================================================
    // 6. OFFERS & HIRING
    // =========================================================================

    async createOffer({ application_id, salary, offer_date, joining_date, expiry_date }) {
        const application = await this.getApplicationById(application_id);
        if (!application) {
            const err = new Error('Application not found');
            err.statusCode = 404;
            throw err;
        }

        const validation = workflow.validateOfferCreation(application.status);
        if (!validation.valid) {
            const err = new Error(validation.message);
            err.statusCode = 400;
            throw err;
        }

        // Validate salary
        const numSalary = Number(salary);
        if (isNaN(numSalary) || numSalary <= 0) {
            const err = new Error('Offer salary must be a positive number.');
            err.statusCode = 400;
            throw err;
        }

        // Check if an offer already exists for this application
        const [existingOffers] = await pool.execute(
            `SELECT id, status FROM offers WHERE application_id = ?`,
            [application_id]
        );
        if (existingOffers.length > 0) {
            const err = new Error('An offer already exists for this application.');
            err.statusCode = 409;
            throw err;
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [result] = await conn.execute(
                `INSERT INTO offers (application_id, salary, offer_date, joining_date, expiry_date, status)
                 VALUES (?, ?, ?, ?, ?, 'SENT')`,
                [application_id, numSalary, offer_date, joining_date, expiry_date]
            );

            // Progress application to OFFER_SENT
            await conn.execute(
                `UPDATE applications SET status = 'OFFER_SENT' WHERE id = ?`,
                [application_id]
            );

            await conn.commit();
            return this.getOfferById(result.insertId);
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async getOffers({ status } = {}) {
        let sql = `
            SELECT o.id, o.application_id, o.salary, o.offer_date, o.joining_date, 
                   o.expiry_date, o.status, o.created_at, o.updated_at,
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
            sql += ` AND o.status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY o.created_at DESC`;
        const [rows] = await pool.execute(sql, params);
        return rows;
    }

    async getOfferById(id) {
        const [rows] = await pool.execute(
            `SELECT o.id, o.application_id, o.salary, o.offer_date, o.joining_date, 
                    o.expiry_date, o.status, o.created_at, o.updated_at,
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

    async acceptOffer(id) {
        const offer = await this.getOfferById(id);
        if (!offer) {
            const err = new Error('Offer not found');
            err.statusCode = 404;
            throw err;
        }

        const validation = workflow.validateOfferAcceptance(offer);
        if (!validation.valid) {
            const err = new Error(validation.message);
            err.statusCode = 400;
            throw err;
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Update offer status to ACCEPTED
            await conn.execute(
                `UPDATE offers SET status = 'ACCEPTED' WHERE id = ?`,
                [id]
            );

            // 2. Explicit lifecycle transition: OFFER_SENT -> OFFER_ACCEPTED -> HIRED
            await conn.execute(
                `UPDATE applications SET status = 'OFFER_ACCEPTED' WHERE id = ?`,
                [offer.application_id]
            );

            await conn.execute(
                `UPDATE applications SET status = 'HIRED' WHERE id = ?`,
                [offer.application_id]
            );

            await conn.commit();
            return this.getOfferById(id);
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    async rejectOffer(id) {
        const offer = await this.getOfferById(id);
        if (!offer) {
            const err = new Error('Offer not found');
            err.statusCode = 404;
            throw err;
        }

        const validation = workflow.validateOfferDecline(offer);
        if (!validation.valid) {
            const err = new Error(validation.message);
            err.statusCode = 400;
            throw err;
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            await conn.execute(
                `UPDATE offers SET status = 'REJECTED' WHERE id = ?`,
                [id]
            );

            await conn.execute(
                `UPDATE applications SET status = 'REJECTED' WHERE id = ?`,
                [offer.application_id]
            );

            await conn.commit();
            return this.getOfferById(id);
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
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
                SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) AS activeOffers,
                SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END) AS acceptedOffers,
                SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejectedOffers
            FROM offers
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
            shortlisted: Number(a.shortlisted || 0),
            interviews: Number(i.totalInterviews || 0),
            selected: Number(a.selected || 0),
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
            offersBreakdown: {
                total: Number(o.totalOffers || 0),
                sent: Number(o.activeOffers || 0),
                accepted: Number(o.acceptedOffers || 0),
                rejected: Number(o.rejectedOffers || 0)
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
        const normalizedEmail = email.toLowerCase().trim();

        // 1. Check if user already exists
        const existingUser = await this.findUserByEmail(normalizedEmail);
        if (existingUser) {
            const err = new Error('An account with this email address already exists.');
            err.statusCode = 409;
            throw err;
        }

        // 2. Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // 3. Create user with role 'CANDIDATE'
            const [userResult] = await conn.execute(
                `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'CANDIDATE')`,
                [name.trim(), normalizedEmail, hashedPassword]
            );
            const userId = userResult.insertId;

            // 4. Check if candidate record exists with this email (e.g. from previous public applications)
            const [existingCandidates] = await conn.execute(
                `SELECT id, user_id FROM candidates WHERE email = ?`,
                [normalizedEmail]
            );

            let candidateId;
            if (existingCandidates.length > 0) {
                candidateId = existingCandidates[0].id;
                // Safely link candidate record to new user account and update profile if provided
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
                        name.trim(),
                        phone || null,
                        education || null,
                        skills || null,
                        experience || null,
                        resume_url || null,
                        candidateId
                    ]
                );
            } else {
                // Insert new candidate record linked to user
                const [candResult] = await conn.execute(
                    `INSERT INTO candidates (user_id, name, email, phone, education, skills, experience, resume_url)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId,
                        name.trim(),
                        normalizedEmail,
                        phone || '',
                        education || '',
                        skills || '',
                        experience || '',
                        resume_url || null
                    ]
                );
                candidateId = candResult.insertId;
            }


            await conn.commit();

            const token = generateToken({
                id: userId,
                email: normalizedEmail,
                role: 'CANDIDATE',
                name: name.trim(),
                candidate_id: candidateId
            });

            const candidate = await this.getCandidateById(candidateId);

            return {
                user: {
                    id: userId,
                    name: name.trim(),
                    email: normalizedEmail,
                    role: 'CANDIDATE'
                },
                candidate,
                token
            };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    /**
     * Candidate Login
     */
    async candidateLogin(email, password) {
        const normalizedEmail = email.toLowerCase().trim();
        const user = await this.findUserByEmail(normalizedEmail);

        if (!user) {
            const err = new Error('Invalid email or password.');
            err.statusCode = 401;
            throw err;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            const err = new Error('Invalid email or password.');
            err.statusCode = 401;
            throw err;
        }

        if (user.role !== 'CANDIDATE') {
            const err = new Error('Access denied. This login portal is for candidates only.');
            err.statusCode = 403;
            throw err;
        }

        // Link candidate record if not linked yet
        const candidate = await this.findCandidateByUserId(user.id);

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: 'CANDIDATE',
            name: user.name,
            candidate_id: candidate ? candidate.id : null
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
        if (!user) {
            const err = new Error('User not found.');
            err.statusCode = 404;
            throw err;
        }

        const candidate = await this.findCandidateByUserId(userId);
        return {
            user,
            candidate: candidate || null
        };
    }

    /**
     * Update Candidate Profile
     */
    async updateCandidateProfile(userId, { name, phone, education, skills, experience, resume_url }) {
        const user = await this.findUserById(userId);
        if (!user) {
            const err = new Error('User not found.');
            err.statusCode = 404;
            throw err;
        }

        let candidate = await this.findCandidateByUserId(userId);
        if (!candidate) {
            // Create candidate record if not present
            candidate = await this.createCandidate({
                name: name || user.name,
                email: user.email,
                phone: phone || null,
                education: education || null,
                skills: skills || null,
                experience: experience || null,
                resume_url: resume_url || null,
                user_id: userId
            });
        } else {
            await pool.execute(
                `UPDATE candidates 
                 SET name = COALESCE(?, name),
                     phone = COALESCE(?, phone),
                     education = COALESCE(?, education),
                     skills = COALESCE(?, skills),
                     experience = COALESCE(?, experience),
                     resume_url = COALESCE(?, resume_url)
                 WHERE id = ?`,
                [
                    name || candidate.name,
                    phone !== undefined ? phone : candidate.phone,
                    education !== undefined ? education : candidate.education,
                    skills !== undefined ? skills : candidate.skills,
                    experience !== undefined ? experience : candidate.experience,
                    resume_url !== undefined ? resume_url : candidate.resume_url,
                    candidate.id
                ]
            );
        }

        if (name && name.trim() !== user.name) {
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
                    (SELECT status FROM offers WHERE application_id = a.id LIMIT 1) AS offer_status
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
        if (!candidate) {
            const err = new Error('Candidate profile not found.');
            err.statusCode = 404;
            throw err;
        }

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

        if (!appRows[0]) {
            const err = new Error('Application not found.');
            err.statusCode = 404;
            throw err;
        }

        const application = appRows[0];

        // CRITICAL IDOR VERIFICATION: Ensure application belongs strictly to authenticated candidate
        if (application.candidate_id !== candidate.id) {
            const err = new Error('Forbidden. You do not have permission to view this application.');
            err.statusCode = 403;
            throw err;
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
            `SELECT id, salary, offer_date, joining_date, expiry_date, status, created_at, updated_at
             FROM offers
             WHERE application_id = ?`,
            [applicationId]
        );

        const offer = offers[0] || null;

        // Recruitment Lifecycle Timeline Mapping
        // Stages: APPLIED, SCREENING, SHORTLISTED, INTERVIEW_SCHEDULED, INTERVIEWED, SELECTED, OFFER_SENT, OFFER_ACCEPTED, HIRED
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
                if (idx < currentIndex) {
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
     * Candidate Submits Application (authenticated)
     */
    async applyAsCandidate(userId, { job_id, notes, education, skills, experience, resume_url, phone }) {
        const user = await this.findUserById(userId);
        if (!user) {
            const err = new Error('User not found.');
            err.statusCode = 404;
            throw err;
        }

        let candidate = await this.findCandidateByUserId(userId);
        if (!candidate) {
            candidate = await this.createCandidate({
                name: user.name,
                email: user.email,
                phone: phone || null,
                education: education || null,
                skills: skills || null,
                experience: experience || null,
                resume_url: resume_url || null,
                user_id: userId
            });
        }

        // Apply using standard workflow
        return this.applyForJob({
            job_id: Number(job_id),
            candidate: {
                id: candidate.id,
                name: candidate.name,
                email: candidate.email,
                phone: phone || candidate.phone,
                education: education || candidate.education,
                skills: skills || candidate.skills,
                experience: experience || candidate.experience,
                resume_url: resume_url || candidate.resume_url,
                user_id: userId
            }
        });
    }

    /**
     * Candidate Accepts Offer
     * Validates candidate ownership, verifies offer is in SENT state and not expired,
     * and performs atomic transition: offers.status = 'ACCEPTED', applications.status = 'HIRED'.
     */
    async candidateAcceptOffer(userId, applicationId) {
        const candidate = await this.findCandidateByUserId(userId);
        if (!candidate) {
            const err = new Error('Candidate profile not found.');
            err.statusCode = 404;
            throw err;
        }

        const application = await this.getApplicationById(applicationId);
        if (!application) {
            const err = new Error('Application not found.');
            err.statusCode = 404;
            throw err;
        }

        // IDOR Verification
        if (application.candidate_id !== candidate.id) {
            const err = new Error('Forbidden. You can only accept offers for your own applications.');
            err.statusCode = 403;
            throw err;
        }

        const [offers] = await pool.execute(
            `SELECT id, salary, offer_date, joining_date, expiry_date, status
             FROM offers WHERE application_id = ?`,
            [applicationId]
        );

        if (!offers[0]) {
            const err = new Error('No offer found for this application.');
            err.statusCode = 404;
            throw err;
        }

        const offer = offers[0];

        // Validate offer state and expiration
        const validation = workflow.validateOfferAcceptance(offer);
        if (!validation.valid) {
            const err = new Error(validation.message);
            err.statusCode = 400;
            throw err;
        }

        // Delegate to transactional acceptOffer
        const updatedOffer = await this.acceptOffer(offer.id);
        const updatedApplication = await this.getApplicationById(applicationId);

        return {
            offer: updatedOffer,
            application: updatedApplication
        };
    }

    /**
     * Candidate Rejects Offer
     */
    async candidateRejectOffer(userId, applicationId) {
        const candidate = await this.findCandidateByUserId(userId);
        if (!candidate) {
            const err = new Error('Candidate profile not found.');
            err.statusCode = 404;
            throw err;
        }

        const application = await this.getApplicationById(applicationId);
        if (!application) {
            const err = new Error('Application not found.');
            err.statusCode = 404;
            throw err;
        }

        if (application.candidate_id !== candidate.id) {
            const err = new Error('Forbidden. You can only reject offers for your own applications.');
            err.statusCode = 403;
            throw err;
        }

        const [offers] = await pool.execute(
            `SELECT id, status FROM offers WHERE application_id = ?`,
            [applicationId]
        );

        if (!offers[0]) {
            const err = new Error('No offer found for this application.');
            err.statusCode = 404;
            throw err;
        }

        const updatedOffer = await this.rejectOffer(offers[0].id);
        const updatedApplication = await this.getApplicationById(applicationId);

        return {
            offer: updatedOffer,
            application: updatedApplication
        };
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
                SUM(CASE WHEN a.status IN ('INTERVIEW_SCHEDULED', 'INTERVIEWED') THEN 1 ELSE 0 END) AS inInterview,
                SUM(CASE WHEN a.status = 'SELECTED' THEN 1 ELSE 0 END) AS selected,
                SUM(CASE WHEN a.status IN ('OFFER_SENT', 'OFFER_ACCEPTED') THEN 1 ELSE 0 END) AS offers,
                SUM(CASE WHEN a.status = 'HIRED' THEN 1 ELSE 0 END) AS hired
             FROM applications a
             WHERE a.candidate_id = ?`,
            [candidate.id]
        );

        // Fetch interview count
        const [ivRows] = await pool.execute(
            `SELECT COUNT(*) AS totalInterviews
             FROM interviews i
             JOIN applications a ON i.application_id = a.id
             WHERE a.candidate_id = ?`,
            [candidate.id]
        );

        // Fetch 5 most recent applications
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
            const err = new Error('No matching application found for the provided Application ID and email.');
            err.statusCode = 404;
            throw err;
        }

        const application = rows[0];

        // Fetch interview summary (no sensitive interviewer notes)
        const [interviews] = await pool.execute(
            `SELECT scheduled_at, type, meeting_link, result
             FROM interviews
             WHERE application_id = ?
             ORDER BY scheduled_at DESC`,
            [applicationId]
        );

        // Fetch offer status
        const [offers] = await pool.execute(
            `SELECT status, offer_date, expiry_date
             FROM offers
             WHERE application_id = ?`,
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

