import type { Locator, Page } from '@playwright/test';

/** Pager: navigation "Phân trang" with "Trang trước" / "Trang sau" and a "Trang x / y" label. */
export class Pagination {
  readonly root: Locator;
  readonly previous: Locator;
  readonly next: Locator;
  readonly info: Locator;

  constructor(page: Page) {
    this.root = page.getByRole('navigation', { name: 'Phân trang' });
    this.previous = this.root.getByRole('button', { name: 'Trang trước' });
    this.next = this.root.getByRole('button', { name: 'Trang sau' });
    this.info = page.getByTestId('page-info');
  }
}
