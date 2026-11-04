-- =============================================================================
-- RecruitFlow — Relational Database Schema (MySQL 8.0+)
-- Assessment Topic 17: Recruitment Management System
-- =============================================================================

CREATE DATABASE IF NOT EXISTS recruitflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE recruitflow;

-- -----------------------------------------------------------------------------
-- 1. Users Table
-- Supports HR, Interviewers, and Admins for internal recruiting operations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('HR', 'INTERVIEWER', 'ADMIN', 'CANDIDATE') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 2. Jobs Table
-- Job requisitions with lifecycle state machine: DRAFT -> PUBLISHED -> CLOSED
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    skills TEXT NOT NULL,
    experience_required VARCHAR(50) NOT NULL,
    location VARCHAR(100) NOT NULL,
    employment_type VARCHAR(50) NOT NULL,
    salary_min DECIMAL(12, 2) NULL,
    salary_max DECIMAL(12, 2) NULL,
    deadline DATE NOT NULL,
    status ENUM('DRAFT', 'PUBLISHED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_jobs_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
    INDEX idx_jobs_status (status),
    INDEX idx_jobs_deadline (deadline),
    INDEX idx_jobs_created_by (created_by)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 3. Candidates Table
-- Candidate profiles applying to open positions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    education VARCHAR(255) NOT NULL,
    skills TEXT NOT NULL,
    experience VARCHAR(50) NOT NULL,
    resume_url VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_candidates_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_candidates_email (email)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 4. Applications Table
-- Pipeline state machine linking candidate to job opening
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT NOT NULL,
    job_id INT NOT NULL,
    status ENUM(
        'APPLIED',
        'SCREENING',
        'SHORTLISTED',
        'INTERVIEW_SCHEDULED',
        'INTERVIEWED',
        'SELECTED',
        'OFFER_SENT',
        'OFFER_ACCEPTED',
        'HIRED',
        'REJECTED'
    ) NOT NULL DEFAULT 'APPLIED',
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_applications_candidate FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE RESTRICT,
    CONSTRAINT fk_applications_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE RESTRICT,
    CONSTRAINT uq_candidate_job UNIQUE (candidate_id, job_id),
    INDEX idx_applications_candidate_id (candidate_id),
    INDEX idx_applications_job_id (job_id),
    INDEX idx_applications_status (status)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 5. Interviews Table
-- Interview schedule and multi-criteria evaluations (1-10 rating scale)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    interviewer_id INT NOT NULL,
    scheduled_at DATETIME NOT NULL,
    type VARCHAR(50) NOT NULL,
    meeting_link VARCHAR(500) NULL,
    technical_rating TINYINT NULL,
    communication_rating TINYINT NULL,
    problem_solving_rating TINYINT NULL,
    overall_rating TINYINT NULL,
    feedback TEXT NULL,
    result ENUM('PENDING', 'PASS', 'FAIL') NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_interviews_application FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE RESTRICT,
    CONSTRAINT fk_interviews_interviewer FOREIGN KEY (interviewer_id) REFERENCES users (id) ON DELETE RESTRICT,
    INDEX idx_interviews_application_id (application_id),
    INDEX idx_interviews_interviewer_id (interviewer_id),
    INDEX idx_interviews_scheduled_at (scheduled_at)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 6. Offers Table
-- Formal job offers issued to SELECTED candidates (1-to-1 with application)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    designation VARCHAR(150) NULL,
    salary DECIMAL(12, 2) NOT NULL,
    offer_date DATE NOT NULL,
    joining_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    notes TEXT NULL,
    status ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_offers_application FOREIGN KEY (application_id) REFERENCES applications (id) ON DELETE RESTRICT,
    CONSTRAINT uq_offers_application_id UNIQUE (application_id),
    INDEX idx_offers_status (status),
    INDEX idx_offers_expiry_date (expiry_date)
) ENGINE=InnoDB;
