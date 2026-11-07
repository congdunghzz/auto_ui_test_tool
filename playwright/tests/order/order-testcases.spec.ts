// Generated from testcases/order/order-testcases.md by the testcase-generator skill.
// Each test keeps its QA test case ID (TC-...) as title prefix and tag, for traceability.
import { test, expect } from '../../fixtures/test';
import { newCustomer } from '../../fixtures/data';
import type { PaymentMethod } from '../../pages/NewOrderPage';
import data from '../../../test-data/order.json';

/** "Đã tạo đơn hàng DHxxxx" — DHxxxx is the order code (codes look like DH0006, knowledge/screens/orders.md). */
const ORDER_CREATED = new RegExp(`^${data.messages.orderCreatedPrefix} DH\\d{4}$`);
/** Route /orders/:id (knowledge/navigation.md); ids are numeric (/orders/6). */
const DETAIL_URL = /\/orders\/\d+$/;

test.describe('Đơn hàng', { tag: '@order' }, () => {
  test('TC-ORD-001 Tạo đơn hàng hợp lệ', { tag: ['@TC-ORD-001', '@smoke'] }, async ({ newOrderPage, orderDetailPage, page }) => {
    const o = data.validOrder;
    await test.step('1. Mở màn hình Tạo đơn hàng', () => newOrderPage.goto());
    await test.step('2. Chọn khách hàng, sản phẩm, nhập số lượng, chọn phương thức thanh toán', () =>
      newOrderPage.fill({ customer: o.customer, productOption: o.productOption, quantity: o.quantity, payment: o.payment as PaymentMethod }),
    );
    await test.step('3. Nhấn "Tạo đơn"', () => newOrderPage.submit());
    await test.step('Expected: Chuyển sang trang chi tiết đơn hàng', async () => {
      await expect(page).toHaveURL(DETAIL_URL);
      await expect(orderDetailPage.heading).toHaveText(/^Đơn hàng DH\d{4}$/);
    });
    await test.step('Expected: Hiển thị thông báo "Đã tạo đơn hàng DHxxxx"', () => orderDetailPage.toast.expectMessage(ORDER_CREATED));
    await test.step('Expected: Chi tiết hiển thị đúng khách hàng, sản phẩm, số lượng 3, thanh toán Chuyển khoản, trạng thái "Chờ xử lý"', async () => {
      await expect(orderDetailPage.customer).toHaveText(o.customer);
      await expect(orderDetailPage.product).toHaveText(o.product);
      await expect(orderDetailPage.quantity).toHaveText(String(o.quantity));
      await expect(orderDetailPage.payment).toHaveText(o.payment);
      await expect(orderDetailPage.status).toHaveText(o.expectedStatus);
    });
  });

  test('TC-ORD-002 Không chọn khách hàng', { tag: ['@TC-ORD-002', '@validation'] }, async ({ newOrderPage, page }) => {
    await test.step('1. Mở màn hình Tạo đơn hàng', () => newOrderPage.goto());
    // Nothing to do: the combobox keeps its default option "-- Chọn khách hàng --" (knowledge/screens/orders-new.md).
    await test.step('2. Không chọn khách hàng', async () => {});
    await test.step('3. Nhấn "Tạo đơn"', () => newOrderPage.submit());
    await test.step('Expected: Hiển thị "Vui lòng chọn khách hàng"', () =>
      expect(newOrderPage.message(data.messages.customerRequired)).toBeVisible(),
    );
    await test.step('Expected: Vẫn ở trang Tạo đơn hàng', async () => {
      await expect(page).toHaveURL(/\/orders\/new$/);
      await expect(newOrderPage.heading).toBeVisible();
    });
  });

  for (const quantity of data.quantityBoundary.invalid) {
    test(`TC-ORD-003 Kiểm tra biên số lượng — ${quantity} bị từ chối`, { tag: ['@TC-ORD-003', '@validation', '@boundary'] }, async ({ newOrderPage }) => {
      await test.step(`1. Mở màn hình Tạo đơn hàng và chọn khách hàng ${data.quantityBoundary.customer}`, async () => {
        await newOrderPage.goto();
        await newOrderPage.fill({ customer: data.quantityBoundary.customer });
      });
      await test.step(`2. Nhập số lượng ${quantity}`, () => newOrderPage.fill({ quantity }));
      await test.step('3. Nhấn "Tạo đơn"', () => newOrderPage.submit());
      await test.step(`Expected: Giá trị ${quantity}: hiển thị "${data.messages.quantityRange}"`, () =>
        expect(newOrderPage.message(data.messages.quantityRange)).toBeVisible(),
      );
    });
  }
  for (const quantity of data.quantityBoundary.valid) {
    test(`TC-ORD-003 Kiểm tra biên số lượng — ${quantity} hợp lệ`, { tag: ['@TC-ORD-003', '@validation', '@boundary'] }, async ({ newOrderPage, orderDetailPage, page }) => {
      await test.step(`1. Mở màn hình Tạo đơn hàng và chọn khách hàng ${data.quantityBoundary.customer}`, async () => {
        await newOrderPage.goto();
        await newOrderPage.fill({ customer: data.quantityBoundary.customer });
      });
      await test.step(`2. Nhập số lượng ${quantity}`, () => newOrderPage.fill({ quantity }));
      await test.step('3. Nhấn "Tạo đơn"', () => newOrderPage.submit());
      await test.step(`Expected: Giá trị ${quantity}: tạo đơn thành công, hiển thị "${data.messages.orderCreatedPrefix}"`, async () => {
        // "tạo đơn thành công" = moves to the order detail page (success behaviour defined in TC-ORD-001).
        await expect(page).toHaveURL(DETAIL_URL);
        await orderDetailPage.toast.expectMessage(new RegExp(`^${data.messages.orderCreatedPrefix}`));
      });
    });
  }

  test('TC-ORD-004 Tính tổng tiền có giao hàng nhanh', { tag: ['@TC-ORD-004'] }, async ({ newOrderPage }) => {
    const d = data.expressShipping;
    await test.step('1. Mở màn hình Tạo đơn hàng', () => newOrderPage.goto());
    await test.step(`2. Chọn sản phẩm ${d.product}, nhập số lượng ${d.quantity}`, () =>
      newOrderPage.fill({ productOption: d.productOption, quantity: d.quantity }),
    );
    await test.step('3. Tick "Giao hàng nhanh"', () => newOrderPage.fill({ expressShipping: true }));
    await test.step(`Expected: Tổng tiền hiển thị "${d.expectedTotal}"`, () => expect(newOrderPage.total).toHaveText(d.expectedTotal));
  });

  test('TC-ORD-005 Lọc đơn hàng theo tab Hoàn thành', { tag: ['@TC-ORD-005', '@search'] }, async ({ ordersPage }) => {
    await test.step('1. Mở màn hình Đơn hàng', () => ordersPage.goto());
    await test.step('2. Chọn tab "Hoàn thành"', () => ordersPage.selectTab('Hoàn thành'));
    await test.step('Expected: Tab "Hoàn thành" được chọn', () =>
      expect(ordersPage.tab('Hoàn thành')).toHaveAttribute('aria-selected', 'true'),
    );
    await test.step('Expected: Mọi dòng trong bảng có trạng thái "Hoàn thành"', async () => {
      // Poll the whole column so rows rendered before the filter cannot satisfy the assertion.
      await expect
        .poll(async () => {
          const statuses = await ordersPage.table.columnTexts('Trạng thái');
          return statuses.length > 0 && statuses.every((s) => s === data.statuses.done);
        }, { message: 'mọi dòng có trạng thái "Hoàn thành" và có ít nhất 1 dòng (dữ liệu mẫu)' })
        .toBe(true);
    });
  });

  test(
    'TC-ORD-006 Luồng đầy đủ: tạo khách hàng mới rồi tạo và hoàn thành đơn hàng',
    { tag: ['@TC-ORD-006', '@smoke', '@e2e'] },
    async ({ customersPage, newOrderPage, ordersPage, orderDetailPage, uniq }) => {
      const customer = newCustomer(uniq());
      let code = '';
      await test.step('1. Thêm khách hàng mới ở màn hình Khách hàng', async () => {
        await customersPage.goto();
        await customersPage.createCustomer(customer);
      });
      await test.step('2. Tạo đơn hàng cho khách hàng đó', async () => {
        await newOrderPage.goto();
        await newOrderPage.fill({ customer: customer.name, productOption: data.workflow.productOption, quantity: data.workflow.quantity });
        await newOrderPage.submit();
        await expect(orderDetailPage.heading).toHaveText(/^Đơn hàng DH\d{4}$/);
        code = await orderDetailPage.orderCode();
      });
      await test.step('3. Mở màn hình Đơn hàng, tab "Chờ xử lý"', async () => {
        await ordersPage.goto();
        await ordersPage.selectTab('Chờ xử lý');
      });
      await test.step('Expected bước 3: đơn vừa tạo có trong tab "Chờ xử lý" với tên khách hàng mới', async () => {
        await expect(ordersPage.tab('Chờ xử lý')).toHaveAttribute('aria-selected', 'true');
        // The new order is also in "Tất cả": first prove the list is the filtered one.
        await expect
          .poll(async () => {
            const statuses = await ordersPage.table.columnTexts('Trạng thái');
            return statuses.length > 0 && statuses.every((s) => s === data.statuses.pending);
          }, { message: 'bảng đã lọc theo "Chờ xử lý"' })
          .toBe(true);
        const row = ordersPage.row(code);
        await expect(row).toHaveCount(1);
        await expect(await ordersPage.table.cell(row, 'Khách hàng')).toHaveText(customer.name);
      });
      await test.step('4. Mở chi tiết đơn vừa tạo, nhấn "Đánh dấu hoàn thành"', async () => {
        await ordersPage.openOrder(code);
        await expect(orderDetailPage.heading).toHaveText(`Đơn hàng ${code}`);
        await orderDetailPage.markCompleted();
      });
      await test.step('Expected bước 4: trạng thái đơn chuyển thành "Hoàn thành", hiển thị "Đã cập nhật trạng thái đơn hàng"', async () => {
        await orderDetailPage.toast.expectMessage(data.messages.statusUpdated);
        await expect(orderDetailPage.status).toHaveText(data.statuses.done);
      });
    },
  );

  test.fixme(
    'TC-ORD-007 In hóa đơn PDF',
    {
      tag: ['@TC-ORD-007'],
      annotation: {
        type: 'blocked',
        description:
          'No "In hóa đơn" control on the detail of a "Hoàn thành" order (knowledge/screens/orders-detail.md, re-explored /orders/5 = DH0005 on 2026-11-07: only "Quay lại danh sách"). ' +
          'Expected "đúng mẫu công ty" also needs the company invoice template / the fields to verify in the PDF. Needs QA confirmation that the feature exists in this environment.',
      },
    },
    async () => {},
  );
});
