import { expect, type Locator, type Page } from '@playwright/test';

/** Notification area (role=status, aria-live=polite, data-testid="toast"). Auto-hides after a few seconds. */
export class Toast {
  readonly root: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId('toast');
  }

  async expectMessage(text: string | RegExp): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.root).toHaveText(text);
  }
}
