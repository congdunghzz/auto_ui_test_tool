import type { Locator, Page } from '@playwright/test';

/** Screen: login (/login). Source: knowledge/screens/login.md */
export class LoginPage {
  readonly username: Locator;
  readonly password: Locator;
  readonly rememberMe: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;

  constructor(private readonly page: Page) {
    this.username = page.getByRole('textbox', { name: 'Tên đăng nhập' });
    this.password = page.getByLabel('Mật khẩu');
    this.rememberMe = page.getByRole('checkbox', { name: 'Ghi nhớ đăng nhập' });
    this.submitButton = page.getByRole('button', { name: 'Đăng nhập' });
    this.errorAlert = page.getByRole('alert');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(username: string, password: string): Promise<void> {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.submitButton.click();
  }

  /** Inline validation message under a field (texts captured in state "empty-submit"). */
  message(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }
}
