import type { Locator, Page } from '@playwright/test';
import { AppShell } from '../components/AppShell';
import { Toast } from '../components/Toast';

/**
 * Screen: orders-detail (/orders/:id). Source: knowledge/screens/orders-detail.md
 * Content depends on the order status: "Đánh dấu hoàn thành" exists on a "Chờ xử lý" order (explored /orders/6)
 * but not on a "Hoàn thành" order (explored /orders/5).
 */
export class OrderDetailPage {
  readonly shell: AppShell;
  /** h1 "Đơn hàng DHxxxx". */
  readonly heading: Locator;
  readonly customer: Locator;
  readonly product: Locator;
  readonly quantity: Locator;
  readonly payment: Locator;
  readonly status: Locator;
  readonly total: Locator;
  readonly backLink: Locator;
  readonly completeButton: Locator;
  readonly toast: Toast;

  constructor(private readonly page: Page) {
    this.shell = new AppShell(page);
    this.heading = page.getByRole('heading', { level: 1 });
    this.customer = page.getByTestId('order-customer');
    this.product = page.getByTestId('order-product');
    this.quantity = page.getByTestId('order-quantity');
    this.payment = page.getByTestId('order-payment');
    this.status = page.getByTestId('order-status');
    this.total = page.getByTestId('order-detail-total');
    this.backLink = page.getByRole('link', { name: 'Quay lại danh sách' });
    this.completeButton = page.getByRole('button', { name: 'Đánh dấu hoàn thành' });
    this.toast = new Toast(page);
  }

  /** Order code shown in the h1 ("Đơn hàng DH0006" → "DH0006"). */
  async orderCode(): Promise<string> {
    const text = (await this.heading.textContent()) ?? '';
    const code = text.match(/DH\d+/)?.[0];
    if (!code) throw new Error(`No order code in heading "${text}"`);
    return code;
  }

  async markCompleted(): Promise<void> {
    await this.completeButton.click();
  }
}
