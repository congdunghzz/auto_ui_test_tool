/**
 * Website Explorer — deterministic Playwright crawler that builds the UI Knowledge Base.
 *
 *   npm run explore                          # crawl from explore.config.json
 *   npm run explore -- --only /customers     # re-explore specific routes (comma separated)
 *   npm run explore -- --no-states --headed  # skip configured states, show the browser
 *   npm run explore -- --config other.json
 *
 * No LLM is involved here: the script inspects DOM + accessibility info, verifies that every
 * proposed selector resolves to exactly one element, and writes Markdown/JSON into knowledge/.
 * An AI agent then curates the Markdown (purpose, business rules, workflows) in batch.
 */
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, interpolate, loadEnv, readJson, rel, writeFile } from './lib/env';
import { describeStep, runSteps, type Step } from './lib/steps';

// ------------------------------------------------------------------ types
type StateDef = { path: string; name: string; description?: string; steps: Step[] };
type VariantDef = { path: string; name: string; description?: string };
type Config = {
  baseURL: string;
  testIdAttribute?: string;
  auth?: { storageState?: string; loginPath?: string; steps?: Step[]; saveStorageStateTo?: string };
  startPaths?: string[];
  publicPaths?: string[];
  exclude?: string[];
  maxPages?: number;
  screenshots?: boolean;
  states?: StateDef[];
  variants?: VariantDef[];
};
type Container = { role: string; name: string };
type RawEl = {
  idx: string; tag: string; role: string | null; inputType: string | null; name: string; label: string | null;
  placeholder: string | null; testId: string | null; id: string | null; nameAttr: string | null; value: string | null;
  text: string; href: string | null; required: boolean; disabled: boolean; checked: boolean | null;
  selected: string | null; current: string | null; constraints: Record<string, string>; options: string[] | null;
  group: string | null; form: string | null; container: Container | null;
  rowScoped: { table: string; rowId: string; rows: number } | null;
};
type El = RawEl & { selector: string | null; strategy: string | null; scope: 'page' | 'container' | 'row' | null; tightenedBy?: string };
type Collected = {
  title: string; url: string; elements: RawEl[]; rowRepeats: Record<string, number>;
  tables: { name: string; role: string; headers: string[]; visibleRows: number; sampleRow: string[] }[];
  dialogs: { role: string; name: string; visible: boolean; modal: boolean }[];
  tablists: { name: string; tabs: { name: string; selected: boolean }[] }[];
  navs: { name: string; isPagination: boolean; links: { text: string; href: string; current: string | null }[]; controls: string[] }[];
  liveRegions: { role: string; live: string | null; testId: string | null; id: string | null; visible: boolean; text: string }[];
  headings: { level: number; text: string }[];
  testIdElements: { testId: string; tag: string; role: string | null; visible: boolean; text: string }[];
  links: { text: string; href: string }[];
  texts: string[];
};
type StateData = {
  name: string; description?: string; steps: string[]; error?: string; finalUrl?: string;
  newElements: El[]; appearedTexts: string[]; openDialogs: Collected['dialogs']; dialogSnapshot?: string; screenshot?: string;
  apiCalls: string[];
  /** set when --no-states reused this state from an earlier exploration (not re-verified) */
  carriedFrom?: string;
};
type Screen = {
  name: string; route: string; url: string; finalUrl: string; requiresAuth: boolean; exploredAt: string;
  variant?: string; variantDescription?: string;
  title: string; headings: Collected['headings']; elements: El[]; rowRepeats: Record<string, number>;
  tables: Collected['tables']; dialogs: Collected['dialogs']; tablists: Collected['tablists']; navs: Collected['navs'];
  liveRegions: Collected['liveRegions']; outgoing: { text: string; route: string; href: string }[]; texts: string[];
  testIdElements: Collected['testIdElements'];
  ariaSnapshot: string; screenshot?: string; states: StateData[]; apiCalls: string[];
  changes?: { previousAt: string; added: string[]; removed: string[] };
};

// ------------------------------------------------------------------ args & config
const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

loadEnv();
const configPath = path.resolve(ROOT, opt('config') ?? 'explore.config.json');
const cfg = interpolate(readJson<Config>(configPath));
const only = opt('only')?.split(',').map((s) => s.trim()).filter(Boolean);
const KB = path.join(ROOT, 'knowledge');
const COLLECTOR = fs.readFileSync(path.join(__dirname, 'lib', 'collector.browser.js'), 'utf8');
const testIdAttribute = cfg.testIdAttribute ?? 'data-testid';
const origin = new URL(cfg.baseURL).origin;

// ------------------------------------------------------------------ helpers
export function normalizeRoute(pathname: string): string {
  const segs = pathname.split('/').filter(Boolean).map((s) =>
    /^\d+$/.test(s) || /^[0-9a-f]{8,}$/i.test(s) || /^[0-9a-f-]{32,36}$/i.test(s) ? ':id' : s,
  );
  return '/' + segs.join('/');
}
export function screenName(route: string): string {
  if (route === '/') return 'home';
  return route.split('/').filter(Boolean).map((s) => (s === ':id' ? 'detail' : s.replace(/[^\w-]+/g, '-'))).join('-');
}
const isExcluded = (pathname: string) => (cfg.exclude ?? []).some((p) => new RegExp(p, 'i').test(pathname));
const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const md = (s: string | null | undefined) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const SAFE_ID = /^[A-Za-z][\w-]*$/;
const GENERATED_ID = /\d{4,}|[0-9a-f]{8,}|^(ember|react|mui|radix|headlessui)/i;

async function collect(page: Page): Promise<Collected> {
  return (await page.evaluate(`(${COLLECTOR.trim().replace(/^\/\/.*$/gm, '')})(${JSON.stringify({ testIdAttribute })})`)) as Collected;
}

/** Record XHR/fetch calls as "METHOD /path?param1&param2" (values dropped: they may contain data). */
function trackApiCalls(page: Page): Set<string> {
  const calls = new Set<string>();
  page.on('request', (r) => {
    if (!['fetch', 'xhr'].includes(r.resourceType())) return;
    const u = new URL(r.url());
    const keys = [...new Set(u.searchParams.keys())];
    calls.add(`${r.method()} ${normalizeRoute(u.pathname)}${keys.length ? '?' + keys.join('&') : ''}`);
  });
  return calls;
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(250);
}

type Cand = { strategy: string; code: string; make: (root: Page | Locator) => Locator };
function candidates(el: RawEl): Cand[] {
  const list: Cand[] = [];
  const role = el.role as Parameters<Page['getByRole']>[0] | null;
  if (el.testId) list.push({ strategy: 'testid', code: `getByTestId(${q(el.testId)})`, make: (r) => r.getByTestId(el.testId!) });
  if (role && el.name) {
    list.push({ strategy: 'role', code: `getByRole(${q(role)}, { name: ${q(el.name)} })`, make: (r) => r.getByRole(role, { name: el.name }) });
    list.push({ strategy: 'role', code: `getByRole(${q(role)}, { name: ${q(el.name)}, exact: true })`, make: (r) => r.getByRole(role, { name: el.name, exact: true }) });
  }
  if (el.label) {
    list.push({ strategy: 'label', code: `getByLabel(${q(el.label)})`, make: (r) => r.getByLabel(el.label!) });
    list.push({ strategy: 'label', code: `getByLabel(${q(el.label)}, { exact: true })`, make: (r) => r.getByLabel(el.label!, { exact: true }) });
  }
  if (el.placeholder) {
    list.push({ strategy: 'placeholder', code: `getByPlaceholder(${q(el.placeholder)})`, make: (r) => r.getByPlaceholder(el.placeholder!) });
  }
  if (el.id && SAFE_ID.test(el.id) && !GENERATED_ID.test(el.id)) {
    list.push({ strategy: 'css', code: `locator(${q('#' + el.id)})`, make: (r) => r.locator('#' + el.id) });
  }
  if (el.nameAttr) {
    const css = `${el.tag}[name="${el.nameAttr}"]${el.value ? `[value="${el.value}"]` : ''}`;
    list.push({ strategy: 'css', code: `locator(${q(css)})`, make: (r) => r.locator(css) });
  }
  return list;
}

async function points(loc: Locator, idx: string): Promise<boolean> {
  try {
    if ((await loc.count()) !== 1) return false;
    return (await loc.getAttribute('data-qa-idx', { timeout: 1000 })) === idx;
  } catch {
    return false;
  }
}

async function resolveSelectors(page: Page, raw: RawEl[]): Promise<El[]> {
  const out: El[] = [];
  for (const el of raw) {
    const cands = candidates(el);
    let found: El | null = null;
    const scopes: { scope: El['scope']; prefix: string; root: Page | Locator }[] = [{ scope: 'page', prefix: 'page.', root: page }];
    if (el.container) {
      const c = el.container;
      // Elements inside a modal are always scoped to it (robust against same-named controls behind the modal).
      const inModal = c.role === 'dialog' || c.role === 'alertdialog';
      scopes[inModal ? 'unshift' : 'push']({
        scope: 'container',
        prefix: `page.getByRole(${q(c.role)}, { name: ${q(c.name)} }).`,
        root: page.getByRole(c.role as Parameters<Page['getByRole']>[0], { name: c.name }),
      });
    }
    if (el.rowScoped) scopes.push({ scope: 'row', prefix: 'row.', root: page.locator(`[data-qa-row="${el.rowScoped.rowId}"]`) });
    outer: for (const s of scopes) {
      for (const c of cands) {
        if (await points(c.make(s.root), el.idx)) {
          found = { ...el, selector: s.prefix + c.code, strategy: c.strategy, scope: s.scope };
          break outer;
        }
      }
    }
    out.push(found ?? { ...el, selector: null, strategy: null, scope: null });
  }
  return out;
}

const elKey = (e: El) => `${e.role ?? e.tag}|${e.name}|${e.selector ?? '?'}`;
const identity = (e: RawEl) =>
  `${e.role ?? e.tag}|${e.name}|${e.container ? `${e.container.role}:${e.container.name}` : ''}|${e.rowScoped ? 'row' : ''}`;
const typeOf = (e: RawEl) => e.role ?? (e.inputType ? `input[${e.inputType}]` : e.tag);

function notesOf(e: El): string {
  const n: string[] = [];
  if (e.required) n.push('required');
  if (e.disabled) n.push('disabled');
  if (e.checked !== null && e.checked !== undefined) n.push(e.checked ? 'checked' : 'unchecked');
  if (e.selected) n.push(`aria-selected=${e.selected}`);
  if (e.current) n.push(`aria-current=${e.current}`);
  for (const [k, v] of Object.entries(e.constraints)) if (!(k === 'type' && ['text', 'submit', 'button'].includes(v))) n.push(`${k}=${v}`);
  if (e.options) n.push(`options: ${e.options.join(' / ')}`);
  if (e.group) n.push(`group "${e.group}"`);
  if (e.href) n.push(`href ${e.href}`);
  if (e.rowScoped) n.push(`per-row control in table "${e.rowScoped.table}" (${e.rowScoped.rows} visible rows)`);
  if (e.tightenedBy) n.push(`stricter selector: the looser one is ambiguous in state "${e.tightenedBy}"`);
  if (e.strategy === 'css') n.push('⚠ CSS fallback — ask devs for a data-testid');
  if (!e.selector) n.push('⚠ UNRESOLVED: no unique selector found');
  return n.join('; ');
}

// ------------------------------------------------------------------ exploration
const redirects = new Map<string, string>(); // requested url → final url, filled by exploreRoute

async function exploreRoute(ctx: BrowserContext, url: string, requiresAuth: boolean, variant?: VariantDef): Promise<Screen | null> {
  const page = await ctx.newPage();
  const calls = trackApiCalls(page);
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
    await settle(page);
    const finalUrl = page.url();
    const route = normalizeRoute(new URL(url).pathname);
    const finalRoute = normalizeRoute(new URL(finalUrl).pathname);
    if (finalRoute !== route) {
      console.log(`  ↪ ${route} redirected to ${finalRoute}`);
      redirects.set(url, finalUrl);
      return null;
    }
    if (resp && resp.status() >= 400) console.log(`  ⚠ ${route} responded HTTP ${resp.status()}`);
    const data = await collect(page);
    const elements = await resolveSelectors(page, data.elements);
    const name = variant?.name ?? screenName(route);
    let screenshot: string | undefined;
    if (cfg.screenshots !== false) {
      screenshot = path.join(KB, 'screenshots', `${name}.png`);
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      await page.screenshot({ path: screenshot, fullPage: true });
    }
    const outgoing = data.links
      .filter((l) => l.href.startsWith(origin))
      .map((l) => ({ text: l.text, route: normalizeRoute(new URL(l.href).pathname), href: l.href }))
      .filter((l, i, arr) => arr.findIndex((x) => x.route === l.route && x.text === l.text) === i);
    return {
      name, variant: variant?.name, variantDescription: variant?.description, route, url, finalUrl, requiresAuth, exploredAt: new Date().toISOString(),
      title: data.title, headings: data.headings, elements, rowRepeats: data.rowRepeats, tables: data.tables,
      dialogs: data.dialogs, tablists: data.tablists, navs: data.navs, liveRegions: data.liveRegions, outgoing,
      testIdElements: data.testIdElements,
      texts: data.texts, ariaSnapshot: await page.locator('body').ariaSnapshot().catch(() => ''), screenshot, states: [],
      apiCalls: [...calls],
    };
  } finally {
    await page.close();
  }
}

async function exploreState(ctx: BrowserContext, screen: Screen, def: StateDef): Promise<StateData> {
  const page = await ctx.newPage();
  const state: StateData = { name: def.name, description: def.description, steps: def.steps.map(describeStep), newElements: [], appearedTexts: [], openDialogs: [], apiCalls: [] };
  try {
    await page.goto(new URL(def.path, cfg.baseURL).toString(), { waitUntil: 'domcontentloaded' });
    await settle(page);
    const before = await collect(page);
    const calls = trackApiCalls(page);
    await runSteps(page, def.steps, cfg.baseURL);
    await settle(page);
    const after = await collect(page);
    const resolved = await resolveSelectors(page, after.elements);
    const base = new Map(screen.elements.map((e) => [identity(e), e]));
    state.newElements = resolved.filter((e) => !base.has(identity(e)));
    // A base selector that is no longer unique in this state gets the stricter selector verified here.
    for (const e of resolved) {
      const b = base.get(identity(e));
      if (b && e.selector && b.selector && e.selector !== b.selector && !b.rowScoped && !b.tightenedBy) {
        b.selector = e.selector;
        b.strategy = e.strategy;
        b.tightenedBy = def.name;
      }
    }
    const beforeTexts = new Set(before.texts);
    state.appearedTexts = after.texts.filter((t) => !beforeTexts.has(t));
    state.openDialogs = after.dialogs.filter((d) => d.visible);
    state.finalUrl = page.url();
    state.apiCalls = [...calls];
    if (state.openDialogs[0]) {
      const d = state.openDialogs[0];
      state.dialogSnapshot = await page
        .getByRole(d.role as 'dialog', { name: d.name })
        .ariaSnapshot()
        .catch(() => undefined);
    }
    if (cfg.screenshots !== false) {
      state.screenshot = path.join(KB, 'screenshots', `${screen.name}--${def.name}.png`);
      await page.screenshot({ path: state.screenshot, fullPage: true });
    }
  } catch (err) {
    state.error = (err as Error).message.split('\n')[0];
  } finally {
    await page.close();
  }
  return state;
}

async function authenticate(browser: Browser): Promise<string | undefined> {
  const auth = cfg.auth;
  if (!auth) return undefined;
  if (auth.storageState) {
    const p = path.resolve(ROOT, auth.storageState);
    if (!fs.existsSync(p)) {
      throw new Error(
        `auth.storageState "${auth.storageState}" not found. Create it by logging in manually:\n` +
          `  npx playwright codegen ${cfg.baseURL} --save-storage=${auth.storageState}`,
      );
    }
    return p;
  }
  if (!auth.steps?.length) return undefined;
  const ctx = await browser.newContext({ baseURL: cfg.baseURL });
  const page = await ctx.newPage();
  await page.goto(new URL(auth.loginPath ?? '/', cfg.baseURL).toString());
  await runSteps(page, auth.steps, cfg.baseURL);
  await settle(page);
  const out = path.resolve(ROOT, auth.saveStorageStateTo ?? '.auth/explorer.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await ctx.storageState({ path: out });
  await ctx.close();
  console.log(`✔ Logged in, session saved to ${rel(out)}`);
  return out;
}

// ------------------------------------------------------------------ markdown
const AUTO_START = '<!-- AUTO-GENERATED:START (explorer overwrites this block; edit outside it) -->';
const AUTO_END = '<!-- AUTO-GENERATED:END -->';

function mergeAuto(file: string, header: string, auto: string): void {
  const block = `${AUTO_START}\n${auto.trim()}\n${AUTO_END}`;
  if (fs.existsSync(file)) {
    const cur = fs.readFileSync(file, 'utf8');
    const s = cur.indexOf(AUTO_START);
    const e = cur.indexOf(AUTO_END);
    if (s >= 0 && e > s) {
      writeFile(file, cur.slice(0, s) + block + cur.slice(e + AUTO_END.length));
      return;
    }
  }
  writeFile(file, `${header.trim()}\n\n${block}\n`);
}

function elementTable(els: El[]): string {
  if (!els.length) return '_none_\n';
  const rows = els.map((e, i) => `| ${i + 1} | ${md(typeOf(e))} | ${md(e.name || e.text)} | ${e.selector ? '`' + md(e.selector) + '`' : '—'} | ${md(notesOf(e))} |`);
  return ['| # | Type | Accessible name | Selector (verified unique) | Notes |', '|---|---|---|---|---|', ...rows].join('\n') + '\n';
}

function formsSection(els: El[]): string {
  const byForm = new Map<string, El[]>();
  for (const e of els) if (e.form) byForm.set(e.form, [...(byForm.get(e.form) ?? []), e]);
  if (!byForm.size) return '_No <form> elements visible._\n';
  let s = '';
  for (const [form, fields] of byForm) {
    s += `### Form \`${form}\`\n\n| Field | Type | Required | Constraints | Selector |\n|---|---|---|---|---|\n`;
    for (const f of fields) {
      const cons = Object.entries(f.constraints).filter(([k]) => k !== 'type').map(([k, v]) => `${k}=${v}`).join(', ');
      s += `| ${md(f.name || f.text)} | ${md(typeOf(f))} | ${f.required ? 'yes' : ''} | ${md(cons + (f.options ? ` options: ${f.options.join(' / ')}` : ''))} | ${f.selector ? '`' + md(f.selector) + '`' : '⚠ unresolved'} |\n`;
    }
    s += '\n';
  }
  return s + '> Validation messages are only known if a configured state triggers them (see **States**). Otherwise: UNKNOWN.\n';
}

function renderScreen(s: Screen): string {
  const shot = (p?: string) => (p ? `![screenshot](${path.relative(path.join(KB, 'screens'), p).split(path.sep).join('/')})` : '_no screenshot_');
  let out = `## Overview (auto)\n\n`;
  if (s.variant) out += `- **Variant:** ${md(s.variantDescription ?? s.variant)} — same route as [${screenName(s.route)}](${screenName(s.route)}.md), different data state\n`;
  out += `- **Route:** \`${s.route}\` — explored URL: ${s.url}\n- **Requires login:** ${s.requiresAuth ? 'yes' : 'no'}\n`;
  out += `- **Document title:** ${md(s.title)}\n- **Headings:** ${s.headings.map((h) => `h${h.level} "${h.text}"`).join(', ') || '—'}\n`;
  out += `- **Last explored:** ${s.exploredAt}\n- **Screenshot:** ${shot(s.screenshot)}\n\n`;
  if (s.changes) {
    out += `### Changes since previous exploration (${s.changes.previousAt})\n\n`;
    out += s.changes.added.length || s.changes.removed.length
      ? [...s.changes.added.map((a) => `- ➕ ${md(a)}`), ...s.changes.removed.map((r) => `- ➖ ${md(r)}`)].join('\n') + '\n\n'
      : '_No element changes detected._\n\n';
  }
  const pageEls = s.elements.filter((e) => !e.rowScoped);
  const rowEls = s.elements.filter((e) => e.rowScoped);
  out += `## Interactive elements\n\n${elementTable(pageEls)}\n`;
  out += `## Forms and fields\n\n${formsSection(pageEls)}\n`;
  out += `## Tables\n\n`;
  if (!s.tables.length) out += '_none_\n\n';
  for (const t of s.tables) {
    out += `### Table "${md(t.name) || '(unnamed)'}" — \`page.getByRole('table'${t.name ? `, { name: ${q(t.name)} }` : ''})\`\n\n`;
    out += `- Columns: ${t.headers.map((h) => `\`${md(h)}\``).join(' | ') || '—'}\n- Visible rows at exploration time: ${t.visibleRows}\n`;
    out += `- Sample first row: ${t.sampleRow.map((c) => `"${md(c)}"`).join(', ') || '—'}\n`;
    const own = rowEls.filter((e) => e.rowScoped!.table === t.name);
    if (own.length) {
      out += `- Row-level controls (locate the row first, e.g. \`const row = page.getByRole('table'${t.name ? `, { name: ${q(t.name)} }` : ''}).getByRole('row').filter({ hasText: '<unique cell text>' })\`):\n\n`;
      out += elementTable(own);
    }
    out += '\n';
  }
  out += `## Dialogs / modals\n\n`;
  out += s.dialogs.length
    ? s.dialogs.map((d) => `- ${d.role} "${md(d.name)}" — ${d.visible ? 'visible on load' : 'present in DOM but hidden on load (opened by an action; see States)'}${d.modal ? ', modal' : ''}`).join('\n') + '\n\n'
    : '_none detected_\n\n';
  out += `## Tabs\n\n`;
  out += s.tablists.length
    ? s.tablists.map((t) => `- tablist "${md(t.name)}": ${t.tabs.map((x) => (x.selected ? `**${x.name}** (selected)` : x.name)).join(', ')}`).join('\n') + '\n\n'
    : '_none_\n\n';
  out += `## Navigation menus and pagination\n\n`;
  out += s.navs.length
    ? s.navs.map((n) => `- ${n.isPagination ? 'pagination' : 'navigation'} "${md(n.name)}": ${[...n.links.map((l) => `${l.text} → ${l.href}${l.current ? ' (current)' : ''}`), ...n.controls.map((c) => `[button] ${c}`)].join(', ')}`).join('\n') + '\n\n'
    : '_none_\n\n';
  out += `## Notifications / live regions\n\n`;
  out += s.liveRegions.length
    ? s.liveRegions.map((r) => `- ${r.role}${r.live ? ` (aria-live=${r.live})` : ''}${r.testId ? ` testid=\`${r.testId}\`` : ''}${r.id ? ` id=\`${r.id}\`` : ''} — ${r.visible ? `visible: "${md(r.text)}"` : 'hidden on load'}`).join('\n') + '\n\n'
    : '_none_\n\n';
  out += `## Other elements with a test id (assertion targets)\n\n`;
  out += s.testIdElements?.length
    ? '| Selector | Tag | Visible on load | Text at exploration time |\n|---|---|---|---|\n' +
      s.testIdElements.map((t) => `| \`page.getByTestId(${q(t.testId)})\` | ${t.tag} | ${t.visible ? 'yes' : 'no'} | ${md(t.text)} |`).join('\n') + '\n\n'
    : '_none_\n\n';
  out += `## Network calls on load (XHR/fetch)\n\n`;
  out += s.apiCalls.length
    ? s.apiCalls.map((c) => `- \`${c}\``).join('\n') + '\n\n> Useful for `page.waitForResponse()` when the UI has no loading indicator. Query values are omitted.\n\n'
    : '_none_\n\n';
  out += `## Outgoing navigation\n\n`;
  out += s.outgoing.length
    ? '| Link text | Target route | Target screen |\n|---|---|---|\n' + s.outgoing.map((o) => `| ${md(o.text)} | \`${o.route}\` | [${screenName(o.route)}](${screenName(o.route)}.md) |`).join('\n') + '\n\n'
    : '_none_\n\n';
  out += `## States (captured by configured actions)\n\n`;
  if (!s.states.length) out += '_No states configured for this screen. Add entries to `states` in explore.config.json to capture modals and validation messages._\n\n';
  for (const st of s.states) {
    out += `### State \`${st.name}\`${st.description ? ` — ${md(st.description)}` : ''}\n\n`;
    if (st.carriedFrom) out += `- ⚠ Carried over from the exploration of ${st.carriedFrom} (run with --no-states) — not re-verified\n`;
    out += `- Steps: ${st.steps.map((x) => `\`${md(x)}\``).join(' → ')}\n`;
    if (st.error) {
      out += `- ⚠ **Could not reproduce:** ${md(st.error)}\n\n`;
      continue;
    }
    if (st.finalUrl) out += `- URL after steps: ${st.finalUrl}\n`;
    out += `- Open dialogs: ${st.openDialogs.map((d) => `${d.role} "${md(d.name)}"`).join(', ') || 'none'}\n`;
    out += `- Network calls triggered: ${st.apiCalls.map((c) => `\`${c}\``).join(', ') || 'none'}\n`;
    out += `- Texts that appeared (validation messages, toasts, ...): ${st.appearedTexts.map((t) => `"${md(t)}"`).join(', ') || 'none'}\n`;
    out += `- Screenshot: ${shot(st.screenshot)}\n\nElements that appeared in this state:\n\n${elementTable(st.newElements)}\n`;
    if (st.newElements.some((e) => e.form)) out += `Forms in this state:\n\n${formsSection(st.newElements)}\n`;
    if (st.dialogSnapshot) out += `<details><summary>Dialog accessibility snapshot</summary>\n\n\`\`\`yaml\n${st.dialogSnapshot}\n\`\`\`\n</details>\n\n`;
  }
  const repeats = Object.entries(s.rowRepeats);
  if (repeats.length) out += `> Note: ${repeats.reduce((a, [, n]) => a + n, 0)} repeated per-row controls in other table rows were collapsed.\n\n`;
  out += `## Accessibility snapshot on load\n\n<details><summary>aria snapshot (YAML)</summary>\n\n\`\`\`yaml\n${s.ariaSnapshot}\n\`\`\`\n</details>\n`;
  return out;
}

function screenHeader(s: Screen): string {
  return `# Screen: ${s.name}

## Curated notes (AI/QA maintained — explorer never overwrites this section)

- **Purpose:** UNKNOWN — fill in from business docs or QA. Mark inferred statements with _(inferred, unverified)_.
- **Business rules / validation:** UNKNOWN
- **Dependencies on other screens:** UNKNOWN
- **Test data needs:** UNKNOWN
- **Known limitations / open questions:** —
`;
}

function renderNavigation(screens: Screen[]): string {
  const byRoute = new Map(screens.map((s) => [s.route, s]));
  const incoming = new Map<string, Set<string>>();
  for (const s of screens) for (const o of s.outgoing) incoming.set(o.route, (incoming.get(o.route) ?? new Set()).add(s.name));
  let out = `| Screen | Route | Login | Reached from | Links to |\n|---|---|---|---|---|\n`;
  for (const s of screens) {
    const to = [...new Set(s.outgoing.map((o) => o.route))].map((r) => (byRoute.has(r) ? `[${screenName(r)}](screens/${screenName(r)}.md)` : `\`${r}\` (not explored)`));
    out += `| [${s.name}](screens/${s.name}.md)${s.variant ? ' (variant)' : ''} | \`${s.route}\` | ${s.requiresAuth ? 'yes' : 'no'} | ${[...(incoming.get(s.route) ?? [])].join(', ') || '—'} | ${to.join(', ') || '—'} |\n`;
  }
  out += `\n\`\`\`mermaid\nflowchart LR\n`;
  const id = (r: string) => screenName(r).replace(/-/g, '_');
  const base = screens.filter((s) => !s.variant);
  for (const s of base) out += `  ${id(s.route)}["${s.name}<br/>${s.route}"]\n`;
  const edges = new Set<string>();
  for (const s of base) for (const o of s.outgoing) if (byRoute.has(o.route) && o.route !== s.route) edges.add(`  ${id(s.route)} --> ${id(o.route)}`);
  out += [...edges].join('\n') + '\n```\n';
  return out;
}

function renderShared(screens: Screen[]): string {
  const map = new Map<string, { el: El; screens: string[] }>();
  for (const s of screens) for (const e of s.elements) {
    if (!e.selector || e.rowScoped) continue;
    const k = elKey(e);
    const cur = map.get(k) ?? { el: e, screens: [] };
    cur.screens.push(s.name);
    map.set(k, cur);
  }
  const shared = [...map.values()].filter((v) => v.screens.length >= 2);
  if (!shared.length) return '_No elements shared across screens._\n';
  return (
    'Elements present on 2+ screens — candidates for reusable components (e.g. `playwright/components/`).\n\n' +
    '| Type | Name | Selector | Screens |\n|---|---|---|---|\n' +
    shared.map((v) => `| ${md(typeOf(v.el))} | ${md(v.el.name)} | \`${md(v.el.selector)}\` | ${v.screens.join(', ')} |`).join('\n') + '\n'
  );
}

function ensureTemplates(screens: Screen[]): void {
  const app = path.join(KB, 'application.md');
  mergeAuto(
    app,
    `# Application overview

## Curated notes (AI/QA maintained)

- **Application:** UNKNOWN — name and purpose
- **Environments:** base URL comes from \`BASE_URL\` in \`.env\`
- **Roles / test accounts:** credentials live in \`.env\` only (never in this file)
- **Test data policy:** UNKNOWN — may tests create / modify / delete data in this environment? Record as \`yes\` or \`no\` with who confirmed it and when.
- **Business glossary:** —
- **Out of scope / not explored:** —
`,
    `## Explored screens (auto)\n\nBase URL: ${cfg.baseURL} — explored ${new Date().toISOString()}\n\n` +
      screens.map((s) => `- [${s.name}](screens/${s.name}.md) — \`${s.route}\` — ${s.headings[0]?.text ?? s.title}`).join('\n'),
  );
  const wf = path.join(KB, 'workflows', '_TEMPLATE.md');
  if (!fs.existsSync(wf)) {
    writeFile(
      wf,
      `# Workflow: <name>

- **Goal:** <what the user achieves>
- **Screens involved:** [screen-a](../screens/screen-a.md) → [screen-b](../screens/screen-b.md)
- **Source:** <business doc / QA explanation / observed during exploration> (mark UNVERIFIED if inferred)

## Steps

1. <screen> — <action> — <expected visible result>

## Business rules

- <rule> (source: ...)

## Unknowns

- <anything that could not be verified>
`,
    );
  }
}

// ------------------------------------------------------------------ main
async function preflight() {
  for (const p of only ?? []) {
    if (/^[A-Za-z]:[\\/]|\\|Program Files/i.test(p)) {
      throw new Error(
        `--only value "${p}" looks like a Windows path: Git Bash rewrites arguments that start with "/".\n` +
          `  Use PowerShell/cmd, or prefix the command: MSYS_NO_PATHCONV=1 npm run explore -- --only /orders/5`,
      );
    }
  }
  try {
    await fetch(cfg.baseURL, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new Error(
      `Cannot reach ${cfg.baseURL}. Is the application running and BASE_URL correct?\n` +
        `  (Demo app: run "npm run demo:app" in another terminal — the explorer does not start it; only "npm test" does.)`,
    );
  }
}

async function main() {
  const started = Date.now();
  await preflight();
  const headed = flag('headed');
  const browser = await chromium.launch({ headless: !headed });
  const storageState = await authenticate(browser);
  const authCtx = await browser.newContext({ baseURL: cfg.baseURL, storageState });
  const publicCtx = await browser.newContext({ baseURL: cfg.baseURL });
  const max = cfg.maxPages ?? 30;
  const publicRoutes = new Set((cfg.publicPaths ?? []).map((p) => normalizeRoute(new URL(p, cfg.baseURL).pathname)));

  const screens: Screen[] = [];
  const visited = new Set<string>();
  const samePath = (a: string, b: string) => new URL(a, cfg.baseURL).pathname === new URL(b, cfg.baseURL).pathname;
  const variants = (cfg.variants ?? []).filter((v) => !only || only.some((o) => samePath(o, v.path)));
  const queue: string[] = only
    ? only.filter((o) => !variants.some((v) => samePath(o, v.path)))
    : [...(cfg.publicPaths ?? []), ...(cfg.startPaths ?? ['/'])];
  console.log(`Exploring ${cfg.baseURL} ${only ? `(only: ${only.join(', ')})` : `(max ${max} pages)`}`);

  while (queue.length && screens.length < max) {
    const p = queue.shift()!;
    const url = new URL(p, cfg.baseURL);
    const route = normalizeRoute(url.pathname);
    if (visited.has(route) || url.origin !== origin || isExcluded(url.pathname)) continue;
    visited.add(route);
    const isPublic = publicRoutes.has(route);
    console.log(`→ ${route}${isPublic ? ' (public)' : ''}`);
    const screen = await exploreRoute(isPublic ? publicCtx : authCtx, url.toString(), !isPublic);
    if (!screen) {
      // follow redirects (e.g. "/" → "/dashboard"), but a redirect to a public/login route means no session
      const to = redirects.get(url.toString());
      if (to) {
        const toRoute = normalizeRoute(new URL(to).pathname);
        if (!isPublic && publicRoutes.has(toRoute)) console.log(`  ⚠ redirected to ${toRoute}: the session is not valid or lacks permission`);
        else if (!visited.has(toRoute) && !isExcluded(toRoute)) queue.unshift(to);
      }
      continue;
    }
    screens.push(screen);
    // follow links using the concrete href so dynamic routes like /orders/:id get a real id
    if (!only) for (const o of screen.outgoing) if (!visited.has(o.route) && !isExcluded(o.route)) queue.push(o.href);
  }

  // Variants: the same route in another data-dependent state (e.g. a pending vs a completed order),
  // stored as separate screen files so one never overwrites the other.
  for (const v of variants) {
    const url = new URL(v.path, cfg.baseURL);
    const isPublic = publicRoutes.has(normalizeRoute(url.pathname));
    console.log(`→ ${url.pathname} (variant "${v.name}")`);
    const screen = await exploreRoute(isPublic ? publicCtx : authCtx, url.toString(), !isPublic, v);
    if (screen) screens.push(screen);
  }

  if (!screens.length) {
    await browser.close();
    throw new Error('Nothing was explored (all routes skipped/redirected/excluded). No knowledge files were changed.');
  }

  if (!flag('no-states')) {
    for (const def of cfg.states ?? []) {
      const route = normalizeRoute(new URL(def.path, cfg.baseURL).pathname);
      const screen =
        screens.find((s) => s.variant && samePath(s.url, def.path)) ?? screens.find((s) => !s.variant && s.route === route);
      if (!screen) continue;
      console.log(`  ◆ state ${screen.name}/${def.name}`);
      const st = await exploreState(publicRoutes.has(route) ? publicCtx : authCtx, screen, def);
      if (st.error) console.log(`    ⚠ ${st.error}`);
      screen.states.push(st);
    }
  }
  await browser.close();

  // ---- write knowledge base
  for (const s of screens) {
    const rawFile = path.join(KB, 'raw', `${s.name}.json`);
    if (fs.existsSync(rawFile)) {
      const prev = readJson<Screen>(rawFile);
      // --no-states: keep the previously captured states instead of silently dropping them
      if (flag('no-states') && prev.states?.length) {
        s.states = prev.states.map((st) => ({ ...st, carriedFrom: st.carriedFrom ?? prev.exploredAt }));
      }
      // Compare page elements + elements of states that were (re)captured successfully in both runs
      const fresh = (x: Screen) => new Set(x.states.filter((st) => !st.error && !st.carriedFrom).map((st) => st.name));
      const common = new Set([...fresh(s)].filter((n) => fresh(prev).has(n)));
      const keysOf = (x: Screen) => [
        ...x.elements.map(elKey),
        ...x.states.filter((st) => common.has(st.name)).flatMap((st) => st.newElements.map((e) => `[state ${st.name}] ${elKey(e)}`)),
      ];
      const prevKeys = new Set(keysOf(prev));
      const curKeys = new Set(keysOf(s));
      const fmt = (k: string) => k.split('|').map((x, i) => (i === 2 ? `\`${x}\`` : x)).join(' · ');
      s.changes = {
        previousAt: prev.exploredAt,
        added: [...curKeys].filter((k) => !prevKeys.has(k)).map(fmt),
        removed: [...prevKeys].filter((k) => !curKeys.has(k)).map(fmt),
      };
      if (s.changes.added.length || s.changes.removed.length) {
        console.log(`  Δ ${s.name}: +${s.changes.added.length} / -${s.changes.removed.length} elements vs ${prev.exploredAt}`);
      }
    }
    writeFile(rawFile, JSON.stringify(s, null, 2));
    mergeAuto(path.join(KB, 'screens', `${s.name}.md`), screenHeader(s), renderScreen(s));
  }
  // navigation + shared components reflect the full set of known screens
  const allScreens = fs.readdirSync(path.join(KB, 'raw')).filter((f) => f.endsWith('.json')).map((f) => readJson<Screen>(path.join(KB, 'raw', f)));
  mergeAuto(path.join(KB, 'navigation.md'), '# Navigation map\n\n## Curated notes\n\n- —', `## Screens and links (auto)\n\n${renderNavigation(allScreens)}`);
  mergeAuto(path.join(KB, 'components', 'shared-elements.md'), '# Shared UI elements\n\n## Curated notes\n\n- —', renderShared(allScreens));
  ensureTemplates(allScreens);

  const unresolved = screens.flatMap((s) => s.elements.filter((e) => !e.selector).map((e) => `${s.name}: ${typeOf(e)} "${e.name}"`));
  console.log(`\n✔ Explored ${screens.length} screen(s) in ${((Date.now() - started) / 1000).toFixed(1)}s → ${rel(KB)}/`);
  for (const s of screens) console.log(`  - ${s.name.padEnd(18)} ${s.route.padEnd(16)} ${s.elements.length} elements, ${s.tables.length} tables, ${s.states.length} states`);
  if (unresolved.length) console.log(`⚠ ${unresolved.length} element(s) without a unique selector:\n  ${unresolved.join('\n  ')}`);
}

main().catch((err) => {
  console.error('✖ Exploration failed:', err.message);
  process.exit(1);
});
