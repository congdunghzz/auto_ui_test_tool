import type { Locator, Page, Response } from '@playwright/test';
import { AppShell } from '../components/AppShell';
import { DataTable } from '../components/DataTable';
import { Toast } from '../components/Toast';

export type OrderStatusTab = 'Tất cả' | 'Chờ xử lý' | 'Hoàn thành' | 'Đã hủy';

/** Screen: orders (/orders). Source: knowledge/screens/orders.md */
export class OrdersPage {
  readonly shell: AppShell;
  readonly heading: Locator;
  readonly createLink: Locator;
  readonly table: DataTable;
  readonly toast: Toast;

  constructor(private readonly page: Page) {
    this.shell = new AppShell(page);
    this.heading = page.getByRole('heading', { name: 'Đơn hàng', level: 1 });
    this.createLink = page.getByRole('link', { name: 'Tạo đơn hàng' });
    this.table = new DataTable(page, 'Danh sách đơn hàng');
    this.toast = new Toast(page);
  }

  /** Tab of tablist "Lọc theo trạng thái". */
  tab(name: OrderStatusTab): Locator {
    return this.page.getByRole('tab', { name });
  }

  /** The list has no loading indicator; it loads via GET /api/orders?status (knowledge: network calls). */
  private waitForList(): Promise<Response> {
    return this.page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/orders');
  }

  async goto(): Promise<void> {
    const loaded = this.waitForList();
    await this.page.goto('/orders');
    await loaded;
  }

  async selectTab(name: OrderStatusTab): Promise<void> {
    const loaded = this.waitForList();
    await this.tab(name).click();
    await loaded;
  }

  /** Per-row "Mã đơn" link (e.g. "DH0006", href /orders/:id). */
  orderLink(code: string): Locator {
    return this.table.root.getByRole('link', { name: code, exact: true });
  }

  /** Data row of one order, located by its code (the `has` locator must be relative to the row). */
  row(code: string): Locator {
    return this.table.rows.filter({ has: this.page.getByRole('link', { name: code, exact: true }) });
  }

  async openOrder(code: string): Promise<void> {
    await this.orderLink(code).click();
  }
}
