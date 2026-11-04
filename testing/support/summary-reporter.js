// Writes a readable Markdown summary of a Playwright run (reports/SUMMARY.md).

const fs = require('fs');
const path = require('path');

class SummaryReporter {
  constructor({ outputFile = 'reports/SUMMARY.md' } = {}) {
    this.outputFile = outputFile;
    this.results = [];
    this.start = Date.now();
  }

  onTestEnd(test, result) {
    const issuesAttachment = result.attachments.find((a) => a.name === 'browser-issues' && a.body);
    this.results.push({
      module: path.basename(test.location.file).replace('.spec.js', ''),
      project: test.parent.project()?.name || '',
      title: test.titlePath().slice(3).join(' › '),
      status: result.status,
      expected: test.expectedStatus,
      duration: result.duration,
      error: result.error ? stripAnsi(result.error.message || '').split('\n').slice(0, 6).join('\n') : '',
      screenshots: result.attachments.filter((a) => a.name === 'screenshot' && a.path).map((a) => a.path),
      issues: issuesAttachment ? JSON.parse(issuesAttachment.body.toString()) : null
    });
  }

  onEnd(fullResult) {
    const r = this.results;
    const count = (s) => r.filter((x) => x.status === s).length;
    const passed = count('passed');
    const failed = count('failed') + count('timedOut') + count('interrupted');
    const skipped = count('skipped');
    const ran = r.length - skipped;
    const pct = ran ? ((passed / ran) * 100).toFixed(1) : '0.0';
    const outDir = path.dirname(path.resolve(this.outputFile));
    const rel = (p) => path.relative(outDir, p).split(path.sep).join('/');

    const modules = {};
    for (const x of r) {
      const key = `${x.module} (${x.project})`;
      modules[key] ||= { passed: 0, failed: 0, skipped: 0, ms: 0 };
      modules[key][x.status === 'passed' ? 'passed' : x.status === 'skipped' ? 'skipped' : 'failed'] += 1;
      modules[key].ms += x.duration;
    }

    const lines = [
      '# RecruitFlow — Automated E2E Test Summary',
      '',
      `Generated: ${new Date().toISOString()}  `,
      `Overall status: **${fullResult.status.toUpperCase()}**`,
      '',
      '| Total | Passed | Failed | Skipped | Pass rate | Duration |',
      '| ---: | ---: | ---: | ---: | ---: | ---: |',
      `| ${r.length} | ${passed} | ${failed} | ${skipped} | ${pct}% | ${(fullResult.duration / 1000).toFixed(1)} s |`,
      '',
      '## Results by module',
      '',
      '| Module (project) | Passed | Failed | Skipped | Time |',
      '| :--- | ---: | ---: | ---: | ---: |',
      ...Object.entries(modules).map(([m, v]) => `| ${m} | ${v.passed} | ${v.failed} | ${v.skipped} | ${(v.ms / 1000).toFixed(1)} s |`),
      '',
      '## Failures',
      ''
    ];

    const failures = r.filter((x) => !['passed', 'skipped'].includes(x.status));
    if (!failures.length) lines.push('None.', '');
    for (const f of failures) {
      lines.push(`### ${f.module} › ${f.title} (${f.project})`, '', '```', f.error || f.status, '```');
      for (const s of f.screenshots) lines.push(`![screenshot](${rel(s)})`);
      lines.push('');
    }

    const collect = (key) => r.flatMap((x) => (x.issues?.[key] || []).map((v) => `${x.module} › ${x.title}: ${v}`));
    const section = (title, items, note) => {
      lines.push(`## ${title}`, '', note, '');
      if (!items.length) lines.push('None.', '');
      else lines.push(...[...new Set(items)].slice(0, 200).map((i) => `- ${i}`), '');
    };
    section('Browser console errors and uncaught exceptions', [...collect('consoleErrors'), ...collect('pageErrors')], 'Any entry here fails its test.');
    section('Failed API requests — server errors (5xx) and network failures', [...collect('serverErrors'), ...collect('failedRequests')], 'Any entry here fails its test.');
    section('API 4xx responses seen in the browser', collect('clientErrors'), 'Expected for negative tests (invalid login, blocked actions, permission checks). Each one is asserted by its test.');

    lines.push('## All tests', '', '| Module | Test | Project | Result | Time |', '| :--- | :--- | :--- | :--- | ---: |');
    for (const x of r) lines.push(`| ${x.module} | ${x.title.replace(/\|/g, '/')} | ${x.project} | ${x.status} | ${(x.duration / 1000).toFixed(1)} s |`);

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(this.outputFile, lines.join('\n') + '\n');
  }

  printsToStdio() {
    return false;
  }
}

function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;]*m/g, '');
}

module.exports = SummaryReporter;
