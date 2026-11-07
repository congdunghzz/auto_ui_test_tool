# Maintenance log

Every change the **test-maintainer** skill makes to Page Objects, specs, test data or the knowledge base is
recorded here (newest first). Application bugs found are recorded too — with the test left failing.

| Date | Test case(s) | Classification | Evidence | Change made | Approved by |
|---|---|---|---|---|---|
| 2026-11-07 | TC-CUS-001, 006, 007, 008, 009 | DEMO RESET | The rows below were produced by a validation run against the demo app's simulated release (`DEMO_UI_VERSION=2`). Afterwards the demo was switched back to v1 so the scenario can be replayed (README "Thử kịch bản bảo trì"); `/customers` re-explored on v1 | `CustomersPage.searchBox` reverted to `{ name: 'Tìm kiếm khách hàng' }` | n/a – demo maintenance |
| 2026-11-07 | TC-CUS-009 | APPLICATION BUG | Re-run after the selector fix: table empty, "Không tìm thấy khách hàng nào" (`reports/bugs/TC-CUS-009-evidence/error-context.md`); trace: `GET /api/customers?q=nguyễn+văn+an` → `total: 0`; read-only API check: "Nguyễn Văn An" → 1, "nguyễn văn an"/"NGUYỄN VĂN AN" → 0 (search is case-sensitive); test data NFC-normalized; no KB/test-case note of an intended change | none – bug reported (`reports/bugs/TC-CUS-009.md`); test stays red | n/a |
| 2026-11-07 | TC-CUS-009 | SELECTOR CHANGE | Same evidence as TC-CUS-001 (failed in `CustomersPage.search` at the old searchbox name before reaching its assertion) | Same Page Object fix as TC-CUS-001 | n/a – technical fix |
| 2026-11-07 | TC-CUS-008 | SELECTOR CHANGE | Same evidence as TC-CUS-001 (`waitForResponse` timeout was a follow-on of the failed `searchBox.fill`) | Same Page Object fix as TC-CUS-001; re-run PASS | n/a – technical fix |
| 2026-11-07 | TC-CUS-007 | SELECTOR CHANGE | Same evidence as TC-CUS-001 | Same Page Object fix as TC-CUS-001; re-run PASS | n/a – technical fix |
| 2026-11-07 | TC-CUS-006 | SELECTOR CHANGE | Same evidence as TC-CUS-001 | Same Page Object fix as TC-CUS-001; re-run PASS | n/a – technical fix |
| 2026-11-07 | TC-CUS-001 | SELECTOR CHANGE | `reports/failures.md` #1: `getByRole('searchbox', { name: 'Tìm kiếm khách hàng' })` not found; snapshot shows `searchbox "Tìm khách hàng"`; `knowledge/screens/customers.md` → "Changes since previous exploration (2026-11-07T11:57:53.827Z)": ➖ searchbox "Tìm kiếm khách hàng" / ➕ searchbox "Tìm khách hàng" (same type=search, same `GET /api/customers` call) | `playwright/pages/CustomersPage.ts`: `searchBox` → `page.getByRole('searchbox', { name: 'Tìm khách hàng' })` (KB re-explored with `npm run explore -- --only /customers`); re-run PASS | n/a – technical fix |
