---
name: playwright-runner
description: Use when the user asks to run, execute or re-run this project's automated UI tests — the whole suite, a feature, specific test case IDs, or a tag such as smoke/regression.
---

# Playwright Test Runner

Execution is **pure Playwright**: one command, no LLM involvement per click, no screenshots sent anywhere.
Your job: pick the right command, run it, read the generated summary, report it. Do not edit tests here.

## Commands

| Goal | Command |
|---|---|
| Whole suite | `npm test` |
| One test case | `npm test -- --grep "@TC-CUS-001"` |
| Several test cases | `--grep` takes a regex: see the example below the table |
| One feature | `npm test -- --grep "@customer"` |
| By tag | `npm test -- --grep "@smoke"`; exclude: `--grep-invert "@slow"` |
| One spec file | `npm test -- playwright/tests/customer` |
| Parallelism | `npm test -- --workers=4` (or `WORKERS=4` in `.env`) |
| Watch it run | `npm run test:headed` / `npm run test:ui` |
| Retries | `RETRIES=1` in `.env` (flaky tests then show as PASS + "flaky") |
| Other environment | set `BASE_URL` (and `START_DEMO_APP=0`) in `.env` |
| Open HTML report | `npm run report` |

Several test cases at once (regex alternation, works in bash and PowerShell):

```bash
npm test -- --grep "@TC-CUS-001|@TC-CUS-007"
```

Long suites: run in the background and wait for completion instead of polling.

## What happens on a run

- `setup` project logs in once (`playwright/tests/auth.setup.ts`) and stores `.auth/user.json`; tests reuse it. If setup fails, every dependent test is reported **BLOCKED**.
- Tests run fully parallel; each test creates its own unique data.
- On failure Playwright keeps a screenshot, a trace and `error-context.md` (page snapshot) in `reports/artifacts/`.
- Reporters: console list, `reports/html/`, `reports/results.json`, and `reports/summary.md` + `summary.json` (per QA test case).

Status mapping (by `@TC-…` tag, several tests of one TC are aggregated — worst wins):

| Status | Meaning |
|---|---|
| PASS | all tests of the TC passed (flaky = passed on retry, flagged) |
| FAIL | at least one test failed or timed out |
| BLOCKED | not executed (setup failed / interrupted) or `test.fixme` / annotation `blocked` |
| SKIPPED | `test.skip` |
| not automated | TC exists in `testcases/` but no test carries its tag |

## Report to the user

Read `reports/summary.md` (not the raw JSON) and reply with:

1. Totals: PASS / FAIL / SKIPPED / BLOCKED, not automated, duration.
2. Each FAIL and BLOCKED test case with its one-line reason.
3. Where the evidence is (`reports/summary.md`, `npm run report`).
4. If anything failed: run `npm run analyze` and hand over to the **test-maintainer** skill (or offer to).

Never re-run until green, never mark tests skipped to get a clean report.
