---
name: testcase-generator
description: Use when QA test cases (Markdown, Excel .xlsx or CSV under testcases/) must be turned into automated Playwright tests in this project, or when automated tests must be added or updated for specific test case IDs.
---

# Test Case Analyzer & Generator

Turns QA test cases into deterministic Playwright tests. **You write code once; Playwright runs it with no LLM.**
Read files (test cases, knowledge, existing Page Objects) — do not browse the site click-by-click.

## Ground rules

- **Selectors come only from `knowledge/screens/*.md` or existing Page Objects.** Copy them as written (including `exact: true` and container scoping). You may make a selector *narrower* (scope it into a row/dialog/table, add `exact: true`), never looser. Never guess a selector.
- **Expected results come only from the test case.** Use the exact texts/values written by QA. Never invent business rules, messages or data. If an expected result is vague ("hiển thị đúng"), make it concrete only from the test case/test data; otherwise mark the case NEEDS INFO.
- **Missing element → explore first, then stop.** Decision order:
  1. The element/state should exist on a known route → re-explore that route (`npm run explore -- --only <route>`). Hidden UI (modal, tab, validation) → add a non-destructive `states` entry to `explore.config.json`. UI that depends on data (pending vs completed order) → add a `variants` entry. You may edit `explore.config.json` for this.
  2. Still not found → the case is **BLOCKED** (feature/control absent) or **NEEDS INFO** (ambiguous), with the reason. Do not improvise.
- **Messages the KB cannot contain are asserted from the test case text.** Success messages (the explorer never submits valid forms) and validation messages without a captured state: assert the exact text from the test case, scoped to a documented container (`toast` test id, the dialog, the form).
- **Placeholders and partial texts:** a pattern like `DHxxxx` may become a regex only if the format is visible in the KB (cite it in a comment); otherwise NEEDS INFO. A partial expected text ("hiển thị 'Đã tạo đơn hàng'") is matched as a prefix/substring, not exactly — note it in the report.
- **Cross-references:** a test case may reuse a definition that another test case of the same feature file states explicitly (e.g. what "tạo đơn thành công" looks like). Cite it in a comment and in the report; otherwise NEEDS INFO.
- Assertions must actually prove the expected result (e.g. a list *after* filtering, not rows that were already there). Never weaken an assertion to make a test pass.
- Every test keeps its QA test case ID (title prefix **and** tag `@TC-…`).

## Workflow

1. **Get the test cases into Markdown.**
   - Excel/CSV: `npm run testcases:import -- <file> --feature <feature>` (headers in English or Vietnamese; one-step-per-row layouts are merged). Fix the warnings it prints with the user.
   - Canonical format (see `testcases/customer/customer-management.md`): `## TC-ID: title`, bullet metadata (`**Type:**`, `**Priority:**`, `**Tags:**`, `**Preconditions:**`, `**Test data:**`), then `**Steps**` (numbered) and `**Expected**` (bullets).
2. **Load only what you need**: the feature's test cases; `knowledge/application.md`, `knowledge/navigation.md`, the screen files the steps touch (incl. their *States* section for modals and validation texts, *Other elements with a test id* for assertion targets, *Network calls* for synchronization, and `<screen>--<variant>.md` files for data-dependent variants); existing `playwright/pages`, `playwright/components`, `playwright/fixtures/test.ts`.
   If a screen file lacks one of those sections it was produced by an older explorer version → re-explore that route before mapping.
3. **Map and classify every test case** — build this table before writing code:

   | TC | Step / expected | Screen | Element / assertion (from KB) | Status |
   |---|---|---|---|---|

   Status per TC: **READY**, **NEEDS INFO** (ambiguous step, missing test data, vague expected result), **BLOCKED** (element/feature not in KB, needs external system: SSO, email/OTP, file content, payment…), **NOT AUTOMATABLE** (subjective/visual judgement).
4. **Page Objects & components** (reuse first, extend second, create last):
   - One class per screen: `playwright/pages/<Name>Page.ts`, named in PascalCase after the screen's purpose (`orders-new` → `NewOrderPage`, `orders-detail` → `OrderDetailPage`); modals that belong to one screen: `<Name>Dialog.ts`. Reusable widgets: `playwright/components/` (`AppShell`, `Toast`, `ConfirmDialog`, `DataTable`, `Pagination` already exist).
   - Locators as `readonly` fields assigned in the constructor; methods for user actions (`goto`, `search`, `createX`…). No assertions about business results inside Page Objects (only "ready" waits like a dialog becoming visible).
   - Header comment: `/** Screen: <name> (<route>). Source: knowledge/screens/<name>.md */`.
   - Register every new Page Object as a fixture in `playwright/fixtures/test.ts`.
5. **Test data**: static values in `test-data/<feature>.json` (with a `_source` field naming the test case file); unique values via the `uniq()` fixture and factories in `playwright/fixtures/data.ts` — tests run in parallel and share the environment. When QA's wording differs from the UI label (QA "Chuột không dây M2" vs option "Chuột không dây M2 — 320.000đ" in the KB), store both and select by the UI label.
6. **Specs**: `playwright/tests/<feature>/<testcase-file-name>.spec.ts`, one `test.describe('<feature title>', { tag: '@<feature>' }, …)`. Feature title = the human title in the test case file's `# Feature:` heading; if it only has the folder name, use that. Write TC IDs in comments without a leading `@` (quoted `'@TC-…'` strings are counted as tags).

   ```ts
   // Generated from testcases/<feature>/<file>.md by the testcase-generator skill.
   import { test, expect } from '../../fixtures/test';

   test('TC-XXX-001 <title from test case>', { tag: ['@TC-XXX-001', '@smoke'] }, async ({ somePage, uniq }) => {
     await test.step('1. <QA step text>', () => somePage.goto());
     await test.step('Expected: <QA expected text>', async () => {
       await expect(somePage.toast.root).toHaveText('<exact text from test case>');
     });
   });
   ```

   - Tags: the TC ID + the test case's `Tags` (`@smoke`, `@validation`…). The feature tag comes from `describe`.
   - Map QA steps to `test.step('<n>. <step text>')` so the HTML report reads like the test case.
   - Data-driven/boundary cases: loop over values from `test-data`, one test per value, all with the same `@TC-…` tag (the reporter aggregates them).
   - Flows that must start logged out or that log out: `test.use(loggedOut)` and log in inside the test (never log out the shared session).
   - BLOCKED / NEEDS INFO cases stay traceable as placeholders:
     ```ts
     test.fixme('TC-XXX-009 <title>', { tag: ['@TC-XXX-009'], annotation: { type: 'blocked', description: '<why + what is needed>' } }, async () => {});
     ```
7. **Synchronization** (no `waitForTimeout`):
   - Prefer web-first assertions (`toBeVisible`, `toHaveText`, `toHaveCount`, `toHaveURL`).
   - When the UI has no loading indicator, wait for the request listed under *Network calls* in the screen file (`page.waitForResponse(...)` set up **before** the action).
   - When asserting a list after search/filter, use `expect.poll(...)` on the whole column (or `toHaveCount`) so rows rendered before the filter cannot satisfy the assertion.
8. **Verify** (mandatory before writing the report or reporting done):
   1. `npm run typecheck`
   2. `npx playwright test --grep "@<feature>"`
   3. For each failure decide: *generated code is wrong* (fix it) vs *the application does not meet the expected result* (leave the test failing; it is a suspected bug — hand it to the **test-maintainer** skill, which writes `reports/bugs/<TC>.md`). Never adjust the assertion.
   4. `npx playwright test --grep "@<feature>" --repeat-each=2` to catch flakiness.
   5. `npm run coverage -- <feature>` — placeholders show as BLOCKED, real tests as AUTOMATED.
9. **Automation report**: write `testcases/<feature>/_automation-report.md` (after verification, so it contains the real results):

   ```markdown
   # Automation report — <feature>
   | TC | Status | Notes |
   |---|---|---|
   | TC-XXX-001 | AUTOMATED | playwright/tests/<feature>/<file>.spec.ts |
   | TC-XXX-009 | BLOCKED | <reason / what is needed> |
   ```
   Status values: AUTOMATED, BLOCKED, NEEDS INFO, NOT AUTOMATABLE. Add the screen → Page Object mapping, every interpretation you made (regex for a placeholder, prefix match, cross-reference), and open questions for QA at the end. Findings about the UI (e.g. data-dependent controls) go into the *Curated notes* of the screen file.
10. **Report** to the user: the mapping/status table, files created/changed, test results, suspected application bugs, questions.

## Project conventions (quick reference)

- Base URL and credentials: `.env` → `playwright.config.ts` / `playwright/utils/env.ts` (`credentials()`).
- Auth: `playwright/tests/auth.setup.ts` saves `.auth/user.json`; all tests start logged in unless `test.use(loggedOut)`.
- Reports: `reports/summary.md` (per test case), `reports/html`, `reports/results.json`.
