/**
 * Prepare this project for YOUR application: archive the bundled demo into examples/demo-shop/
 * and reset knowledge/, testcases/, playwright/ pages + tests, test-data/, explore.config.json and .env.
 * Skills, scripts, reporter, generic components and config are kept.
 *
 *   npm run project:init -- --base-url https://staging.example.com --dry-run    # show the plan only
 *   npm run project:init -- --base-url https://staging.example.com              # do it
 *   options:  --login-path /login   (default /login)
 *             --sso                 (login via a saved session instead of scripted steps)
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, rel, writeFile } from './lib/env';

const argv = process.argv.slice(2);
const opt = (n: string) => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const dryRun = argv.includes('--dry-run');
const sso = argv.includes('--sso');
const baseUrl = opt('base-url');
const loginPath = opt('login-path') ?? '/login';
const p = (...s: string[]) => path.join(ROOT, ...s);
const EXAMPLE = p('examples', 'demo-shop');

type Action = { desc: string; run: () => void };
const actions: Action[] = [];
const move = (from: string, to: string) => {
  if (!fs.existsSync(from)) return;
  actions.push({
    desc: `move   ${rel(from)} → ${rel(to)}`,
    run: () => {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(from, to);
    },
  });
};
const copy = (from: string, to: string) => {
  if (!fs.existsSync(from)) return;
  actions.push({ desc: `copy   ${rel(from)} → ${rel(to)}`, run: () => fs.cpSync(from, to, { recursive: true }) });
};
const write = (file: string, content: string, note = '') =>
  actions.push({ desc: `write  ${rel(file)}${note ? ` (${note})` : ''}`, run: () => writeFile(file, content) });
const remove = (target: string) => {
  if (!fs.existsSync(target)) return;
  actions.push({ desc: `delete ${rel(target)}`, run: () => fs.rmSync(target, { recursive: true, force: true }) });
};

// ------------------------------------------------------------------ templates
const FIXTURES = `import { test as base, expect } from '@playwright/test';

type Fixtures = {
  /** Unique, parallel-safe suffix for test data (worker index + time + counter). */
  uniq: () => string;
};

/**
 * Project-wide \`test\`: import it from here in every spec so page objects are injected as fixtures.
 * Add a fixture for every new page object (the testcase-generator skill does this).
 */
export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  uniq: async ({}, use, testInfo) => {
    let n = 0;
    await use(() => \`w\${testInfo.workerIndex}\${Date.now().toString(36)}\${(n++).toString(36)}\${Math.random().toString(36).slice(2, 5)}\`);
  },
});

export { expect };

/** Use in \`test.use(loggedOut)\` for tests that must start without a session (login/logout flows). */
export const loggedOut = { storageState: { cookies: [], origins: [] } };
`;

const DATA = `/** Test data factories. Keep values unique per test (use the uniq() fixture) — tests run in parallel. */

/** A string of exactly \`length\` characters that starts with a unique prefix. */
export function textOfLength(prefix: string, length: number): string {
  return (prefix + 'x'.repeat(length)).slice(0, length);
}
`;

const AUTH_SETUP = `import { test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { interpolate, readJson } from '../../scripts/lib/env';
import { runSteps, type Step } from '../../scripts/lib/steps';

const AUTH_FILE = '.auth/user.json';
type AuthConfig = { auth?: { storageState?: string; loginPath?: string; steps?: Step[] } };

/**
 * Generic login: reuses the login defined for the explorer in explore.config.json, so it works for
 * any application. Saved session (SSO/OTP) → copied; scripted steps → executed; no auth → empty session.
 * The testcase-generator may replace this with a LoginPage-based setup.
 */
setup('authenticate', async ({ page, baseURL }) => {
  const { auth } = interpolate(readJson<AuthConfig>('explore.config.json'));
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  if (auth?.storageState) {
    if (!fs.existsSync(auth.storageState)) {
      throw new Error(\`Saved session \${auth.storageState} not found. Log in once: npx playwright codegen \${baseURL} --save-storage=\${auth.storageState}\`);
    }
    fs.copyFileSync(auth.storageState, AUTH_FILE);
    return;
  }
  if (auth?.steps?.length) {
    await page.goto(new URL(auth.loginPath ?? '/', baseURL).toString());
    await runSteps(page, auth.steps, baseURL!);
  }
  await page.context().storageState({ path: AUTH_FILE });
});
`;

const EXPLORE_CONFIG = {
  baseURL: '${BASE_URL}',
  testIdAttribute: 'data-testid',
  auth: sso
    ? { storageState: '.auth/explorer.json' }
    : { loginPath, steps: [] as unknown[], saveStorageStateTo: '.auth/explorer.json' },
  publicPaths: sso ? [] : [loginPath],
  startPaths: ['/'],
  variants: [] as unknown[],
  exclude: ['logout', 'log-out', 'signout', 'sign-out', 'dang-xuat', 'delete', 'remove', 'xoa', '^/api/'],
  maxPages: 30,
  screenshots: true,
  states: [] as unknown[],
};

const MAINTENANCE_LOG = `# Maintenance log

Every change the **test-maintainer** skill makes to Page Objects, specs, test data or the knowledge base is
recorded here (newest first). Application bugs found are recorded too — with the test left failing.

| Date | Test case(s) | Classification | Evidence | Change made | Approved by |
|---|---|---|---|---|---|
`;

function updatedEnv(): string {
  const file = fs.existsSync(p('.env')) ? p('.env') : p('.env.example');
  let text = fs.readFileSync(file, 'utf8');
  const set = (key: string, value: string) => {
    const re = new RegExp(`^#?\\s*${key}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
  };
  set('BASE_URL', baseUrl!);
  set('START_DEMO_APP', '0');
  if (/^QA_USERNAME=admin\s*$/m.test(text) && /^QA_PASSWORD=Admin@123\s*$/m.test(text)) {
    set('QA_USERNAME', '');
    set('QA_PASSWORD', '');
  }
  return text;
}

// ------------------------------------------------------------------ plan
function plan() {
  if (!baseUrl || !/^https?:\/\//.test(baseUrl)) throw new Error('Usage: npm run project:init -- --base-url https://staging.example.com [--login-path /login] [--sso] [--dry-run]');
  if (fs.existsSync(EXAMPLE)) throw new Error(`${rel(EXAMPLE)} already exists — the project was already initialized.`);
  if (!fs.existsSync(p('demo-app'))) throw new Error('demo-app/ not found — the project was already initialized (nothing to archive).');

  move(p('demo-app'), path.join(EXAMPLE, 'demo-app'));
  move(p('knowledge'), path.join(EXAMPLE, 'knowledge'));
  for (const d of fs.existsSync(p('testcases')) ? fs.readdirSync(p('testcases')) : []) {
    if (!d.startsWith('_')) move(p('testcases', d), path.join(EXAMPLE, 'testcases', d));
  }
  move(p('playwright', 'pages'), path.join(EXAMPLE, 'playwright', 'pages'));
  move(p('playwright', 'tests'), path.join(EXAMPLE, 'playwright', 'tests'));
  for (const c of ['AppShell.ts', 'Toast.ts', 'Pagination.ts']) {
    move(p('playwright', 'components', c), path.join(EXAMPLE, 'playwright', 'components', c));
  }
  copy(p('playwright', 'fixtures'), path.join(EXAMPLE, 'playwright', 'fixtures'));
  move(p('test-data'), path.join(EXAMPLE, 'test-data'));
  copy(p('explore.config.json'), path.join(EXAMPLE, 'explore.config.json'));
  write(
    path.join(EXAMPLE, 'README.md'),
    '# Demo: QA Demo Shop\n\nArchived by `npm run project:init`. Reference material only (knowledge base, test cases, page objects and specs produced for the bundled demo app). Start the demo app with `npm run demo:app`.\n',
  );

  write(p('knowledge', 'maintenance-log.md'), MAINTENANCE_LOG, 'empty log');
  write(p('playwright', 'pages', '.gitkeep'), '');
  write(p('playwright', 'tests', 'auth.setup.ts'), AUTH_SETUP, 'generic login from explore.config.json');
  write(p('playwright', 'fixtures', 'test.ts'), FIXTURES, 'no page objects yet');
  write(p('playwright', 'fixtures', 'data.ts'), DATA, 'generic helpers only');
  write(p('test-data', '.gitkeep'), '');
  write(p('explore.config.json'), JSON.stringify(EXPLORE_CONFIG, null, 2) + '\n', sso ? 'saved-session login' : `login page ${loginPath}, steps to be filled`);
  write(p('.env'), updatedEnv(), `BASE_URL=${baseUrl}, START_DEMO_APP=0`);

  const pkgFile = p('package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  pkg.scripts['demo:app'] = 'node examples/demo-shop/demo-app/server.js';
  write(pkgFile, JSON.stringify(pkg, null, 2) + '\n', 'demo:app → examples/');
  move(p('reports', 'bugs'), path.join(EXAMPLE, 'reports', 'bugs')); // keep demo bug reports as examples
  remove(p('reports')); // generated run output of the demo (html, artifacts, summaries)
  remove(p('.auth')); // demo login sessions
}

try {
  plan();
  console.log(`${dryRun ? 'DRY RUN — nothing changed. Planned actions:' : 'Initializing project:'}\n`);
  for (const a of actions) {
    console.log(`  ${a.desc}`);
    if (!dryRun) a.run();
  }
  console.log(
    dryRun
      ? '\nRe-run without --dry-run to apply.'
      : `\n✔ Project ready for ${baseUrl}.\nNext: set QA_USERNAME / QA_PASSWORD in .env${sso ? ' (or create the saved session: npx playwright codegen ' + baseUrl + ' --save-storage=.auth/explorer.json)' : ''}, then explore (website-explorer skill).`,
  );
} catch (e) {
  console.error('✖', (e as Error).message);
  process.exit(1);
}
