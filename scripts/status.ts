/**
 * Project status in one screen: environment, target app, knowledge base, test cases, automation
 * coverage, last run — and the recommended next step. Read-only. Used by the qa-autotest skill.
 *
 *   npm run status
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadEnv, readJson } from './lib/env';
import { loadCatalog, scanAutomatedIds } from '../playwright/utils/testcase-catalog';

loadEnv();
const ok = (b: boolean) => (b ? '✔' : '✖');
const lines: string[] = [];
const say = (s = '') => lines.push(s);
const next: string[] = [];

async function main() {
  // ---------------------------------------------------------------- environment
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const hasDeps = fs.existsSync(path.join(ROOT, 'node_modules', '@playwright', 'test'));
  let browserOk = false;
  if (hasDeps) {
    try {
      const { chromium } = await import('@playwright/test');
      browserOk = fs.existsSync(chromium.executablePath());
    } catch {
      browserOk = false;
    }
  }
  say('ENVIRONMENT');
  say(`  ${ok(nodeMajor >= 20)} Node ${process.versions.node}`);
  say(`  ${ok(hasDeps)} npm dependencies${hasDeps ? '' : ' — run: npm install'}`);
  say(`  ${ok(browserOk)} Chromium${browserOk ? '' : ' — run: npx playwright install chromium'}`);
  if (!hasDeps) next.push('npm install');
  if (hasDeps && !browserOk) next.push('npx playwright install chromium');

  // ---------------------------------------------------------------- target
  const envFile = fs.existsSync(path.join(ROOT, '.env'));
  const baseURL = process.env.BASE_URL ?? '';
  const demoPresent = fs.existsSync(path.join(ROOT, 'demo-app', 'server.js'));
  const demoMode = demoPresent && /localhost:4000/.test(baseURL);
  let reachable = false;
  if (baseURL) {
    try {
      await fetch(baseURL, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
      reachable = true;
    } catch {
      reachable = false;
    }
  }
  const credsSet = !!process.env.QA_USERNAME && !!process.env.QA_PASSWORD;
  let authMode = 'none';
  try {
    const cfg = readJson<{ auth?: { steps?: unknown[]; storageState?: string }; states?: unknown[]; variants?: unknown[] }>(path.join(ROOT, 'explore.config.json'));
    authMode = cfg.auth?.storageState ? `saved session (${cfg.auth.storageState}${fs.existsSync(path.join(ROOT, cfg.auth.storageState)) ? '' : ' — MISSING'})` : cfg.auth?.steps?.length ? 'scripted login steps' : 'none configured';
  } catch {
    authMode = 'explore.config.json missing/invalid';
  }
  say('');
  say('TARGET APPLICATION');
  say(`  ${ok(envFile)} .env${envFile ? '' : ' — copy .env.example to .env'}`);
  say(`  ${ok(!!baseURL)} BASE_URL = ${baseURL || '(not set)'}${demoMode ? '   ← DEMO MODE (bundled demo app)' : ''}`);
  say(`  ${ok(reachable)} reachable${reachable ? '' : demoMode ? ' — start it: npm run demo:app' : ' — check URL / VPN / that the app is up'}`);
  say(`  ${ok(credsSet)} test credentials (QA_USERNAME / QA_PASSWORD)${credsSet ? '' : ' — not set (fine only for SSO saved session or apps without login)'}`);
  say(`    login for explorer/tests: ${authMode}`);
  if (demoPresent) say('  ℹ demo files present (demo-app/, demo knowledge/testcases/tests) — remove with: npm run project:init -- --base-url <url> --dry-run');
  if (!envFile || !baseURL) next.push('configure .env (BASE_URL, credentials)');

  // ---------------------------------------------------------------- knowledge
  const rawDir = path.join(ROOT, 'knowledge', 'raw');
  type RawScreen = { name: string; route: string; exploredAt: string; elements: { selector: string | null; strategy: string | null }[]; states: unknown[] };
  const screens: RawScreen[] = fs.existsSync(rawDir)
    ? fs.readdirSync(rawDir).filter((f) => f.endsWith('.json')).map((f) => readJson<RawScreen>(path.join(rawDir, f)))
    : [];
  say('');
  say('KNOWLEDGE BASE (knowledge/)');
  if (!screens.length) {
    say('  ✖ no screens explored yet');
    next.push('explore the application (website-explorer skill: npm run explore)');
  } else {
    const dates = screens.map((s) => s.exploredAt).sort();
    const unresolved = screens.reduce((n, s) => n + s.elements.filter((e) => !e.selector).length, 0);
    const css = screens.reduce((n, s) => n + s.elements.filter((e) => e.strategy === 'css').length, 0);
    const uncurated = fs
      .readdirSync(path.join(ROOT, 'knowledge', 'screens'))
      .filter((f) => /\*\*Purpose:\*\* UNKNOWN/.test(fs.readFileSync(path.join(ROOT, 'knowledge', 'screens', f), 'utf8'))).length;
    say(`  ✔ ${screens.length} screen(s): ${screens.map((s) => s.name).join(', ')}`);
    say(`    explored ${dates[0].slice(0, 16)} … ${dates[dates.length - 1].slice(0, 16)}; states captured: ${screens.reduce((n, s) => n + s.states.length, 0)}`);
    say(`    ${unresolved ? '⚠' : '✔'} unresolved selectors: ${unresolved}   ${css ? '⚠' : '✔'} CSS-fallback selectors: ${css}   ${uncurated ? 'ℹ' : '✔'} screens without curated purpose: ${uncurated}`);
  }

  // ---------------------------------------------------------------- test cases & coverage
  const catalog = loadCatalog(ROOT);
  const automated = scanAutomatedIds(ROOT);
  const features = [...new Set(catalog.map((c) => c.feature))];
  const pendingImports = fs.existsSync(path.join(ROOT, 'testcases'))
    ? fs.readdirSync(path.join(ROOT, 'testcases'), { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile() && /\.(xlsx|csv)$/i.test(e.name) && !e.parentPath.includes('_template'))
        .map((e) => path.join(e.parentPath, e.name))
        // the importer writes <slug of file name>.md next to it (same slug rule as import-testcases.ts)
        .filter((f) => {
          const slug = path.basename(f).replace(/\.(xlsx|csv)$/i, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          return !fs.existsSync(path.join(path.dirname(f), `${slug}.md`));
        })
    : [];
  say('');
  say('TEST CASES (testcases/) AND AUTOMATION');
  if (!catalog.length && !pendingImports.length) {
    say('  ✖ no test cases yet — put QA test cases (.md, .xlsx, .csv) into testcases/<feature>/');
    if (screens.length) next.push('add test cases to testcases/<feature>/');
  }
  for (const f of features) {
    const tcs = catalog.filter((c) => c.feature === f);
    const auto = tcs.filter((c) => automated.get(c.id)?.kinds.has('test')).length;
    const blocked = tcs.filter((c) => !automated.get(c.id)?.kinds.has('test') && automated.has(c.id)).length;
    const none = tcs.length - auto - blocked;
    say(`  ${none ? '⚠' : '✔'} ${f.padEnd(18)} ${tcs.length} TC — automated ${auto}, blocked ${blocked}, not automated ${none}`);
    if (none) next.push(`generate tests for feature "${f}" (testcase-generator skill)`);
  }
  for (const f of pendingImports) {
    say(`  ⚠ not imported yet: ${path.relative(ROOT, f)}`);
    next.push(`import ${path.relative(ROOT, f)} (npm run testcases:import) and generate tests`);
  }

  // ---------------------------------------------------------------- last run
  const summaryFile = path.join(ROOT, 'reports', 'summary.json');
  say('');
  say('LAST TEST RUN (reports/)');
  if (!fs.existsSync(summaryFile)) {
    say('  — no run yet');
    if (automated.size) next.push('run the tests (npm test)');
  } else {
    const s = readJson<{ status: string; durationMs: number; totals: Record<string, number>; testCases: { id: string; status: string }[] }>(summaryFile);
    const when = fs.statSync(summaryFile).mtime;
    const failed = s.testCases.filter((t) => t.status === 'FAIL').map((t) => t.id);
    say(`  ${failed.length ? '✖' : '✔'} ${when.toISOString().slice(0, 16)} — PASS ${s.totals.PASS} · FAIL ${s.totals.FAIL} · SKIPPED ${s.totals.SKIPPED} · BLOCKED ${s.totals.BLOCKED} (${(s.durationMs / 1000).toFixed(1)}s)`);
    if (s.testCases.length < automated.size) say(`    ℹ partial run: ${s.testCases.length} of ${automated.size} automated test cases were executed (filtered with --grep?)`);
    if (failed.length) {
      say(`    failing: ${failed.join(', ')}`);
      const digest = path.join(ROOT, 'reports', 'failures.md');
      const digestFresh = fs.existsSync(digest) && fs.statSync(digest).mtime >= when;
      next.push(`${digestFresh ? '' : 'npm run analyze, then '}investigate failures (test-maintainer skill)`);
    }
    const bugs = path.join(ROOT, 'reports', 'bugs');
    if (fs.existsSync(bugs)) say(`    bug reports: ${fs.readdirSync(bugs).filter((f) => f.endsWith('.md')).join(', ') || '—'}`);
  }

  say('');
  say('NEXT STEP');
  say(next.length ? next.map((n, i) => `  ${i + 1}. ${n}`).join('\n') : '  ✔ nothing pending — run the suite again after the next deployment (npm test)');
  console.log(lines.join('\n'));
}

main().catch((e) => {
  console.error('✖ status failed:', e.message);
  process.exit(1);
});
