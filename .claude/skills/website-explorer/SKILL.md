---
name: website-explorer
description: Use when the UI Knowledge Base in knowledge/ must be built or refreshed for this project — a website to learn after onboarding, screens to document, a new screen, a selector that cannot be found, or specific screens that test-maintainer or testcase-generator need re-explored.
---

# Website Explorer

Builds `knowledge/` — the single source of truth about the UI that the other skills read instead of
re-browsing the site. Exploration is done by `scripts/explore.ts` (Playwright, **no LLM per action**).
Your job as the agent is to configure it, run it, check its output, and curate the results **in batch**.

## Ground rules

- Only explore environments the user is authorized to test (staging/test/local). Never production unless the user explicitly says so.
- **No destructive actions.** The crawler only follows links. Configured `states` may only open dialogs, switch tabs, or submit *invalid* forms that the app rejects. Never confirm deletes, never submit valid create/update forms, never log out in the shared session. Keep `exclude` patterns for logout/delete/remove routes.
- Do **not** drive the browser click-by-click with screenshots or a browser MCP. If the crawler cannot reach something, add a `startPaths` entry or a `states` entry and re-run the script.
- **Never invent** elements, selectors, business rules or expected behavior. Everything in the auto-generated block is verified by the script. Anything you add in the curated sections must cite its source (business doc, QA explanation, observed state) or be marked `UNVERIFIED`/`UNKNOWN`.
- Credentials live only in `.env` (git-ignored). Never write them into knowledge files.

## Inputs to collect from the user

1. Base URL of the test environment.
2. How to log in: test username/password **or** "SSO/OTP/captcha" (then use a saved session, see below).
3. Optional: scope (routes to include/exclude), business/workflow documents.

## Prerequisites and gotchas

- The application must already be running and reachable at `BASE_URL`. The explorer does **not** start the bundled demo app (only `npm test` does): run `npm run demo:app` in another terminal for the demo.
- **Git Bash rewrites arguments that start with `/`** (`/orders/5` → `C:/Program Files/Git/orders/5`). Run the explorer from PowerShell/cmd, or prefix: `MSYS_NO_PATHCONV=1 npm run explore -- --only /orders/5`. The script refuses such paths.
- Explore on clean, representative data and preferably **before** test runs: option lists, table rows and sample values are snapshots of the data at that moment, not specifications (test data such as "QA Khách …" may appear in them).
- Dynamic routes (`/orders/:id`) are explored once per pattern. Make that deterministic by putting a concrete URL in `startPaths` (e.g. `/orders/1`), and capture other data-dependent looks of the same route as `variants` (e.g. a completed order) — each variant gets its own file `screens/<name>.md` and never overwrites the base screen.

## Workflow

1. **Configure the environment** in `.env` (copy from `.env.example`):
   `BASE_URL=...`, `QA_USERNAME=...`, `QA_PASSWORD=...`, and `START_DEMO_APP=0` for a real app.
2. **Bootstrap login selectors** (first time only): set `"auth": null`-equivalent by removing `auth.steps`, put the login route in `publicPaths`, run `npm run explore -- --only /login --no-states`, then read `knowledge/screens/login.md` and write `auth.steps` in `explore.config.json` using the verified names (see *Config reference*).
   - SSO / OTP / captcha: ask the user to log in once manually:
     `npx playwright codegen <BASE_URL> --save-storage=.auth/explorer.json` and set `"auth": { "storageState": ".auth/explorer.json" }`.
3. **Crawl**: `npm run explore` (add `--headed` to watch). Read the console summary: screens found, redirects/skips, `⚠` unresolved selectors.
4. **Capture hidden UI** (modals, validation messages, tabs): add non-destructive `states` to `explore.config.json`, then re-run only those routes: `npm run explore -- --only /customers,/orders/new`.
5. **Review** each `knowledge/screens/<screen>.md`:
   - `⚠ UNRESOLVED` → no unique selector; note it in *Known limitations* and suggest a `data-testid` to the dev team.
   - `⚠ CSS fallback` → works but brittle; same suggestion.
   - "stricter selector" notes → use the selector exactly as written (a looser one is ambiguous in some state).
6. **Curate in one batch** (this is where AI adds value — read the generated files, not the live site):
   - Fill the *Curated notes* section at the top of each screen file (purpose, business rules, dependencies, test data needs, open questions). Everything outside the `AUTO-GENERATED` block survives re-exploration.
   - Fill `knowledge/application.md` curated notes.
   - Write `knowledge/workflows/<name>.md` from `_TEMPLATE.md` for multi-screen business flows the user describes.
   - Turn useful rows of `knowledge/components/shared-elements.md` into component notes if needed.
7. **Report** to the user: screens explored, states captured, unresolved/brittle selectors, unknowns that need their input.

## Re-exploration (keep it targeted)

Only re-explore when: a new screen is introduced, a selector cannot be found, a UI change is suspected, or QA asks for a refresh.

```bash
npm run explore -- --only /customers            # one screen (+ its states)
npm run explore -- --only /customers --no-states
```

The screen file then shows **"Changes since previous exploration"** (➕ added / ➖ removed elements and selectors). The previous raw data is in `knowledge/raw/<screen>.json`.

## Output layout

```
knowledge/
  application.md              # app overview (curated) + list of screens (auto)
  navigation.md               # screens, routes, links between them + mermaid graph (auto)
  screens/<screen>.md         # curated notes + AUTO block (elements, forms, tables, dialogs, tabs, nav,
                              #   live regions, test-id elements, network calls, links, states, aria snapshot)
  components/shared-elements.md
  workflows/*.md              # curated business flows
  screenshots/*.png           # one per screen and per state (for humans; do not send to an LLM routinely)
  raw/*.json                  # machine data, used for change detection
  maintenance-log.md          # written by the test-maintainer skill
```

Selectors are listed in Playwright syntax with priority **data-testid → role+name → label → placeholder → CSS**, and every one was verified to match exactly one element. Prefixes: `page.` (global), `page.getByRole('dialog', …).` (scoped to a container), `row.` (inside one table row — locate the row first).

## Config reference (`explore.config.json`)

| Key | Meaning |
|---|---|
| `baseURL` | usually `"${BASE_URL}"` — `${VAR}` reads from `.env` |
| `testIdAttribute` | default `data-testid`; must match `use.testIdAttribute` in `playwright.config.ts` |
| `auth.steps` / `auth.loginPath` | scripted login, session saved to `auth.saveStorageStateTo` |
| `auth.storageState` | use a saved session instead (SSO/OTP) |
| `publicPaths` | routes explored without login (e.g. `/login`) |
| `startPaths` | where the logged-in crawl starts (concrete URLs make dynamic routes deterministic) |
| `variants[]` | `{ path, name, description }` — same route in another data state, saved as `screens/<name>.md` |
| `exclude` | regexes of paths never visited (logout, delete, api…) |
| `maxPages` | crawl limit |
| `states[]` | `{ path, name, description, steps[] }` — actions that reveal hidden UI |

Step actions: `goto`, `click`, `fill`, `select` (by option label), `check`, `uncheck`, `press`, `waitForURL`, `waitFor`, `wait` (ms).
Targets: `{ "testId" }`, `{ "role", "name", "exact"? }`, `{ "label" }`, `{ "placeholder" }`, `{ "text" }`, `{ "css" }`, plus optional `"nth"` and `"within": { …target }` for scoping (e.g. a button inside a dialog or table).
