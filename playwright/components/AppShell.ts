import type { Locator, Page } from '@playwright/test';

/**
 * Top bar + main sidebar shared by every logged-in screen.
 * Source: knowledge/components/shared-elements.md
 */
export class AppShell {
  readonly nav: Locator;
  readonly currentUser: Locator;
  readonly logoutButton: Locator;

  constructor(private readonly page: Page) {
    this.nav = page.getByRole('navigation', { name: 'Menu chính' });
    this.currentUser = page.getByTestId('current-user');
    this.logoutButton = page.getByRole('button', { name: 'Đăng xuất' });
  }

  menuLink(name: 'Tổng quan' | 'Khách hàng' | 'Đơn hàng'): Locator {
    return this.nav.getByRole('link', { name, exact: true });
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }
}
