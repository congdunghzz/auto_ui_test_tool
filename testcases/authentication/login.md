# Feature: Đăng nhập / Đăng xuất (authentication)

- **Source:** QA team
- **Screens:** login, dashboard

## TC-AUTH-001: Đăng nhập thành công với tài khoản hợp lệ

- **Type:** positive
- **Priority:** high
- **Tags:** smoke
- **Preconditions:** Chưa đăng nhập
- **Test data:** Tài khoản test trong .env (QA_USERNAME / QA_PASSWORD)

**Steps**

1. Mở trang Đăng nhập
2. Nhập Tên đăng nhập và Mật khẩu hợp lệ
3. Nhấn "Đăng nhập"

**Expected**

- Chuyển tới trang Tổng quan (/dashboard)
- Góc trên hiển thị tên người dùng "Quản trị viên"

## TC-AUTH-002: Đăng nhập thất bại khi sai mật khẩu

- **Type:** negative
- **Priority:** high
- **Preconditions:** Chưa đăng nhập
- **Test data:** Tên đăng nhập hợp lệ; Mật khẩu: sai-mat-khau

**Steps**

1. Mở trang Đăng nhập
2. Nhập tên đăng nhập hợp lệ và mật khẩu sai
3. Nhấn "Đăng nhập"

**Expected**

- Hiển thị thông báo lỗi "Tên đăng nhập hoặc mật khẩu không đúng"
- Vẫn ở trang Đăng nhập

## TC-AUTH-003: Bỏ trống tên đăng nhập và mật khẩu

- **Type:** negative
- **Priority:** medium
- **Preconditions:** Chưa đăng nhập
- **Test data:** —

**Steps**

1. Mở trang Đăng nhập
2. Để trống cả hai ô
3. Nhấn "Đăng nhập"

**Expected**

- Hiển thị "Vui lòng nhập tên đăng nhập"
- Hiển thị "Vui lòng nhập mật khẩu"

## TC-AUTH-004: Truy cập trang cần đăng nhập khi chưa đăng nhập

- **Type:** navigation
- **Priority:** high
- **Preconditions:** Chưa đăng nhập
- **Test data:** —

**Steps**

1. Mở trực tiếp đường dẫn /customers
2. Đăng nhập bằng tài khoản hợp lệ

**Expected**

- Bước 1: bị chuyển về trang Đăng nhập
- Bước 2: sau khi đăng nhập quay lại đúng trang Khách hàng

## TC-AUTH-005: Đăng xuất

- **Type:** positive
- **Priority:** medium
- **Preconditions:** Đã đăng nhập
- **Test data:** —

**Steps**

1. Nhấn "Đăng xuất"
2. Mở lại đường dẫn /dashboard

**Expected**

- Bước 1: quay về trang Đăng nhập
- Bước 2: vẫn bị chuyển về trang Đăng nhập (phiên đã hết)

## TC-AUTH-006: Đăng nhập bằng tài khoản Google (SSO)

- **Type:** positive
- **Priority:** low
- **Preconditions:** Chưa đăng nhập
- **Test data:** Tài khoản Google công ty

**Steps**

1. Mở trang Đăng nhập
2. Nhấn "Đăng nhập với Google"
3. Chọn tài khoản Google công ty

**Expected**

- Đăng nhập thành công, chuyển tới trang Tổng quan
