---
name: test-maintainer
description: Use when Playwright tests in this project failed, when the user asks why tests fail or to fix them, or when the application under test received a new release / UI change and the suite must be brought up to date.
---

# Test Maintenance & Failure Analyzer

Goal: keep tests truthful. A test that fails because the **application is wrong must stay failing**.
You may repair *how* a test interacts with the UI; you may not change *what* it expects without confirmation.

## Hard rules

- Never edit an expected result, test data that encodes a business rule, or an assertion's meaning to make a test pass.
- Never hide a failure with `test.skip`, `test.fixme`, `test.fail`, `try/catch`, extra retries, longer timeouts, or a looser matcher (`toHaveText` → `toContainText`, exact → regex) unless the evidence shows the original was technically wrong.
- Changes to business assertions require explicit confirmation from the user/QA, and the test case in `testcases/` is updated **first**.
- Fix at the lowest shared level: selectors live in Page Objects/components, not in specs.
- Never create or modify application data except through what existing tests already do.

## Prerequisites

- The app must be running at `BASE_URL` for re-exploration (`npm run demo:app` for the demo).
- Git Bash rewrites arguments starting with `/`: run `npm run explore -- --only /route` from PowerShell, or prefix `MSYS_NO_PATHCONV=1`.

## Workflow

1. **Digest**: `npm run analyze` → read `reports/failures.md` (you may glance at `reports/summary.md` first; do not read `reports/results.json`).
2. **Preserve evidence before any re-run** — every Playwright run wipes `reports/artifacts/`. For each failure you may report as a bug, copy its screenshot, `trace.zip` and `error-context.md` to `reports/bugs/<TC-ID>-evidence/`.
3. **Group failures by probable root cause** (same screen, same locator in the error). One re-exploration per screen serves the whole group. If the first error is a follow-on (e.g. a `waitForResponse` timeout), the cause is in the step before it.
4. **Collect evidence, cheapest first**:
   1. Error, signals and page snapshot in the digest.
   2. The failure screenshot (open the PNG) only if layout matters.
   3. Re-explore the affected routes **with states**: `npm run explore -- --only <route>` → read "Changes since previous exploration" (page elements and `[state …]` elements) **and** the States sections (texts/messages). After a deployment this outranks the digest's "locator is documented in the KB" signal, which only says the KB was right *before* the release.
   4. Read-only probes are allowed to test a hypothesis with other inputs: a Playwright `request` GET with `.auth/user.json`, or a throwaway script in your scratch directory (never under `playwright/tests/`). No probe may create or change data.
   5. Re-run a single test: `npx playwright test --grep "@TC-…"` (`--headed` / `--trace on` if needed).
5. **Classify** (the digest's category is only a hint — it names the candidate classes):

   | Class | Typical evidence | Action |
   |---|---|---|
   | SELECTOR CHANGE | locator not found / strict-mode violation; re-exploration shows the same control with a new name/test id/role | Update the Page Object/component locator from the new KB entry. |
   | NAVIGATION CHANGE | `toHaveURL` fails; route/link changed in `knowledge/navigation.md` | Update navigation methods. |
   | TIMING / SYNC | flaky, passes on retry, stale rows, action before data loaded | Proper wait (web-first assertion, `waitForResponse` from the KB network calls, `expect.poll`); never `waitForTimeout`. |
   | TEST CODE BUG | wrong scope/fixture, tests interfering (shared data, logout) | Fix the code. |
   | INVALID TEST DATA | data missing / not unique / violates a documented rule | Fix `test-data/` or factories only if the expected result is unaffected; otherwise ask. |
   | BEHAVIOR / VALIDATION CHANGE | element present, value/message differs, **and** a source says it is intended: release notes or changelog from the user, an updated test case, KB curated notes | **Ask** the user/QA. After confirmation: update `testcases/…md`, then the assertion. |
   | APPLICATION BUG | app contradicts the test case and no source above says the change is intended | **Do not modify the test.** Write a bug report (below). If you are unsure, still treat it as a bug "needing QA triage". |
   | ENVIRONMENT | connection refused, 5xx, expired saved session, browser launch | Report; re-run when fixed. Do not change tests. |

   "Ask" pauses only that test case — continue with the others.
6. **Apply** only the actions allowed for the class. Keep diffs minimal. Run `npm run typecheck` after code changes.
7. **Re-run and re-classify**: re-run the affected test cases. A fix can unmask a second cause in the same test (e.g. a selector fix reveals an application bug) — classify again until every failing test case has its final cause.
8. **Drift check**: after re-exploring, compare the Page Objects of those screens with the new KB entries. Update locators that no longer match the KB even if their tests still pass (e.g. a substring match that now hits "Lưu thông tin" instead of "Lưu"); log them as SELECTOR CHANGE (preventive).
9. **Final run**: `npx playwright test --grep "@<feature>"` for each affected feature, then a full `npm test` so `reports/summary.md` describes the whole suite again.
10. **Log** in `knowledge/maintenance-log.md` (newest first): one row per test case **and class** —
    `| date | TC IDs | class | evidence (file/section) | change made, or "none – bug reported" | approved by: user/QA name, "n/a – technical fix", or "pending QA triage" |`.
    Log changes to Page Objects, specs, test data and test cases; mention explorer runs in the evidence column only.
11. **Bug reports** (`reports/bugs/<TC-ID>.md`), the test stays red:

    ```markdown
    # <TC-ID>: <one-line summary of the wrong behavior>
    - Severity (suggested, QA decides): <critical|major|minor>
    - Regression: <yes / no / unknown> — <evidence, e.g. passed in the run of <date>>
    - Environment: <BASE_URL>, <date>, app version/build: <value or "unknown — ask the team">
    ## Steps (from testcases/<file>.md)
    ## Expected (verbatim from the test case)
    ## Actual (from the snapshot / probe)
    ## Evidence (reports/bugs/<TC-ID>-evidence/…)
    ```
12. **Report** to the user: per failing test case → class, evidence, change made (or why not), re-run result; bugs filed; items waiting for confirmation or QA triage.
