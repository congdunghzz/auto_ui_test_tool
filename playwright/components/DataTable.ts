import type { Locator, Page } from '@playwright/test';

/** Accessible HTML table helper: rows, row lookup by text, column values by header name. */
export class DataTable {
  readonly root: Locator;
  readonly rows: Locator;
  readonly headers: Locator;

  constructor(page: Page, name: string) {
    this.root = page.getByRole('table', { name });
    this.rows = this.root.locator('tbody tr');
    this.headers = this.root.locator('thead th');
  }

  /** Data row containing the given text (use a unique value such as an email or a code). */
  row(text: string | RegExp): Locator {
    return this.rows.filter({ hasText: text });
  }

  async columnIndex(header: string): Promise<number> {
    const names = (await this.headers.allTextContents()).map((h) => h.trim());
    const i = names.indexOf(header);
    if (i < 0) throw new Error(`Column "${header}" not found. Columns: ${names.join(', ')}`);
    return i;
  }

  /** Cell of a row under a header, e.g. cell(row, 'Trạng thái'). */
  async cell(row: Locator, header: string): Promise<Locator> {
    return row.locator('td').nth(await this.columnIndex(header));
  }

  /** Current texts of one column for all visible rows. */
  async columnTexts(header: string): Promise<string[]> {
    const i = await this.columnIndex(header);
    return (await this.rows.locator(`td:nth-child(${i + 1})`).allTextContents()).map((t) => t.trim());
  }
}
