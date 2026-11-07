# Automation report — authentication

Source: `testcases/authentication/login.md` · Spec: `playwright/tests/authentication/login.spec.ts`

| TC | Status | Notes |
|---|---|---|
| TC-AUTH-001 | AUTOMATED | login.spec.ts — user name asserted via `getByTestId('current-user')` (knowledge/screens/dashboard.md) |
| TC-AUTH-002 | AUTOMATED | error alert text from state `login/wrong-password` |
| TC-AUTH-003 | AUTOMATED | messages captured in state `login/empty-submit` |
| TC-AUTH-004 | AUTOMATED | relies on redirect `/login?next=...` observed during exploration |
| TC-AUTH-005 | AUTOMATED | logs in with a private session so parallel tests keep the shared one |
| TC-AUTH-006 | BLOCKED | No "Đăng nhập với Google" control on the login screen (knowledge/screens/login.md). Needs QA confirmation that SSO exists in this environment + an SSO test account. Kept as `test.fixme` placeholder. |

## Questions for QA

- TC-AUTH-006: is Google SSO planned for this environment? If yes, which test account and which identity-provider test tenant can be used?
