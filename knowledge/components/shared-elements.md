# Shared UI elements

## Curated notes

- —

<!-- AUTO-GENERATED:START (explorer overwrites this block; edit outside it) -->
Elements present on 2+ screens — candidates for reusable components (e.g. `playwright/components/`).

| Type | Name | Selector | Screens |
|---|---|---|---|
| button | Đăng xuất | `page.getByRole('button', { name: 'Đăng xuất' })` | customers, dashboard, orders-detail--completed, orders-detail, orders-new, orders |
| link | Tổng quan | `page.getByRole('link', { name: 'Tổng quan' })` | customers, dashboard, orders-detail--completed, orders-detail, orders-new, orders |
| link | Khách hàng | `page.getByRole('link', { name: 'Khách hàng' })` | customers, orders-detail--completed, orders-detail, orders-new, orders |
| link | Đơn hàng | `page.getByRole('link', { name: 'Đơn hàng' })` | customers, orders-detail--completed, orders-detail, orders-new |
| link | Đơn hàng | `page.getByRole('link', { name: 'Đơn hàng', exact: true })` | dashboard, orders |
| link | Quay lại danh sách | `page.getByRole('link', { name: 'Quay lại danh sách' })` | orders-detail--completed, orders-detail |
<!-- AUTO-GENERATED:END -->
