import type { Locator, Page } from '@playwright/test';

/** Confirmation modal (role=alertdialog) with a confirm and a "Hủy" button. */
export class ConfirmDialog {
  readonly root: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page, title: string, confirmLabel: string) {
    this.root = page.getByRole('alertdialog', { name: title });
    this.confirmButton = this.root.getByRole('button', { name: confirmLabel, exact: true });
    this.cancelButton = this.root.getByRole('button', { name: 'Hủy', exact: true });
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
