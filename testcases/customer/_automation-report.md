# Automation report — customer

Source: `testcases/customer/customer-management.md` · Spec: `playwright/tests/customer/customer-management.spec.ts`

| TC | Status | Notes |
|---|---|---|
| TC-CUS-001 | AUTOMATED | unique name/email per run (`uniq()` fixture) |
| TC-CUS-002 | AUTOMATED | messages from state `customers/add-customer-empty-submit` |
| TC-CUS-003 | AUTOMATED | |
| TC-CUS-004 | AUTOMATED | uses seed customer an.nguyen@example.com (precondition in test case) |
| TC-CUS-005 | AUTOMATED | data-driven: 3 invalid + 1 valid value from `test-data/customer.json` → 4 tests, one TC |
| TC-CUS-006 | AUTOMATED | precondition customer created by the test itself |
| TC-CUS-007 | AUTOMATED | |
| TC-CUS-008 | AUTOMATED | |
| TC-CUS-009 | AUTOMATED | asserts the filtered list with `expect.poll` (rows rendered before the search cannot pass) |
| TC-CUS-010 | AUTOMATED | |
| TC-CUS-011 | AUTOMATED | page count asserted as "Trang x / N" because parallel tests add customers |
| TC-CUS-012 | AUTOMATED | 2 tests (100 / 101 characters) |
