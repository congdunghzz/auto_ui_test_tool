import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { AppShell } from '../components/AppShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataTable } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Toast } from '../components/Toast';
import { CustomerFormDialog, type CustomerInput } from './CustomerFormDialog';

/** Screen: customers (/customers). Source: knowledge/screens/customers.md */
export class CustomersPage {
  readonly shell: AppShell;
  readonly heading: Locator;
  readonly addButton: Locator;
  readonly searchBox: Locator;
  readonly statusFilter: Locator;
  readonly table: DataTable;
  readonly emptyState: Locator;
  readonly pagination: Pagination;
  readonly form: CustomerFormDialog;
  readonly deleteDialog: ConfirmDialog;
  readonly toast: Toast;

  constructor(private readonly page: Page) {
    this.shell = new AppShell(page);
    this.heading = page.getByRole('heading', { name: 'Khách hàng', level: 1 });
    this.addButton = page.getByTestId('btn-add-customer');
    this.searchBox = page.getByRole('searchbox', { name: 'Tìm kiếm khách hàng' });
    this.statusFilter = page.getByRole('combobox', { name: 'Trạng thái', exact: true });
    this.table = new DataTable(page, 'Danh sách khách hàng');
    this.emptyState = page.getByText('Không tìm thấy khách hàng nào');
    this.pagination = new Pagination(page);
    this.form = new CustomerFormDialog(page);
    this.deleteDialog = new ConfirmDialog(page, 'Xác nhận xóa', 'Xóa');
    this.toast = new Toast(page);
  }

  /** The list has no loading indicator; it reloads via GET /api/customers (knowledge: network calls). */
  private waitForList(): Promise<Response> {
    return this.page.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/customers');
  }

  async goto(): Promise<void> {
    const loaded = this.waitForList();
    await this.page.goto('/customers');
    await loaded;
  }

  async search(keyword: string): Promise<void> {
    const loaded = this.waitForList();
    await this.searchBox.fill(keyword);
    await loaded;
  }

  async filterByStatus(label: 'Tất cả' | 'Hoạt động' | 'Ngừng hoạt động'): Promise<void> {
    const loaded = this.waitForList();
    await this.statusFilter.selectOption({ label });
    await loaded;
  }

  row(text: string): Locator {
    return this.table.row(text);
  }

  async openAddDialog(): Promise<void> {
    await this.addButton.click();
    await expect(this.form.root).toBeVisible();
  }

  /** Create a customer through the UI and wait for the success toast. */
  async createCustomer(data: CustomerInput): Promise<void> {
    await this.openAddDialog();
    await this.form.fill(data);
    await this.form.save();
    await this.toast.expectMessage('Đã thêm khách hàng thành công');
  }

  async clickEdit(rowText: string): Promise<void> {
    await this.row(rowText).getByRole('button', { name: 'Sửa' }).click();
    await expect(this.form.root).toBeVisible();
  }

  async clickDelete(rowText: string): Promise<void> {
    await this.row(rowText).getByRole('button', { name: 'Xóa' }).click();
    await expect(this.deleteDialog.root).toBeVisible();
  }
}
