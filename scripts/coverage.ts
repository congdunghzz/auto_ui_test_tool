/**
 * Traceability check: which QA test cases have an automated test (tagged @TC-...) and which do not.
 *
 *   npm run coverage            # all features
 *   npm run coverage -- order   # one feature folder
 */
import path from 'node:path';
import fs from 'node:fs';
import { ROOT, writeFile } from './lib/env';
import { loadCatalog, scanAutomatedIds } from '../playwright/utils/testcase-catalog';

const feature = process.argv[2];
const catalog = loadCatalog(ROOT).filter((c) => !feature || c.feature === feature);
const automated = scanAutomatedIds(ROOT);
const known = new Set(loadCatalog(ROOT).map((c) => c.id));

// Test cases explicitly reported as not automatable, from testcases/<feature>/_automation-report.md
const notAutomatable = new Map<string, string>();
for (const f of new Set(catalog.map((c) => c.feature))) {
  const report = path.join(ROOT, 'testcases', f, '_automation-report.md');
  if (!fs.existsSync(report)) continue;
  for (const line of fs.readFileSync(report, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\|\s*(TC-[\w.-]+)\s*\|\s*(BLOCKED|NOT AUTOMATABLE|NEEDS INFO)[^|]*\|\s*([^|]*)\|/i);
    if (m) notAutomatable.set(m[1], `${m[2].toUpperCase()}: ${m[3].trim()}`);
  }
}

const rows = catalog.map((c) => {
  const info = automated.get(c.id);
  let status: string;
  if (info?.kinds.has('test')) status = 'AUTOMATED';
  else if (notAutomatable.has(c.id)) status = notAutomatable.get(c.id)!;
  else if (info?.kinds.has('fixme')) status = 'BLOCKED: placeholder test.fixme';
  else if (info?.kinds.has('skip')) status = 'BLOCKED: placeholder test.skip';
  else status = 'NOT AUTOMATED';
  return { ...c, status, files: info?.files.join(', ') ?? '' };
});
const orphans = [...automated.keys()].filter((id) => !known.has(id));

const count = (s: string) => rows.filter((r) => r.status.startsWith(s)).length;
let md = `# Automation coverage${feature ? ` — ${feature}` : ''}\n\nGenerated ${new Date().toISOString()}\n\n`;
md += `- Test cases: **${rows.length}**, automated: **${count('AUTOMATED')}**, not automated: **${count('NOT AUTOMATED')}**, blocked/needs info: **${rows.length - count('AUTOMATED') - count('NOT AUTOMATED')}**\n\n`;
md += '| ID | Feature | Title | Status | Spec file(s) |\n|---|---|---|---|---|\n';
md += rows.map((r) => `| ${r.id} | ${r.feature} | ${r.title.replace(/\|/g, '\\|')} | ${r.status} | ${r.files} |`).join('\n') + '\n';
if (orphans.length) md += `\n⚠ Tags in specs without a matching QA test case: ${orphans.join(', ')}\n`;
writeFile(path.join(ROOT, 'reports', 'coverage.md'), md);

console.log(`Test cases: ${rows.length} | automated: ${count('AUTOMATED')} | not automated: ${count('NOT AUTOMATED')} | blocked/needs info: ${rows.length - count('AUTOMATED') - count('NOT AUTOMATED')}`);
for (const r of rows.filter((x) => x.status !== 'AUTOMATED')) console.log(`  - ${r.id} ${r.title} → ${r.status}`);
if (orphans.length) console.log(`⚠ Orphan tags (no QA test case): ${orphans.join(', ')}`);
console.log('→ reports/coverage.md');
