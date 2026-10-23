/**
 * RecruitFlow — Rule-Based Job/Candidate Skill Matching
 *
 * Deterministic and explainable: no external AI provider, no data leaves the server.
 * Score = (required job skills found in the candidate profile) / (required job skills) x 100.
 *
 * Limitations (also returned to the UI):
 *  - Matching is by keyword/alias, so it cannot judge depth or recency of a skill.
 *  - "Not mentioned" means the profile text does not mention the skill. It is NOT
 *    evidence that the candidate lacks it.
 *  - The score is a screening aid for HR, not a prediction of job performance, and it
 *    never changes an application's status.
 */

// Common spelling variants mapped to one canonical skill name
const ALIASES = {
    js: 'javascript',
    'java script': 'javascript',
    ecmascript: 'javascript',
    ts: 'typescript',
    node: 'node.js',
    nodejs: 'node.js',
    'node js': 'node.js',
    react: 'react',
    reactjs: 'react',
    'react.js': 'react',
    'react js': 'react',
    vue: 'vue.js',
    vuejs: 'vue.js',
    angularjs: 'angular',
    express: 'express',
    expressjs: 'express',
    'express.js': 'express',
    postgres: 'postgresql',
    'postgre sql': 'postgresql',
    mongo: 'mongodb',
    k8s: 'kubernetes',
    'rest api': 'rest apis',
    rest: 'rest apis',
    restful: 'rest apis',
    'restful apis': 'rest apis',
    'ci cd': 'ci/cd',
    cicd: 'ci/cd',
    html: 'html5',
    css: 'css3',
    'amazon web services': 'aws',
    golang: 'go',
    'c sharp': 'c#',
    py: 'python'
};

// Related terms that count as evidence for a broader required skill
const IMPLIED_BY = {
    sql: ['mysql', 'postgresql', 'sql server', 'oracle', 'sqlite', 'mariadb'],
    javascript: ['react', 'node.js', 'typescript', 'vue.js', 'angular', 'express'],
    'full stack development': ['full stack', 'fullstack']
};

function canonical(skill) {
    const cleaned = String(skill)
        .toLowerCase()
        .replace(/[()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return ALIASES[cleaned] || cleaned;
}

function splitSkillList(text) {
    if (!text) return [];
    const seen = new Set();
    const result = [];
    for (const raw of String(text).split(/[,;\n|]/)) {
        const label = raw.trim();
        if (!label || label.length > 60) continue;
        const key = canonical(label);
        if (!seen.has(key)) {
            seen.add(key);
            result.push({ label, key });
        }
    }
    return result;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when the term appears as a whole word/phrase in the text.
 */
function mentions(text, term) {
    if (!text || !term) return false;
    const pattern = new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(term)}($|[^a-z0-9+#])`, 'i');
    return pattern.test(text);
}

function termsFor(key) {
    const aliasTerms = Object.entries(ALIASES)
        .filter(([, target]) => target === key)
        .map(([alias]) => alias);
    return [key, ...aliasTerms];
}

const QUESTION_TEMPLATES = {
    listed: (skill) => `Walk me through a recent project where you used ${skill}. What was your role and what trade-offs did you make?`,
    text: (skill) => `Your profile mentions ${skill} in your background. How have you applied it, and at what depth?`,
    implied: (skill, via) => `The role asks for ${skill}; your profile lists ${via}. How does that experience translate to ${skill}?`,
    missing: (skill) => `${skill} is required for this role but is not mentioned in your profile. What exposure, if any, have you had to it?`
};

/**
 * Computes an explainable skill match for one job/candidate pair.
 * @param {Object} job       - { title, skills }
 * @param {Object} candidate - { skills, experience, education }
 */
function computeSkillMatch(job, candidate) {
    const required = splitSkillList(job.skills);
    const candidateSkills = splitSkillList(candidate.skills);
    const candidateKeys = new Set(candidateSkills.map((s) => s.key));
    const profileText = [candidate.experience, candidate.education].filter(Boolean).join(' \n ').toLowerCase();

    const matched = [];
    const notMentioned = [];

    for (const skill of required) {
        if (candidateKeys.has(skill.key)) {
            matched.push({ skill: skill.label, evidence: 'listed', detail: 'Listed in candidate skills' });
            continue;
        }
        if (termsFor(skill.key).some((t) => mentions(profileText, t))) {
            matched.push({ skill: skill.label, evidence: 'text', detail: 'Mentioned in experience/education' });
            continue;
        }
        const impliedVia = (IMPLIED_BY[skill.key] || []).find((rel) => candidateKeys.has(rel) || mentions(profileText, rel));
        if (impliedVia) {
            matched.push({ skill: skill.label, evidence: 'implied', detail: `Related skill listed: ${impliedVia}`, via: impliedVia });
            continue;
        }
        notMentioned.push({ skill: skill.label, detail: 'Not mentioned in the candidate profile (unverified, not confirmed missing)' });
    }

    const requiredKeys = new Set(required.map((s) => s.key));
    const additional = candidateSkills
        .filter((s) => !requiredKeys.has(s.key))
        .map((s) => s.label);

    const score = required.length > 0 ? Math.round((matched.length / required.length) * 100) : null;

    const questions = [
        ...matched.slice(0, 3).map((m) =>
            m.evidence === 'implied' ? QUESTION_TEMPLATES.implied(m.skill, m.via) : QUESTION_TEMPLATES[m.evidence](m.skill)
        ),
        ...notMentioned.slice(0, 3).map((m) => QUESTION_TEMPLATES.missing(m.skill))
    ];

    let summary;
    if (required.length === 0) {
        summary = 'The job has no required skills listed, so no skill match can be computed.';
    } else if (candidateSkills.length === 0 && !profileText.trim()) {
        summary = 'The candidate profile has no skills or experience text, so every required skill is unverified. Review the resume or ask in interview.';
    } else {
        summary = `${matched.length} of ${required.length} required skills are mentioned in the candidate profile` +
            (notMentioned.length > 0 ? `; ${notMentioned.length} could not be verified from the profile and should be explored in interview.` : '.');
    }

    return {
        method: 'rule-based',
        score,
        requiredCount: required.length,
        matched,
        notMentioned,
        additionalSkills: additional,
        summary,
        suggestedQuestions: questions,
        scoring: 'Score = required skills found in the candidate profile ÷ required skills listed on the job × 100. Matches use exact names, common aliases (e.g. "NodeJS" = "Node.js"), and a few related-skill rules (e.g. MySQL counts as SQL).',
        limitations: [
            'Keyword matching cannot judge skill depth, recency, or quality.',
            '"Not mentioned" is not evidence that the candidate lacks the skill.',
            'Only the profile fields stored in RecruitFlow are analysed; linked resumes are not read.',
            'This is a screening aid for HR. It never shortlists, rejects, or selects anyone.'
        ]
    };
}

module.exports = { computeSkillMatch, canonical, splitSkillList };
