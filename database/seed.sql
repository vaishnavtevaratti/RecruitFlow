-- =============================================================================
-- RecruitFlow — Safe Local Demo Seed Data
-- Assessment Topic 17: Recruitment Management System
-- Follows strict workflow state machine and business rules.
-- =============================================================================

USE recruitflow;

-- -----------------------------------------------------------------------------
-- 1. Users (Passwords hashed using bcryptjs for 'Admin@123')
-- -----------------------------------------------------------------------------
INSERT INTO users (id, name, email, password, role)
VALUES
    (1, 'HR Manager', 'hr@recruitflow.com', '$2a$10$gc7s42tIJu.6qy/F3GUvLuRRki2LgjsBvKbr5h6kvedMcVcguV7Ra', 'HR'),
    (2, 'David Chen', 'interviewer@recruitflow.com', '$2a$10$gc7s42tIJu.6qy/F3GUvLuRRki2LgjsBvKbr5h6kvedMcVcguV7Ra', 'INTERVIEWER'),
    (3, 'System Administrator', 'admin@recruitflow.com', '$2a$10$gc7s42tIJu.6qy/F3GUvLuRRki2LgjsBvKbr5h6kvedMcVcguV7Ra', 'ADMIN')
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    role = VALUES(role);

-- -----------------------------------------------------------------------------
-- 2. Jobs (Covering PUBLISHED, DRAFT, and CLOSED states)
-- -----------------------------------------------------------------------------
INSERT INTO jobs (id, title, department, description, skills, experience_required, location, employment_type, salary_min, salary_max, deadline, status, created_by)
VALUES
    (1, 'Senior Full Stack Engineer', 'Engineering', 
     'We are seeking an experienced Full Stack Engineer to build and scale modern web applications with React, Node.js, and relational databases.', 
     'React, Node.js, MySQL, JavaScript, REST APIs', '4-6 years', 'Remote', 'Full-time', 90000.00, 130000.00, '2026-12-31', 'PUBLISHED', 1),
    (2, 'DevOps & Cloud Engineer', 'Infrastructure', 
     'Responsible for managing CI/CD pipelines, container orchestration, and cloud infrastructure reliability.', 
     'Linux, AWS, CI/CD, Terraform, Docker', '3-5 years', 'Hybrid', 'Full-time', 85000.00, 120000.00, '2027-01-15', 'DRAFT', 1),
    (3, 'Junior Frontend Developer', 'Engineering', 
     'Assist in developing responsive, accessible, and high-performance UI components using modern web technologies.', 
     'HTML5, CSS3, JavaScript, Bootstrap, React', '1-2 years', 'Onsite', 'Full-time', 50000.00, 65000.00, '2026-05-01', 'CLOSED', 1)
ON DUPLICATE KEY UPDATE 
    title = VALUES(title),
    status = VALUES(status);

-- -----------------------------------------------------------------------------
-- 3. Candidates (Realistic candidate profiles)
-- -----------------------------------------------------------------------------
INSERT INTO candidates (id, name, email, phone, education, skills, experience, resume_url)
VALUES
    (1, 'Ethan Hunt', 'ethan.hunt@example.com', '+1-555-0101', 'B.Eng in Computer Systems', 'Node.js, Express, MySQL, Microservices, React', '6 years', 'https://example.com/resumes/ethan_hunt.pdf'),
    (2, 'Alice Walker', 'alice.walker@example.com', '+1-555-0102', 'B.S. in Computer Science', 'React, Node.js, Express, MySQL, JavaScript', '5 years', 'https://example.com/resumes/alice_walker.pdf'),
    (3, 'Charlie Davis', 'charlie.davis@example.com', '+1-555-0103', 'M.S. in Software Engineering', 'Full Stack Development, Node.js, SQL, React', '4 years', 'https://example.com/resumes/charlie_davis.pdf'),
    (4, 'Bob Smith', 'bob.smith@example.com', '+1-555-0104', 'B.Tech in Information Technology', 'JavaScript, React, SQL, REST APIs', '4 years', 'https://example.com/resumes/bob_smith.pdf'),
    (5, 'Diana Prince', 'diana.prince@example.com', '+1-555-0105', 'B.S. in Software Development', 'React, JavaScript, CSS, HTML5', '3 years', 'https://example.com/resumes/diana_prince.pdf'),
    (6, 'Fiona Gallagher', 'fiona.gallagher@example.com', '+1-555-0106', 'B.A. in Computer Science', 'Frontend, UI/UX, Bootstrap, JavaScript', '2 years', 'https://example.com/resumes/fiona_gallagher.pdf')
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    phone = VALUES(phone);

-- -----------------------------------------------------------------------------
-- 4. Applications (All applied to PUBLISHED Job 1 at realistic lifecycle stages)
-- -----------------------------------------------------------------------------
INSERT INTO applications (id, candidate_id, job_id, status, applied_at)
VALUES
    (1, 1, 1, 'HIRED', '2026-07-01 09:00:00'),
    (2, 2, 1, 'SELECTED', '2026-08-10 10:30:00'),
    (3, 3, 1, 'INTERVIEWED', '2026-08-20 14:15:00'),
    (4, 4, 1, 'INTERVIEW_SCHEDULED', '2026-09-01 11:00:00'),
    (5, 5, 1, 'SHORTLISTED', '2026-09-10 16:45:00'),
    (6, 6, 1, 'APPLIED', '2026-09-20 12:00:00')
ON DUPLICATE KEY UPDATE 
    status = VALUES(status);

-- -----------------------------------------------------------------------------
-- 5. Interviews (Strictly for shortlisted/interviewed/selected/hired candidates)
-- -----------------------------------------------------------------------------
INSERT INTO interviews (id, application_id, interviewer_id, scheduled_at, type, meeting_link, technical_rating, communication_rating, problem_solving_rating, overall_rating, feedback, result)
VALUES
    -- Ethan Hunt (HIRED): completed and passed
    (1, 1, 2, '2026-07-15 14:00:00', 'Technical Interview', 'https://meet.recruitflow.com/tech-ethan-hunt', 9, 9, 9, 9, 'Outstanding architecture knowledge and problem solving skills.', 'PASS'),
    -- Alice Walker (SELECTED): completed and passed
    (2, 2, 2, '2026-08-25 15:30:00', 'Technical Interview', 'https://meet.recruitflow.com/tech-alice-walker', 8, 9, 8, 8, 'Strong full-stack knowledge and great communication. Recommended for hire.', 'PASS'),
    -- Charlie Davis (INTERVIEWED): completed and evaluated
    (3, 3, 2, '2026-09-05 11:00:00', 'Technical Round 1', 'https://meet.recruitflow.com/tech-charlie-davis', 8, 7, 8, 8, 'Solid technical grasp, strong algorithmic thinking. Awaiting committee review.', 'PASS'),
    -- Bob Smith (INTERVIEW_SCHEDULED): upcoming interview, ratings NULL, result PENDING
    (4, 4, 2, '2026-10-15 10:00:00', 'Technical Round 1', 'https://meet.recruitflow.com/tech-bob-smith', NULL, NULL, NULL, NULL, NULL, 'PENDING')
ON DUPLICATE KEY UPDATE 
    result = VALUES(result),
    overall_rating = VALUES(overall_rating);

-- -----------------------------------------------------------------------------
-- 6. Offers (Only for SELECTED and HIRED applications)
-- -----------------------------------------------------------------------------
INSERT INTO offers (id, application_id, salary, offer_date, joining_date, expiry_date, status)
VALUES
    -- Ethan Hunt (HIRED): accepted offer
    (1, 1, 125000.00, '2026-08-01', '2026-09-01', '2026-08-15', 'ACCEPTED'),
    -- Alice Walker (SELECTED): active sent offer
    (2, 2, 115000.00, '2026-09-20', '2026-10-15', '2026-10-05', 'SENT')
ON DUPLICATE KEY UPDATE 
    salary = VALUES(salary),
    status = VALUES(status);
