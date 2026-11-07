# Screen: orders-detail--completed

## Curated notes (AI/QA maintained — explorer never overwrites this section)

- **Purpose:** UNKNOWN — fill in from business docs or QA. Mark inferred statements with _(inferred, unverified)_.
- **Business rules / validation:** UNKNOWN
- **Dependencies on other screens:** UNKNOWN
- **Test data needs:** UNKNOWN
- **Known limitations / open questions:** —

<!-- AUTO-GENERATED:START (explorer overwrites this block; edit outside it) -->
## Overview (auto)

- **Variant:** Order in status "Hoàn thành" (seed order DH0002): no "Đánh dấu hoàn thành" button — same route as [orders-detail](orders-detail.md), different data state
- **Route:** `/orders/:id` — explored URL: http://localhost:4000/orders/2
- **Requires login:** yes
- **Document title:** Đơn hàng DH0002 · QA Demo Shop
- **Headings:** h1 "Đơn hàng DH0002"
- **Last explored:** 2026-11-07T11:57:57.711Z
- **Screenshot:** ![screenshot](../screenshots/orders-detail--completed.png)

## Interactive elements

| # | Type | Accessible name | Selector (verified unique) | Notes |
|---|---|---|---|---|
| 1 | button | Đăng xuất | `page.getByRole('button', { name: 'Đăng xuất' })` |  |
| 2 | link | Tổng quan | `page.getByRole('link', { name: 'Tổng quan' })` | href /dashboard |
| 3 | link | Khách hàng | `page.getByRole('link', { name: 'Khách hàng' })` | href /customers |
| 4 | link | Đơn hàng | `page.getByRole('link', { name: 'Đơn hàng' })` | aria-current=page; href /orders |
| 5 | link | Quay lại danh sách | `page.getByRole('link', { name: 'Quay lại danh sách' })` | href /orders |

## Forms and fields

_No <form> elements visible._

## Tables

_none_

## Dialogs / modals

_none detected_

## Tabs

_none_

## Navigation menus and pagination

- navigation "Menu chính": Tổng quan → /dashboard, Khách hàng → /customers, Đơn hàng → /orders (current)

## Notifications / live regions

- status (aria-live=polite) testid=`toast` id=`toast` — hidden on load

## Other elements with a test id (assertion targets)

| Selector | Tag | Visible on load | Text at exploration time |
|---|---|---|---|
| `page.getByTestId('current-user')` | span | yes | Quản trị viên |
| `page.getByTestId('order-customer')` | dd | yes | Trần Thị Bình |
| `page.getByTestId('order-product')` | dd | yes | Chuột không dây M2 |
| `page.getByTestId('order-quantity')` | dd | yes | 1 |
| `page.getByTestId('order-payment')` | dd | yes | Chuyển khoản |
| `page.getByTestId('order-status')` | dd | yes | Hoàn thành |
| `page.getByTestId('order-detail-total')` | dd | yes | 320.000đ |
| `page.getByTestId('toast')` | div | no |  |

## Network calls on load (XHR/fetch)

_none_

## Outgoing navigation

| Link text | Target route | Target screen |
|---|---|---|
| Tổng quan | `/dashboard` | [dashboard](dashboard.md) |
| Khách hàng | `/customers` | [customers](customers.md) |
| Đơn hàng | `/orders` | [orders](orders.md) |
| Quay lại danh sách | `/orders` | [orders](orders.md) |

## States (captured by configured actions)

_No states configured for this screen. Add entries to `states` in explore.config.json to capture modals and validation messages._

## Accessibility snapshot on load

<details><summary>aria snapshot (YAML)</summary>

```yaml
- banner:
  - text: QA Demo Shop Quản trị viên
  - button "Đăng xuất"
- navigation "Menu chính":
  - link "Tổng quan":
    - /url: /dashboard
  - link "Khách hàng":
    - /url: /customers
  - link "Đơn hàng":
    - /url: /orders
- main:
  - heading "Đơn hàng DH0002" [level=1]
  - term: Khách hàng
  - definition: Trần Thị Bình
  - term: Sản phẩm
  - definition: Chuột không dây M2
  - term: Số lượng
  - definition: "1"
  - term: Thanh toán
  - definition: Chuyển khoản
  - term: Trạng thái
  - definition: Hoàn thành
  - term: Tổng tiền
  - definition: 320.000đ
  - link "Quay lại danh sách":
    - /url: /orders
```
</details>
<!-- AUTO-GENERATED:END -->
