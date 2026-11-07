import type { Locator, Page } from '@playwright/test';
import { AppShell } from '../components/AppShell';

/** Screen: dashboard (/dashboard). Source: knowledge/screens/dashboard.md */
export class DashboardPage {
  readonly shell: AppShell;
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.shell = new AppShell(page);
    this.heading = page.getByRole('heading', { name: 'Tổng quan', level: 1 });
  }

  async goto(): Promise<void> {
    await this.page.goto('/dashboard');
  }
}
