import type { Locator, Page } from '@playwright/test';

export type CustomerInput = {
  name?: string;
  email?: string;
  phone?: string;
  status?: 'Hoạt động' | 'Ngừng hoạt động';
  gender?: 'Nam' | 'Nữ' | 'Khác';
  vip?: boolean;
  note?: string;
};

/**
 * Add / edit customer modal on the customers screen.
 * Source: knowledge/screens/customers.md, states "add-customer-modal" and "add-customer-empty-submit".
 * The title differs by mode ("Thêm khách hàng" / "Cập nhật khách hàng"), so the dialog is located
 * by role only — it is the only role=dialog that can be open at a time.
 */
export class CustomerFormDialog {
  readonly root: Locator;
  readonly title: Locator;
  readonly name: Locator;
  readonly email: Locator;
  readonly phone: Locator;
  readonly status: Locator;
  readonly vip: Locator;
  readonly note: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.root = page.getByRole('dialog');
    this.title = this.root.getByRole('heading');
    this.name = this.root.getByRole('textbox', { name: 'Họ tên *' });
    this.email = this.root.getByRole('textbox', { name: 'Email *' });
    this.phone = this.root.getByRole('textbox', { name: 'Số điện thoại' });
    this.status = this.root.getByRole('combobox', { name: 'Trạng thái khách hàng' });
    this.vip = this.root.getByRole('checkbox', { name: 'Khách hàng VIP' });
    this.note = this.root.getByRole('textbox', { name: 'Ghi chú' });
    this.saveButton = this.root.getByRole('button', { name: 'Lưu' });
    this.cancelButton = this.root.getByRole('button', { name: 'Hủy' });
  }

  gender(label: NonNullable<CustomerInput['gender']>): Locator {
    return this.root.getByRole('radio', { name: label });
  }

  async fill(data: CustomerInput): Promise<void> {
    if (data.name !== undefined) await this.name.fill(data.name);
    if (data.email !== undefined) await this.email.fill(data.email);
    if (data.phone !== undefined) await this.phone.fill(data.phone);
    if (data.status) await this.status.selectOption({ label: data.status });
    if (data.gender) await this.gender(data.gender).check();
    if (data.vip !== undefined) await this.vip.setChecked(data.vip);
    if (data.note !== undefined) await this.note.fill(data.note);
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  /** Validation message inside the dialog (e.g. "Họ tên là bắt buộc"). */
  error(text: string): Locator {
    return this.root.getByText(text, { exact: true });
  }
}
