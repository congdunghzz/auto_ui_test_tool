import type { Locator, Page, Response } from '@playwright/test';
import { AppShell } from '../components/AppShell';
import { Toast } from '../components/Toast';

export type PaymentMethod = 'Tiền mặt' | 'Chuyển khoản';

export type OrderInput = {
  /** Option label of "Khách hàng *" (the customer's name). */
  customer?: string;
  /** Full option label of "Sản phẩm *" as listed in the KB, e.g. "Chuột không dây M2 — 320.000đ". */
  productOption?: string;
  quantity?: number | string;
  payment?: PaymentMethod;
  expressShipping?: boolean;
  note?: string;
};

/** Screen: orders-new (/orders/new). Source: knowledge/screens/orders-new.md */
export class NewOrderPage {
  readonly shell: AppShell;
  readonly heading: Locator;
  readonly customer: Locator;
  readonly product: Locator;
  readonly quantity: Locator;
  readonly expressShipping: Locator;
  readonly note: Locator;
  readonly backLink: Locator;
  readonly submitButton: Locator;
  /** "Tổng tiền" value (testid order-total, aria-live=polite). */
  readonly total: Locator;
  readonly toast: Toast;

  constructor(private readonly page: Page) {
    this.shell = new AppShell(page);
    this.heading = page.getByRole('heading', { name: 'Tạo đơn hàng', level: 1 });
    this.customer = page.getByRole('combobox', { name: 'Khách hàng *' });
    this.product = page.getByRole('combobox', { name: 'Sản phẩm *' });
    this.quantity = page.getByRole('spinbutton', { name: 'Số lượng *' });
    this.expressShipping = page.getByRole('checkbox', { name: 'Giao hàng nhanh (+30.000đ)' });
    this.note = page.getByRole('textbox', { name: 'Ghi chú đơn hàng' });
    this.backLink = page.getByRole('link', { name: 'Quay lại' });
    this.submitButton = page.getByRole('button', { name: 'Tạo đơn' });
    this.total = page.getByTestId('order-total');
    this.toast = new Toast(page);
  }

  /** Radio of the "Phương thức thanh toán" group. */
  payment(label: PaymentMethod): Locator {
    return this.page.getByRole('radio', { name: label });
  }

  /** The form has no loading indicator; options come from GET /api/products and GET /api/customers (knowledge: network calls on load). */
  private waitForApi(pathname: string): Promise<Response> {
    return this.page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === pathname);
  }

  async goto(): Promise<void> {
    const products = this.waitForApi('/api/products');
    const customers = this.waitForApi('/api/customers');
    await this.page.goto('/orders/new');
    await Promise.all([products, customers]);
  }

  async fill(data: OrderInput): Promise<void> {
    if (data.customer !== undefined) await this.customer.selectOption({ label: data.customer });
    if (data.productOption !== undefined) await this.product.selectOption({ label: data.productOption });
    if (data.quantity !== undefined) await this.quantity.fill(String(data.quantity));
    if (data.payment) await this.payment(data.payment).check();
    if (data.expressShipping !== undefined) await this.expressShipping.setChecked(data.expressShipping);
    if (data.note !== undefined) await this.note.fill(data.note);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /** Validation message on the form (e.g. "Vui lòng chọn khách hàng", captured in state "empty-submit"). */
  message(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }
}
