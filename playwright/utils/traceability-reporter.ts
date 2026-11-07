/**
 * Maps Playwright results back to QA test case IDs (tags like @TC-CUS-001) and writes
 * reports/summary.md + reports/summary.json with PASS / FAIL / SKIPPED / BLOCKED per test case.
 *
 * BLOCKED = the test did not run (dependency/setup failed, run interrupted) or it is annotated
 *           with { type: 'blocked' } / test.fixme() because something outside the test is missing.
 */
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import fs from 'node:fs';
import path from 'node:path';
import { loadCatalog, scanAutomatedIds, type CatalogEntry } from './testcase-catalog';

type Status = 'PASS' | 'FAIL' | 'SKIPPED' | 'BLOCKED';
type TestRow = {
  title: string; file: string; project: string; status: Status; durationMs: number; retries: number;
  flaky: boolean; reason?: string; error?: string; attachments: { name: string; path: string }[];
};
type TcRow = { id: string; title: string; feature: string; status: Status; durationMs: number; tests: TestRow[] };

const ORDER: Status[] = ['FAIL', 'BLOCKED', 'SKIPPED', 'PASS'];
const ICON: Record<Status, string> = { PASS: '✅', FAIL: '❌', SKIPPED: '⏭️', BLOCKED: '⛔' };
const strip = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');

export default class TraceabilityReporter implements Reporter {
  private suite!: Suite;
  private config!: FullConfig;
  private outputDir: string;
  private started = Date.now();

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir = options.outputDir ?? 'reports';
  }

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.suite = suite;
    this.started = Date.now();
  }

  private rowFor(test: TestCase): TestRow {
    const results: TestResult[] = test.results;
    const last = results[results.length - 1];
    const annotations = [...test.annotations, ...(last?.annotations ?? [])];
    const blocked = annotations.find((a) => a.type === 'blocked' || a.type === 'fixme');
    const skip = annotations.find((a) => a.type === 'skip');
    const outcome = test.outcome();
    let status: Status;
    let reason: string | undefined;
    if (!last) {
      status = 'BLOCKED';
      reason = 'Not executed (setup/dependency failed or run interrupted)';
    } else if (outcome === 'skipped') {
      status = blocked ? 'BLOCKED' : 'SKIPPED';
      reason = (blocked ?? skip)?.description;
    } else if (outcome === 'expected' && last.status === 'passed') status = 'PASS';
    else if (outcome === 'flaky') status = 'PASS';
    else status = 'FAIL';
    return {
      title: test.titlePath().slice(3).join(' › '),
      file: `${path.relative(process.cwd(), test.location.file).split(path.sep).join('/')}:${test.location.line}`,
      project: test.parent.project()?.name ?? '',
      status,
      durationMs: results.reduce((s, r) => s + r.duration, 0),
      retries: Math.max(0, results.length - 1),
      flaky: outcome === 'flaky',
      reason,
      error: last?.error?.message ? strip(last.error.message).split('\n').filter(Boolean).slice(0, 3).join(' ⏎ ') : undefined,
      attachments: (last?.attachments ?? [])
        .filter((a) => a.path)
        .map((a) => ({ name: a.name, path: path.relative(process.cwd(), a.path!).split(path.sep).join('/') })),
    };
  }

  async onEnd(result: FullResult) {
    const cwd = process.cwd();
    const catalog = new Map<string, CatalogEntry>(loadCatalog(cwd).map((c) => [c.id, c]));
    const byTc = new Map<string, TcRow>();
    const untraced: TestRow[] = [];
    let setupFailed: TestRow | undefined;

    for (const test of this.suite.allTests()) {
      const row = this.rowFor(test);
      if (row.project === 'setup') {
        if (row.status === 'FAIL') setupFailed = row;
        continue;
      }
      const ids = test.tags.filter((t) => /^@TC-/i.test(t)).map((t) => t.slice(1));
      if (!ids.length) untraced.push(row);
      for (const id of ids) {
        const c = catalog.get(id);
        const tc = byTc.get(id) ?? { id, title: c?.title ?? test.title, feature: c?.feature ?? '?', status: 'PASS', durationMs: 0, tests: [] };
        tc.tests.push(row);
        tc.durationMs += row.durationMs;
        byTc.set(id, tc);
      }
    }
    for (const tc of byTc.values()) {
      const statuses = tc.tests.map((t) => t.status);
      tc.status = ORDER.find((s) => statuses.includes(s) && (s !== 'SKIPPED' || statuses.every((x) => x === 'SKIPPED'))) ?? 'PASS';
      if (tc.status === 'SKIPPED' && statuses.includes('PASS')) tc.status = 'PASS';
    }

    const automated = scanAutomatedIds(cwd);
    const notAutomated = [...catalog.values()].filter((c) => !automated.has(c.id));
    const rows = [...byTc.values()].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.id.localeCompare(b.id));
    const count = (s: Status) => rows.filter((r) => r.status === s).length;
    const totals = { PASS: count('PASS'), FAIL: count('FAIL'), SKIPPED: count('SKIPPED'), BLOCKED: count('BLOCKED') };
    const durationS = (result.duration / 1000).toFixed(1);

    let md = `# Test execution summary\n\n`;
    md += `- **Run status:** ${result.status} — started ${new Date(this.started).toISOString()}, duration **${durationS}s**\n`;
    md += `- **Base URL:** ${this.config.projects[0]?.use?.baseURL ?? ''}\n`;
    md += `- **Test cases executed:** ${rows.length} — ✅ PASS ${totals.PASS} · ❌ FAIL ${totals.FAIL} · ⏭️ SKIPPED ${totals.SKIPPED} · ⛔ BLOCKED ${totals.BLOCKED}\n`;
    md += `- **Not automated (in testcases/ without a tagged test):** ${notAutomated.length}\n`;
    md += `- HTML report: \`npm run report\` · raw JSON: \`reports/results.json\` · failure digest: \`npm run analyze\`\n\n`;
    if (setupFailed) md += `> ⛔ **Setup failed** (${setupFailed.file}): ${setupFailed.error ?? ''} — dependent tests are BLOCKED.\n\n`;
    md += `| Status | Test case | Feature | Title | Tests | Duration | Details |\n|---|---|---|---|---|---|---|\n`;
    for (const r of rows) {
      const bad = r.tests.filter((t) => t.status !== 'PASS');
      const detail = bad.length
        ? bad.map((t) => `${t.title}: ${(t.error ?? t.reason ?? t.status).replace(/\|/g, '\\|')}`).join('<br>')
        : r.tests.some((t) => t.flaky) ? 'passed on retry (flaky)' : '';
      md += `| ${ICON[r.status]} ${r.status} | ${r.id} | ${r.feature} | ${r.title.replace(/\|/g, '\\|')} | ${r.tests.length} | ${(r.durationMs / 1000).toFixed(1)}s | ${detail} |\n`;
    }
    const failures = rows.filter((r) => r.status === 'FAIL');
    if (failures.length) {
      md += `\n## Failure evidence\n\n`;
      for (const r of failures) for (const t of r.tests.filter((x) => x.status === 'FAIL')) {
        md += `### ${r.id} — ${t.title}\n\n- Location: \`${t.file}\`\n- Error: ${t.error ?? '—'}\n`;
        for (const a of t.attachments) md += `- ${a.name}: \`${a.path}\`${a.name === 'trace' ? ` (open: \`npx playwright show-trace ${a.path}\`)` : ''}\n`;
        md += '\n';
      }
    }
    if (notAutomated.length) md += `\n## Not automated\n\n${notAutomated.map((c) => `- ${c.id} (${c.feature}) ${c.title}`).join('\n')}\n`;
    if (untraced.length) md += `\n## ⚠ Tests without a @TC- tag\n\n${untraced.map((t) => `- ${t.title} (${t.file})`).join('\n')}\n`;

    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(path.join(this.outputDir, 'summary.md'), md);
    fs.writeFileSync(
      path.join(this.outputDir, 'summary.json'),
      JSON.stringify({ status: result.status, durationMs: result.duration, totals, testCases: rows, notAutomated, untraced }, null, 2),
    );

    const line = '─'.repeat(72);
    console.log(`\n${line}\nQA TEST CASE SUMMARY  (${durationS}s)\n${line}`);
    for (const r of rows) console.log(`${ICON[r.status]} ${r.status.padEnd(7)} ${r.id.padEnd(12)} ${r.title.slice(0, 48)}`);
    console.log(line);
    console.log(`PASS ${totals.PASS} | FAIL ${totals.FAIL} | SKIPPED ${totals.SKIPPED} | BLOCKED ${totals.BLOCKED} | not automated ${notAutomated.length}`);
    console.log(`→ ${this.outputDir}/summary.md${failures.length ? ' | run `npm run analyze` for the failure digest' : ''}\n`);
  }

  printsToStdio() {
    return true;
  }
}
