// Generated from testcases/authentication/login.md by the testcase-generator skill.
// Each test keeps its QA test case ID (TC-...) as title prefix and tag, for traceability.
import { test, expect, loggedOut } from '../../fixtures/test';
import { credentials } from '../../utils/env';

test.describe('Đăng nhập / Đăng xuất', { tag: '@authentication' }, () => {
  test.use(loggedOut); // every case here starts without a session and creates its own

  test('TC-AUTH-001 Đăng nhập thành công với tài khoản hợp lệ', { tag: ['@TC-AUTH-001', '@smoke'] }, async ({ page, loginPage, dashboardPage }) => {
    await test.step('1. Mở trang Đăng nhập', () => loginPage.goto());
    await test.step('2-3. Nhập tài khoản hợp lệ và nhấn "Đăng nhập"', () =>
      loginPage.login(credentials().username, credentials().password));
    await test.step('Expected: chuyển tới Tổng quan, hiển thị "Quản trị viên"', async () => {
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(dashboardPage.heading).toBeVisible();
      await expect(dashboardPage.shell.currentUser).toHaveText('Quản trị viên');
    });
  });

  test('TC-AUTH-002 Đăng nhập thất bại khi sai mật khẩu', { tag: ['@TC-AUTH-002'] }, async ({ page, loginPage }) => {
    await loginPage.goto();
    await test.step('Nhập tên đăng nhập hợp lệ và mật khẩu sai, nhấn "Đăng nhập"', () =>
      loginPage.login(credentials().username, 'sai-mat-khau'));
    await expect(loginPage.errorAlert).toHaveText('Tên đăng nhập hoặc mật khẩu không đúng');
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-AUTH-003 Bỏ trống tên đăng nhập và mật khẩu', { tag: ['@TC-AUTH-003', '@validation'] }, async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.submitButton.click();
    await expect(loginPage.message('Vui lòng nhập tên đăng nhập')).toBeVisible();
    await expect(loginPage.message('Vui lòng nhập mật khẩu')).toBeVisible();
  });

  test('TC-AUTH-004 Truy cập trang cần đăng nhập khi chưa đăng nhập', { tag: ['@TC-AUTH-004'] }, async ({ page, loginPage, customersPage }) => {
    await test.step('1. Mở trực tiếp /customers → bị chuyển về Đăng nhập', async () => {
      await page.goto('/customers');
      await expect(page).toHaveURL(/\/login/);
    });
    await test.step('2. Đăng nhập → quay lại trang Khách hàng', async () => {
      await loginPage.login(credentials().username, credentials().password);
      await expect(page).toHaveURL(/\/customers$/);
      await expect(customersPage.heading).toBeVisible();
    });
  });

  test('TC-AUTH-005 Đăng xuất', { tag: ['@TC-AUTH-005'] }, async ({ page, loginPage, dashboardPage }) => {
    // Precondition "Đã đăng nhập": log in with a private session so other parallel tests keep theirs.
    await loginPage.goto();
    await loginPage.login(credentials().username, credentials().password);
    await expect(page).toHaveURL(/\/dashboard$/);

    await test.step('1. Nhấn "Đăng xuất" → quay về Đăng nhập', async () => {
      await dashboardPage.shell.logout();
      await expect(page).toHaveURL(/\/login/);
    });
    await test.step('2. Mở lại /dashboard → vẫn bị chuyển về Đăng nhập', async () => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/);
      await expect(loginPage.submitButton).toBeVisible();
    });
  });

  test.fixme(
    'TC-AUTH-006 Đăng nhập bằng tài khoản Google (SSO)',
    {
      tag: ['@TC-AUTH-006'],
      annotation: {
        type: 'blocked',
        description:
          'No "Đăng nhập với Google" control exists on the login screen (knowledge/screens/login.md, explored 2026-11-07). Needs QA confirmation and an SSO test account.',
      },
    },
    async () => {},
  );
});
