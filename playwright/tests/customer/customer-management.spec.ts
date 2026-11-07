// Generated from testcases/customer/customer-management.md by the testcase-generator skill.
// Each test keeps its QA test case ID (TC-...) as title prefix and tag, for traceability.
import { test, expect } from '../../fixtures/test';
import { newCustomer, textOfLength } from '../../fixtures/data';
import data from '../../../test-data/customer.json';

test.describe('Quản lý khách hàng', { tag: '@customer' }, () => {
  test.beforeEach(async ({ customersPage }) => {
    await customersPage.goto();
  });

  test('TC-CUS-001 Thêm khách hàng với dữ liệu hợp lệ', { tag: ['@TC-CUS-001', '@smoke', '@crud'] }, async ({ customersPage, uniq }) => {
    const c = newCustomer(uniq(), { phone: '0911222333', vip: true });
    await test.step('2. Nhấn "Thêm khách hàng"', () => customersPage.openAddDialog());
    await test.step('3. Nhập Họ tên, Email, Số điện thoại; tick VIP', () => customersPage.form.fill(c));
    await test.step('4. Nhấn "Lưu" → thông báo thành công', async () => {
      await customersPage.form.save();
      await customersPage.toast.expectMessage('Đã thêm khách hàng thành công');
    });
    await test.step('5. Tìm theo email → đúng 1 dòng với dữ liệu vừa nhập', async () => {
      await customersPage.search(c.email);
      await expect(customersPage.table.rows).toHaveCount(1);
      const row = customersPage.row(c.email);
      await expect(await customersPage.table.cell(row, 'Họ tên')).toHaveText(c.name);
      await expect(await customersPage.table.cell(row, 'Email')).toHaveText(c.email);
      await expect(await customersPage.table.cell(row, 'Trạng thái')).toHaveText('Hoạt động');
      await expect(await customersPage.table.cell(row, 'VIP')).toHaveText('Có');
    });
  });

  test('TC-CUS-002 Bỏ trống trường bắt buộc khi thêm khách hàng', { tag: ['@TC-CUS-002', '@validation'] }, async ({ customersPage }) => {
    await customersPage.openAddDialog();
    await customersPage.form.save();
    await expect(customersPage.form.error('Họ tên là bắt buộc')).toBeVisible();
    await expect(customersPage.form.error('Email là bắt buộc')).toBeVisible();
    await expect(customersPage.form.root).toBeVisible();
  });

  test('TC-CUS-003 Email sai định dạng', { tag: ['@TC-CUS-003', '@validation'] }, async ({ customersPage }) => {
    await customersPage.openAddDialog();
    await customersPage.form.fill({ name: 'Khách test', email: data.invalidEmail });
    await customersPage.form.save();
    await expect(customersPage.form.error('Email không hợp lệ')).toBeVisible();
  });

  test('TC-CUS-004 Email đã tồn tại', { tag: ['@TC-CUS-004', '@validation'] }, async ({ customersPage }) => {
    await customersPage.openAddDialog();
    await customersPage.form.fill({ name: 'Khách trùng email', email: data.existingEmail });
    await customersPage.form.save();
    await expect(customersPage.form.error('Email đã tồn tại')).toBeVisible();
  });

  for (const phone of data.phoneBoundary.invalid) {
    test(`TC-CUS-005 Biên số điện thoại — ${phone.value} (${phone.note}) bị từ chối`, { tag: ['@TC-CUS-005', '@validation', '@boundary'] }, async ({ customersPage, uniq }) => {
      await customersPage.openAddDialog();
      await customersPage.form.fill(newCustomer(uniq(), { phone: phone.value }));
      await customersPage.form.save();
      await expect(customersPage.form.error('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0')).toBeVisible();
    });
  }
  for (const phone of data.phoneBoundary.valid) {
    test(`TC-CUS-005 Biên số điện thoại — ${phone.value} (${phone.note}) hợp lệ`, { tag: ['@TC-CUS-005', '@validation', '@boundary'] }, async ({ customersPage, uniq }) => {
      await customersPage.openAddDialog();
      await customersPage.form.fill(newCustomer(uniq(), { phone: phone.value }));
      await customersPage.form.save();
      await customersPage.toast.expectMessage('Đã thêm khách hàng thành công');
    });
  }

  test('TC-CUS-006 Sửa thông tin khách hàng', { tag: ['@TC-CUS-006', '@crud'] }, async ({ customersPage, uniq }) => {
    const c = newCustomer(uniq());
    await test.step('Precondition: tạo khách hàng của test', () => customersPage.createCustomer(c));
    const newName = `${c.name} (đã sửa)`;
    await test.step('1-2. Tìm theo email, nhấn "Sửa"', async () => {
      await customersPage.search(c.email);
      await customersPage.clickEdit(c.email);
      await expect(customersPage.form.title).toHaveText('Cập nhật khách hàng');
    });
    await test.step('3-4. Đổi Họ tên, Trạng thái và lưu', async () => {
      await customersPage.form.fill({ name: newName, status: 'Ngừng hoạt động' });
      await customersPage.form.save();
      await customersPage.toast.expectMessage('Đã cập nhật khách hàng thành công');
    });
    const row = customersPage.row(c.email);
    await expect(await customersPage.table.cell(row, 'Họ tên')).toHaveText(newName);
    await expect(await customersPage.table.cell(row, 'Trạng thái')).toHaveText('Ngừng hoạt động');
  });

  test('TC-CUS-007 Xóa khách hàng', { tag: ['@TC-CUS-007', '@crud'] }, async ({ customersPage, uniq }) => {
    const c = newCustomer(uniq());
    await customersPage.createCustomer(c);
    await test.step('1-2. Tìm theo email, nhấn "Xóa" → hộp thoại xác nhận', async () => {
      await customersPage.search(c.email);
      await customersPage.clickDelete(c.email);
      await expect(customersPage.deleteDialog.root).toContainText(`Bạn có chắc muốn xóa khách hàng ${c.name}?`);
    });
    await test.step('3. Xác nhận "Xóa"', async () => {
      await customersPage.deleteDialog.confirm();
      await customersPage.toast.expectMessage(`Đã xóa khách hàng ${c.name}`);
    });
    await test.step('Tìm lại theo email → "Không tìm thấy khách hàng nào"', async () => {
      await customersPage.goto();
      await customersPage.search(c.email);
      await expect(customersPage.emptyState).toBeVisible();
      await expect(customersPage.table.rows).toHaveCount(0);
    });
  });

  test('TC-CUS-008 Hủy thao tác xóa khách hàng', { tag: ['@TC-CUS-008', '@crud'] }, async ({ customersPage, uniq }) => {
    const c = newCustomer(uniq());
    await customersPage.createCustomer(c);
    await customersPage.search(c.email);
    await customersPage.clickDelete(c.email);
    await customersPage.deleteDialog.cancel();
    await expect(customersPage.deleteDialog.root).toBeHidden();
    await expect(customersPage.row(c.email)).toBeVisible();
  });

  test('TC-CUS-009 Tìm kiếm không phân biệt hoa thường', { tag: ['@TC-CUS-009', '@search'] }, async ({ customersPage }) => {
    await customersPage.search(data.searchKeywordLowercase);
    // Poll until the table shows the *filtered* result, so rows rendered before the search cannot pass the test.
    await expect
      .poll(() => customersPage.table.columnTexts('Họ tên'), { message: `kết quả tìm "${data.searchKeywordLowercase}"` })
      .toEqual([data.searchExpectedName]);
  });

  test('TC-CUS-010 Lọc theo trạng thái Ngừng hoạt động', { tag: ['@TC-CUS-010', '@search'] }, async ({ customersPage }) => {
    await customersPage.filterByStatus('Ngừng hoạt động');
    await expect
      .poll(async () => {
        const statuses = await customersPage.table.columnTexts('Trạng thái');
        return statuses.length > 0 && statuses.every((s) => s === 'Ngừng hoạt động');
      }, { message: 'mọi dòng có trạng thái "Ngừng hoạt động" và có ít nhất 1 dòng' })
      .toBe(true);
  });

  test('TC-CUS-011 Phân trang danh sách khách hàng', { tag: ['@TC-CUS-011', '@pagination'] }, async ({ customersPage }) => {
    const { pagination, table } = customersPage;
    await test.step('Ban đầu: 5 dòng, "Trang 1 / N", "Trang trước" bị vô hiệu hóa', async () => {
      await expect(table.rows).toHaveCount(5);
      await expect(pagination.info).toHaveText(/^Trang 1 \/ \d+$/);
      await expect(pagination.previous).toBeDisabled();
    });
    await test.step('2. Nhấn "Trang sau" → "Trang 2 / N", "Trang trước" được bật', async () => {
      await pagination.next.click();
      await expect(pagination.info).toHaveText(/^Trang 2 \/ \d+$/);
      await expect(pagination.previous).toBeEnabled();
    });
    await test.step('3. Nhấn "Trang trước" → quay lại "Trang 1 / N"', async () => {
      await pagination.previous.click();
      await expect(pagination.info).toHaveText(/^Trang 1 \/ \d+$/);
    });
  });

  test('TC-CUS-012 Biên độ dài Họ tên — 100 ký tự hợp lệ', { tag: ['@TC-CUS-012', '@validation', '@boundary'] }, async ({ customersPage, uniq }) => {
    const id = uniq();
    await customersPage.openAddDialog();
    await customersPage.form.fill(newCustomer(id, { name: textOfLength(`QA ${id} `, data.nameLength.max) }));
    await customersPage.form.save();
    await customersPage.toast.expectMessage('Đã thêm khách hàng thành công');
  });

  test('TC-CUS-012 Biên độ dài Họ tên — 101 ký tự bị từ chối', { tag: ['@TC-CUS-012', '@validation', '@boundary'] }, async ({ customersPage, uniq }) => {
    const id = uniq();
    await customersPage.openAddDialog();
    await customersPage.form.fill(newCustomer(id, { name: textOfLength(`QA ${id} `, data.nameLength.overMax) }));
    await customersPage.form.save();
    await expect(customersPage.form.error('Họ tên tối đa 100 ký tự')).toBeVisible();
  });
});
