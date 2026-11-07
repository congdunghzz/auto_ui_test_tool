# Automation report — order

Source: `testcases/order/order-testcases.md` · Spec: `playwright/tests/order/order-testcases.spec.ts` · Data: `test-data/order.json`
Page Objects: `playwright/pages/OrdersPage.ts`, `NewOrderPage.ts`, `OrderDetailPage.ts` (+ existing `CustomersPage`)

| TC | Status | Notes |
|---|---|---|
| TC-ORD-001 | AUTOMATED | "DHxxxx" asserted as `DH` + 4 digits (code format seen in knowledge/screens/orders.md); detail values via test ids `order-customer/-product/-quantity/-payment/-status` (orders-detail re-explored 2026-11-07) |
| TC-ORD-002 | AUTOMATED | message from state `orders-new/empty-submit` |
| TC-ORD-003 | AUTOMATED | data-driven: 0, 101 rejected + 1, 100 accepted → 4 tests, one TC. "Số lượng phải từ 1 đến 100" comes from the test case (not captured by an explorer state), located by exact text. Valid values create real orders. |
| TC-ORD-004 | AUTOMATED | total via test id `order-total`; product option label "Bàn phím cơ K1 — 850.000đ" from the KB |
| TC-ORD-005 | AUTOMATED | waits for `GET /api/orders`, then polls the whole "Trạng thái" column (≥1 row, all "Hoàn thành") |
| TC-ORD-006 | AUTOMATED | new customer via `uniq()`; order located by its code read from the detail heading; proves the "Chờ xử lý" filter is applied before looking for the row |
| TC-ORD-007 | BLOCKED | No "In hóa đơn" control: re-explored a "Hoàn thành" order (/orders/5 = DH0005) and a "Chờ xử lý" order (/orders/6) — neither has it. "Đúng mẫu công ty" also needs the reference template. Kept as `test.fixme` placeholder. |

## Questions for QA

- TC-ORD-007: does "In hóa đơn" exist in this environment (which role/status shows it)? What exactly must be checked in the PDF to count as "đúng mẫu công ty" (file name, required fields, layout reference file)?
- TC-ORD-001: is the order code always `DH` + 4 digits (e.g. DH0010)? The test assumes so for "DHxxxx".
- TC-ORD-003: should an invalid quantity also keep the user on "Tạo đơn hàng" / create no order? The test checks only the message, as written.
