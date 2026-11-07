---
name: qa-autotest
description: Use when a QA user asks in general terms to set up, start, continue or check UI test automation in this project — applying it to a new website, "test tính năng X", "test lại sau khi deploy", "làm từ đầu tới cuối", "dự án đang tới đâu / còn thiếu gì" — or when it is unclear which of website-explorer, testcase-generator, playwright-runner or test-maintainer applies.
---

# QA Autotest — entry point

## Overview

One entry point for QA requests. It decides **where the project stands** (from `npm run status`, never from memory) and **which skill/tool runs next**. AI explores, generates and maintains; Playwright executes with no LLM. Never drive a browser click-by-click or send screenshots per step.

## Step 1 — always: `npm run status`

Read-only, ~5 s. Shows environment, target app (`DEMO MODE` = bundled demo), knowledge base, test cases per feature (automated / blocked / not automated), not-yet-imported Excel/CSV files, last run (partial or full) and a **NEXT STEP** list. Base every decision on it.

## Step 2 — route

| User intent / status signal | Action |
|---|---|
| A website of their own, while status shows `DEMO MODE` or demo files | **Onboarding** (below) |
| ✖ under ENVIRONMENT | run the fix command status prints |
| Excel/CSV of test cases given | copy into `testcases/<feature>/`, `npm run testcases:import -- <file> --feature <feature>` (not a generic spreadsheet skill), then **testcase-generator** |
| A feature whose screens are missing in KNOWLEDGE BASE | **website-explorer** for those routes only |
| A feature with "not automated" test cases | **testcase-generator** |
| "chạy", "regression", "smoke", "test lại", "dev mới deploy" | **playwright-runner** (filter with `--grep "@<feature>"`); if anything FAILS → **test-maintainer** |
| Last run has FAIL and the user asks why / to fix | **test-maintainer** |
| "đang tới đâu", "còn thiếu gì" | answer from the status output + `testcases/*/_automation-report.md` (+ `reports/bugs/`); change nothing — offer the NEXT STEP items (and a full `npm test` if the last run was partial) as proposals |

- **Feature names:** match the user's words to the feature folders and `# Feature:` titles listed by status. Two plausible matches → ask.
- **After a deployment:** run first. Do not re-explore up front — the failures tell test-maintainer which screens to re-explore, and the before/after diff is its evidence.
- **Target check:** if the user talks about their environment but `BASE_URL` points elsewhere (e.g. the demo), ask before running anything. If their application is not onboarded yet, its tests do not exist — offer **Onboarding**.
- **Login before exploring:** with SSO the saved session must exist before the first `npm run explore`.

## Onboarding a new application (once)

1. Ask in **one** message: test-environment URL (staging/test only), login type (test account / SSO / OTP / captcha), areas to exclude, whether tests may create or modify data there, where the test cases are.
2. Run `npm run project:init -- --base-url <url> [--sso] [--login-path <path>] --dry-run`, show the plan, and run it without `--dry-run` only after the user agrees. Tell them what it does:
   - archives the demo (app, knowledge, test cases, page objects, specs, test data, demo-only components, demo bug reports) to `examples/demo-shop/`;
   - keeps skills, scripts, reporter, generic components (`DataTable`, `ConfirmDialog`) and config;
   - writes a fresh `explore.config.json`, generic `auth.setup.ts` and fixtures;
   - in `.env` sets `BASE_URL` and `START_DEMO_APP=0`, blanks only the demo credentials;
   - deletes generated `reports/` and the demo login sessions in `.auth/`.
3. Login:
   - Test account: the user writes `QA_USERNAME` / `QA_PASSWORD` into `.env` themselves.
   - SSO / OTP / captcha: the user runs `npx playwright codegen <url> --save-storage=.auth/explorer.json` and logs in by hand. Never type SSO passwords or MFA codes yourself.
4. Record the answers from step 1 under *Curated notes* in `knowledge/application.md` (created by the first exploration): fill `**Test data policy:** yes|no (confirmed by <who>, <date>)` and list excluded areas under *Out of scope*.
5. **website-explorer** → test cases → **testcase-generator** → **playwright-runner**.

Tests log in through `playwright/tests/auth.setup.ts`, which reuses the `auth` of `explore.config.json` (scripted steps or saved session). If every test is BLOCKED, or the failure snapshot shows the login page, the saved session has probably expired → ask the user to repeat the codegen command; do not change tests.

## Stop and ask the user

- before `project:init` without `--dry-run`;
- before the first run of tests that create, change or delete data on a non-local environment, unless `knowledge/application.md` records that this is allowed;
- for NEEDS INFO / BLOCKED questions (testcase-generator) and behavior-change confirmations (test-maintainer).

## Reply to the user

Same language as the user. Contents, in this order: what was done → results per test case (PASS / FAIL / SKIPPED / BLOCKED, duration) → suspected application bugs → questions waiting for them → the next step.

## Common mistakes

| Mistake | Instead |
|---|---|
| Generating tests for a real site on top of demo knowledge/tests | `project:init` first |
| Re-exploring the whole site after every deployment | run tests; re-explore only the failing screens |
| Running against `localhost:4000` when the user meant their staging | check `BASE_URL` in status; ask |
| Answering "đang tới đâu" from memory of earlier sessions | `npm run status` |
| Treating a filtered run as the whole suite | status marks partial runs; say so |
