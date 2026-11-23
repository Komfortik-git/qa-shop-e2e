const fs = require('node:fs');
const path = require('node:path');
const report = JSON.parse(fs.readFileSync('test-results/results.json', 'utf8'));
const entries = [];
function walk(suites) {
  for (const suite of suites) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests) {
        const result = test.results[test.results.length - 1];
        const inventory = (result.attachments || []).find(a => a.name === 'last-unit-result');
        entries.push({
          file: path.basename(spec.file || suite.file),
          title: spec.title,
          project: test.projectName,
          expectedStatus: test.expectedStatus,
          actualStatus: result.status,
          status: test.status,
          durationMs: result.duration,
          bugs: (test.annotations || []).filter(a => a.type === 'bug').map(a => a.description.split(':')[0]),
          ...(inventory && inventory.body ? { inventory: JSON.parse(Buffer.from(inventory.body, 'base64').toString()) } : {}),
        });
      }
    }
    walk(suite.suites || []);
  }
}
walk(report.suites);
const projects = {};
for (const test of entries) {
  const p = projects[test.project] ||= { total: 0, passed: 0, expectedFailures: 0, skipped: 0, unexpected: 0 };
  p.total++;
  if (test.status === 'unexpected') p.unexpected++;
  else if (test.actualStatus === 'skipped') p.skipped++;
  else if (test.expectedStatus === 'failed' && test.actualStatus === 'failed') p.expectedFailures++;
  else if (test.actualStatus === 'passed') p.passed++;
}
const summary = {
  startTime: report.stats.startTime,
  durationMs: report.stats.duration,
  operatingSystem: process.platform,
  nodeVersion: process.version,
  playwrightVersion: require('@playwright/test/package.json').version,
  authoredScenarios: new Set(entries.map(t => t.file + ':' + t.title)).size,
  executions: entries.length,
  bugIds: [...new Set(entries.flatMap(t => t.bugs))].sort(),
  projects,
  stats: report.stats,
  tests: entries,
};
fs.mkdirSync('evidence', { recursive: true });
fs.writeFileSync('evidence/expanded-validation.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ authoredScenarios: summary.authoredScenarios, executions: summary.executions, bugIds: summary.bugIds, projects, stats: report.stats }, null, 2));
