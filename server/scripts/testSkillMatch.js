/**
 * RecruitFlow — Skill Match Unit Tests (no database or server required)
 * Usage: node scripts/testSkillMatch.js
 */

const assert = require('assert');
const { computeSkillMatch } = require('../src/services/skillMatchService');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`[PASS] ${name}`);
    } catch (err) {
        failed++;
        console.error(`[FAIL] ${name} -> ${err.message}`);
    }
}

test('Exact and alias matches are counted', () => {
    const r = computeSkillMatch(
        { skills: 'React, Node.js, MySQL, REST APIs' },
        { skills: 'ReactJS, NodeJS, MySQL, Restful APIs', experience: '', education: '' }
    );
    assert.strictEqual(r.score, 100);
    assert.strictEqual(r.matched.length, 4);
    assert.strictEqual(r.notMentioned.length, 0);
});

test('Unmentioned skills are reported as unverified, not missing', () => {
    const r = computeSkillMatch({ skills: 'React, Kubernetes' }, { skills: 'React', experience: '2 years', education: '' });
    assert.strictEqual(r.score, 50);
    assert.strictEqual(r.notMentioned[0].skill, 'Kubernetes');
    assert.ok(/not confirmed missing/i.test(r.notMentioned[0].detail));
    assert.ok(r.suggestedQuestions.some((q) => q.includes('Kubernetes')));
});

test('Skill mentioned in experience text counts as text evidence', () => {
    const r = computeSkillMatch({ skills: 'Docker' }, { skills: 'Python', experience: 'Built Docker images', education: '' });
    assert.strictEqual(r.matched[0].evidence, 'text');
});

test('Related skill implies a broader requirement', () => {
    const r = computeSkillMatch({ skills: 'SQL' }, { skills: 'PostgreSQL', experience: '', education: '' });
    assert.strictEqual(r.matched[0].evidence, 'implied');
});

test('Whole-word matching avoids false positives ("Java" is not "JavaScript")', () => {
    const r = computeSkillMatch({ skills: 'Java' }, { skills: 'JavaScript', experience: 'JavaScript developer', education: '' });
    assert.strictEqual(r.score, 0);
});

test('Compound skills such as CI/CD stay intact', () => {
    const r = computeSkillMatch({ skills: 'CI/CD, Terraform' }, { skills: 'CICD', experience: '', education: '' });
    assert.strictEqual(r.requiredCount, 2);
    assert.strictEqual(r.matched[0].skill, 'CI/CD');
});

test('Job with no skills yields null score and an explanation', () => {
    const r = computeSkillMatch({ skills: '' }, { skills: 'React' });
    assert.strictEqual(r.score, null);
    assert.ok(r.summary.length > 0);
});

test('Empty candidate profile does not crash and flags everything as unverified', () => {
    const r = computeSkillMatch({ skills: 'React, SQL' }, { skills: '', experience: '', education: '' });
    assert.strictEqual(r.score, 0);
    assert.strictEqual(r.notMentioned.length, 2);
});

test('Output carries method, scoring explanation and limitations', () => {
    const r = computeSkillMatch({ skills: 'React' }, { skills: 'React' });
    assert.strictEqual(r.method, 'rule-based');
    assert.ok(r.scoring && r.limitations.length >= 3);
});

console.log(`SKILL MATCH TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
process.exit(failed > 0 ? 1 : 0);
