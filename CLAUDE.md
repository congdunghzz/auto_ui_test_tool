# QA Automation project

AI explores the UI and writes Playwright tests **once**; Playwright runs them **without an LLM**.
Never automate tests by driving a browser click-by-click with screenshots — generate scripts instead.

## Skills (in `.claude/skills/`)

| Skill | Use it for |
|---|---|
| `qa-autotest` | **entry point** for general QA requests: onboarding a new app, "test feature X", "test after deploy", project status — routes to the skills below |
| `website-explorer` | learn a site / refresh screens → `knowledge/` |
| `testcase-generator` | QA test cases (`testcases/`) → Page Objects + specs (`playwright/`) |
| `playwright-runner` | run tests, report PASS/FAIL/SKIPPED/BLOCKED per test case |
| `test-maintainer` | investigate failures, repair tests after UI changes, report app bugs |

## Pipeline

`npm run status` → (new app: `npm run project:init`) → `npm run explore` → `knowledge/` → (QA writes `testcases/`) → generate `playwright/` → `npm test` → `reports/summary.md` → `npm run analyze` → maintain.

## Non-negotiables

- Start from `npm run status`, not from memory of earlier sessions.
- Selectors only from `knowledge/screens/*.md` or existing Page Objects; expected results only from `testcases/`.
- Never invent elements, rules or messages; mark unknowns `UNKNOWN` / `UNVERIFIED`.
- Never change an expected result or weaken/skip an assertion to make a test pass; application bugs stay red and get a report in `reports/bugs/`.
- Every test carries its QA ID: title prefix and tag `@TC-…`.
- No destructive actions during exploration; credentials only in `.env`; never type SSO passwords or MFA codes (the user saves a session with `npx playwright codegen <url> --save-storage=.auth/explorer.json`).
- Verify before claiming done: `npm run typecheck` and run the affected tests.

## Commands

```
npm run status                         npm run project:init -- --base-url <url> [--sso] --dry-run
npm run explore [-- --only /route]     npm run testcases:import -- file.xlsx --feature x
npm test [-- --grep @TC-ID|@feature]   npm run analyze   npm run coverage   npm run report
```

Git Bash rewrites arguments starting with `/` — run `--only /route` from PowerShell or prefix `MSYS_NO_PATHCONV=1`.
