/**
 * Failure digest for the test-maintainer skill: reads reports/results.json (Playwright JSON reporter)
 * and writes reports/failures.md — one compact evidence pack per failed test:
 * TC IDs, cleaned error, heuristic category + signals, page snapshot at failure, matching knowledge
 * screen, evidence file paths and suggested next steps. No LLM involved.
 *
 *   npm run analyze
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, rel, writeFile } from './lib/env';

type Attachment = { name: string; path?: string; contentType: string };
type Result = { status: string; duration: number; retry: number; errors: { message?: string; location?: { file: string; line: number } }[]; attachments: Attachment[] };
type Test = { projectName: string; status: string; results: Result[]; annotations: { type: string; description?: string }[] };
type Spec = { title: string; tags: string[]; file: string; line: number; tests: Test[] };
type Suite = { title: string; specs?: Spec[]; suites?: Suite[] };

const strip = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');
const resultsFile = path.join(ROOT, 'reports', 'results.json');
if (!fs.existsSync(resultsFile)) {
  console.error('✖ reports/results.json not found — run the tests first (npm test).');
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(resultsFile, 'utf8')) as { suites: Suite[]; stats: { startTime: string } };

// ---- knowledge index: h1 heading → screen file, and all known selectors
const kbDir = path.join(ROOT, 'knowledge', 'screens');
const screens = fs.existsSync(kbDir)
  ? fs.readdirSync(kbDir).filter((f) => f.endsWith('.md')).map((f) => {
      const text = fs.readFileSync(path.join(kbDir, f), 'utf8');
      return {
        file: `knowledge/screens/${f}`,
        route: text.match(/\*\*Route:\*\* `([^`]+)`/)?.[1] ?? '?',
        h1: text.match(/h1 "([^"]+)"/)?.[1],
        explored: text.match(/\*\*Last explored:\*\* (\S+)/)?.[1],
        text,
      };
    })
  : [];

type Category = 'ENVIRONMENT' | 'AUTH/SESSION' | 'SELECTOR' | 'NAVIGATION' | 'ASSERTION MISMATCH' | 'TIMING' | 'UNKNOWN';
function classify(error: string, snapshot: string): { category: Category; signals: string[] } {
  const s: string[] = [];
  if (/net::ERR_|ECONNREFUSED|ENOTFOUND|ERR_CONNECTION|50[234] |Service Unavailable|browserType\.launch/i.test(error)) {
    return { category: 'ENVIRONMENT', signals: ['network / server / browser launch error in message'] };
  }
  const onLogin = /textbox "Tên đăng nhập"|button "Đăng nhập"|type=password|textbox ".*(password|mật khẩu)/i.test(snapshot);
  if (onLogin && !/login|đăng nhập/i.test(error)) s.push('page at failure looks like the login screen');
  if (/strict mode violation/i.test(error)) return { category: 'SELECTOR', signals: [...s, 'selector matched more than one element (strict mode violation)'] };
  if (/toHaveURL/.test(error)) {
    if (/\/login/.test(error) || onLogin) return { category: 'AUTH/SESSION', signals: [...s, 'URL assertion failed and the app shows the login page'] };
    return { category: 'NAVIGATION', signals: [...s, 'URL assertion failed'] };
  }
  if (onLogin) return { category: 'AUTH/SESSION', signals: s };
  if (/(locator|page)\.(click|fill|check|uncheck|selectOption|press|hover|setChecked|type)/.test(error) && /Timeout|not found|waiting for/i.test(error)) {
    return { category: 'SELECTOR', signals: [...s, 'an action could not find/act on its element before timeout'] };
  }
  if (/element\(s\) not found/i.test(error)) {
    return { category: 'SELECTOR', signals: [...s, 'assertion target not found — selector changed OR the element legitimately did not appear (check snapshot)'] };
  }
  if (/Expected|Received|toEqual|toHaveText|toContainText|toHaveCount|toBe\(/.test(error)) {
    return { category: 'ASSERTION MISMATCH', signals: [...s, 'element found but value/state differs from the expected result'] };
  }
  if (/Test timeout of \d+ms exceeded/i.test(error)) return { category: 'TIMING', signals: [...s, 'whole test timed out'] };
  return { category: 'UNKNOWN', signals: s };
}

const NEXT: Record<Category, string[]> = {
  ENVIRONMENT: ['Skill class → ENVIRONMENT. Check the app is up (BASE_URL), VPN/network, then re-run only this test.'],
  'AUTH/SESSION': [
    'Skill class → ENVIRONMENT (expired saved session / wrong credentials) or TEST CODE BUG (a test logged out the shared session).',
    'Check .env and explore.config.json auth; tests that log out must use their own session (test.use(loggedOut)).',
  ],
  SELECTOR: [
    'Skill class → SELECTOR CHANGE if the same control exists under a new name/test id; BEHAVIOR CHANGE or APPLICATION BUG if the element is absent because the app behaved differently (check the snapshot).',
    'Re-explore WITH states (modals and validation are captured there): `npm run explore -- --only <route>`; read "Changes since previous exploration" and the States sections.',
    'If the first error is a follow-on (e.g. waitForResponse timeout), look at the step just before it in the error/trace.',
  ],
  NAVIGATION: ['Skill class → NAVIGATION CHANGE (or APPLICATION BUG). Compare with knowledge/navigation.md; re-explore if the flow changed.'],
  'ASSERTION MISMATCH': [
    'Skill class → APPLICATION BUG, BEHAVIOR / VALIDATION CHANGE or INVALID TEST DATA — decide with evidence; never edit the expected result to make it pass.',
    'App contradicts the test case and nothing says the change is intended → APPLICATION BUG: keep the test red, write reports/bugs/<TC>.md.',
    'Requirement changed (release notes, QA) → QA updates the test case first, then the assertion.',
  ],
  TIMING: ['Skill class → TIMING / SYNC. Look for a missing wait on network/UI state; prefer web-first assertions over fixed sleeps.'],
  UNKNOWN: ['Open the trace and read the error-context snapshot, then classify with the test-maintainer table.'],
};

type Failure = { title: string; tcs: string[]; file: string; error: string; category: Category; signals: string[]; snapshot: string; screen?: (typeof screens)[number]; attachments: Attachment[]; retries: number };
const failures: Failure[] = [];

function walk(suite: Suite, parents: string[]) {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) {
      if (!['unexpected', 'flaky'].includes(t.status)) continue;
      const last = t.results[t.results.length - 1];
      if (t.status === 'flaky') continue; // passed on retry — listed separately below
      const error = strip(last.errors.map((e) => e.message ?? '').join('\n')).trim();
      const ctxFile = last.attachments.find((a) => a.name === 'error-context')?.path;
      const ctx = ctxFile && fs.existsSync(ctxFile) ? fs.readFileSync(ctxFile, 'utf8') : '';
      const snapshot = ctx.split(/# Page snapshot/)[1]?.replace(/^\s*```yaml\s*/, '').split('```')[0].trim() ?? '';
      const h1 = snapshot.match(/heading "([^"]+)" \[level=1\]/)?.[1];
      const { category, signals } = classify(error, snapshot);
      const locators = [...error.matchAll(/(getBy\w+\([^)]*\)|locator\('[^']*'\))/g)].map((m) => m[1]);
      for (const l of new Set(locators)) {
        const inKb = screens.filter((s) => s.text.includes(l)).map((s) => s.file);
        signals.push(inKb.length ? `locator \`${l}\` is documented in ${inKb.join(', ')}` : `locator \`${l}\` is NOT in the knowledge base`);
      }
      failures.push({
        title: [...parents.filter(Boolean), spec.title].join(' › '),
        tcs: spec.tags.filter((x) => /^TC-/i.test(x)).concat(spec.tags.filter((x) => /^@TC-/i.test(x)).map((x) => x.slice(1))),
        file: `playwright/tests/${spec.file.split(path.sep).join("/")}:${spec.line}`,
        error,
        category,
        signals,
        snapshot,
        screen: screens.find((s) => s.h1 && s.h1 === h1),
        attachments: last.attachments.filter((a) => a.path),
        retries: t.results.length - 1,
      });
    }
  }
  for (const s of suite.suites ?? []) walk(s, [...parents, s.title]);
}
report.suites.forEach((s) => walk(s, []));

const flaky: string[] = [];
const collectFlaky = (suite: Suite) => {
  for (const spec of suite.specs ?? []) for (const t of spec.tests) if (t.status === 'flaky') flaky.push(`${spec.title} (${spec.file}:${spec.line})`);
  (suite.suites ?? []).forEach(collectFlaky);
};
report.suites.forEach(collectFlaky);

const MAX_SNAPSHOT_LINES = 60;
let md = `# Failure digest\n\nRun started ${report.stats.startTime} — ${failures.length} failed test(s)${flaky.length ? `, ${flaky.length} flaky` : ''}.\n\n`;
md += `> Categories are heuristic hints for the **test-maintainer** skill. Confirm with evidence (trace, live DOM, re-exploration) before changing any test. Never change an expected result to make a test pass.\n\n`;
md += `| # | Test case(s) | Category | Test |\n|---|---|---|---|\n`;
failures.forEach((f, i) => (md += `| ${i + 1} | ${f.tcs.join(', ') || '—'} | ${f.category} | ${f.title.replace(/\|/g, '\\|')} |\n`));
failures.forEach((f, i) => {
  md += `\n---\n\n## ${i + 1}. ${f.tcs.join(', ') || '(no TC tag)'} — ${f.title}\n\n`;
  md += `- **Spec:** \`${f.file}\`${f.retries ? ` (failed ${f.retries + 1} attempts)` : ''}\n`;
  md += `- **Heuristic category:** ${f.category}\n- **Signals:**\n${f.signals.map((s) => `  - ${s}`).join('\n') || '  - —'}\n`;
  md += `- **Screen at failure:** ${f.screen ? `${f.screen.file} (route \`${f.screen.route}\`, explored ${f.screen.explored})` : 'not matched to a known screen'}\n`;
  md += `- **Evidence:**\n${f.attachments.map((a) => `  - ${a.name}: \`${rel(a.path!)}\``).join('\n')}\n`;
  const trace = f.attachments.find((a) => a.name === 'trace');
  if (trace) md += `  - open trace: \`npx playwright show-trace "${rel(trace.path!)}"\`\n`;
  md += `\n**Error**\n\n\`\`\`\n${f.error.split('\n').slice(0, 30).join('\n')}\n\`\`\`\n`;
  if (f.snapshot) {
    const lines = f.snapshot.split('\n');
    md += `\n<details><summary>Page snapshot at failure (${lines.length} lines${lines.length > MAX_SNAPSHOT_LINES ? `, first ${MAX_SNAPSHOT_LINES}` : ''})</summary>\n\n\`\`\`yaml\n${lines.slice(0, MAX_SNAPSHOT_LINES).join('\n')}\n\`\`\`\n</details>\n`;
  }
  md += `\n**Suggested next steps**\n\n${NEXT[f.category].map((s) => `- ${s}`).join('\n')}\n`;
});
if (flaky.length) md += `\n---\n\n## Flaky (passed on retry)\n\n${flaky.map((f) => `- ${f}`).join('\n')}\n\nFlaky tests usually mean a missing wait — investigate as TIMING.\n`;

const out = path.join(ROOT, 'reports', 'failures.md');
writeFile(out, md);
console.log(`${failures.length} failure(s)${flaky.length ? `, ${flaky.length} flaky` : ''} → ${rel(out)}`);
for (const f of failures) console.log(`  - [${f.category}] ${f.title.split(' › ').pop()}`);
