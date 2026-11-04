/**
 * RecruitFlow — Authentication Controller
 */

const bcrypt = require('bcryptjs');
const recruitmentService = require('../services/recruitmentService');
const { generateToken } = require('../utils/jwt');

/**
 * POST /api/auth/login
 * Authenticates user credentials and returns JWT token and profile.
 */
async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Both email and password are required.'
            });
        }

        const user = await recruitmentService.findUserByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // Staff portal only; candidates authenticate through /api/auth/candidate/login
        if (user.role === 'CANDIDATE') {
            return res.status(403).json({
                success: false,
                message: 'Candidate accounts must sign in through the candidate portal.'
            });
        }

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/candidate/signup
 * Candidate registration endpoint.
 */
async function candidateSignup(req, res, next) {
    try {
        const { name, email, password, phone, education, skills, experience, resume_url } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required.'
            });
        }

        if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
            return res.status(400).json({
                success: false,
                message: 'Password must be between 8 and 128 characters long.'
            });
        }

        const result = await recruitmentService.candidateSignup({
            name,
            email,
            password,
            phone,
            education,
            skills,
            experience,
            resume_url
        });

        res.status(201).json({
            success: true,
            message: 'Candidate account created successfully.',
            token: result.token,
            user: result.user,
            candidate: result.candidate
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/candidate/login
 * Candidate-specific authentication endpoint.
 */
async function candidateLogin(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Both email and password are required.'
            });
        }

        const result = await recruitmentService.candidateLogin(email, password);

        res.status(200).json({
            success: true,
            message: 'Candidate login successful.',
            token: result.token,
            user: result.user,
            candidate: result.candidate
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/auth/me
 * Returns profile of current authenticated user.
 */
async function getMe(req, res, next) {
    try {
        const user = await recruitmentService.findUserById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found.'
            });
        }

        let candidate = null;
        if (user.role === 'CANDIDATE') {
            candidate = await recruitmentService.findCandidateByUserId(user.id);
        }

        res.status(200).json({
            success: true,
            data: {
                ...user,
                ...(candidate ? { candidate } : {})
            }
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    login,
    candidateSignup,
    candidateLogin,
    getMe
};

