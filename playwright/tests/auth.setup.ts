import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { credentials } from '../utils/env';

const AUTH_FILE = '.auth/user.json';

// Logs in once and stores the session; all tests in the "chromium" project reuse it.
setup('authenticate', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.login(credentials().username, credentials().password);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.context().storageState({ path: AUTH_FILE });
});
