# Feature: Quản lý khách hàng (customer)

- **Source:** QA team
- **Screens:** customers

## TC-CUS-001: Thêm khách hàng với dữ liệu hợp lệ

- **Type:** positive
- **Priority:** high
- **Tags:** smoke, crud
- **Preconditions:** Đã đăng nhập
- **Test data:** Họ tên: Khách test <duy nhất>; Email: <duy nhất>@example.com; Số điện thoại: 0911222333; Khách hàng VIP: có

**Steps**

1. Mở màn hình Khách hàng
2. Nhấn "Thêm khách hàng"
3. Nhập Họ tên, Email, Số điện thoại; tick "Khách hàng VIP"
4. Nhấn "Lưu"
5. Tìm kiếm theo email vừa tạo

**Expected**

- Hiển thị thông báo "Đã thêm khách hàng thành công"
- Bảng hiển thị đúng 1 dòng với họ tên, email vừa nhập, trạng thái "Hoạt động", VIP "Có"

## TC-CUS-002: Bỏ trống trường bắt buộc khi thêm khách hàng

- **Type:** negative
- **Priority:** high
- **Tags:** validation
- **Preconditions:** Đã đăng nhập
- **Test data:** —

**Steps**

1. Mở màn hình Khách hàng, nhấn "Thêm khách hàng"
2. Để trống Họ tên và Email
3. Nhấn "Lưu"

**Expected**

- Hiển thị "Họ tên là bắt buộc" và "Email là bắt buộc"
- Popup thêm khách hàng vẫn mở

## TC-CUS-003: Email sai định dạng

- **Type:** negative
- **Priority:** medium
- **Tags:** validation
- **Preconditions:** Đã đăng nhập
- **Test data:** Họ tên: Khách test; Email: abc@

**Steps**

1. Mở popup "Thêm khách hàng"
2. Nhập Họ tên và Email sai định dạng
3. Nhấn "Lưu"

**Expected**

- Hiển thị "Email không hợp lệ"

## TC-CUS-004: Email đã tồn tại

- **Type:** negative
- **Priority:** medium
- **Tags:** validation
- **Preconditions:** Đã có khách hàng với email an.nguyen@example.com (dữ liệu mẫu)
- **Test data:** Họ tên: Khách trùng email; Email: an.nguyen@example.com

**Steps**

1. Mở popup "Thêm khách hàng"
2. Nhập Họ tên và email đã tồn tại
3. Nhấn "Lưu"

**Expected**

- Hiển thị "Email đã tồn tại"

## TC-CUS-005: Kiểm tra biên số điện thoại

- **Type:** boundary
- **Priority:** medium
- **Tags:** validation
- **Preconditions:** Đã đăng nhập
- **Test data:** 091234567 (9 số) → lỗi; 09123456789 (11 số) → lỗi; 1912345678 (không bắt đầu bằng 0) → lỗi; 0912345678 (10 số) → hợp lệ

**Steps**

1. Mở popup "Thêm khách hàng", nhập Họ tên và Email hợp lệ (duy nhất)
2. Nhập từng giá trị Số điện thoại theo test data
3. Nhấn "Lưu"

**Expected**

- Giá trị không hợp lệ: hiển thị "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0"
- Giá trị hợp lệ: hiển thị "Đã thêm khách hàng thành công"

## TC-CUS-006: Sửa thông tin khách hàng

- **Type:** positive
- **Priority:** high
- **Tags:** crud
- **Preconditions:** Có một khách hàng do test tạo ra
- **Test data:** Họ tên mới: <tên cũ> (đã sửa); Trạng thái: Ngừng hoạt động

**Steps**

1. Tìm khách hàng theo email
2. Nhấn "Sửa" trên dòng của khách hàng
3. Đổi Họ tên và Trạng thái khách hàng
4. Nhấn "Lưu"

**Expected**

- Popup có tiêu đề "Cập nhật khách hàng"
- Hiển thị "Đã cập nhật khách hàng thành công"
- Dòng khách hàng hiển thị họ tên mới và trạng thái "Ngừng hoạt động"

## TC-CUS-007: Xóa khách hàng

- **Type:** positive
- **Priority:** high
- **Tags:** crud
- **Preconditions:** Có một khách hàng do test tạo ra
- **Test data:** —

**Steps**

1. Tìm khách hàng theo email
2. Nhấn "Xóa" trên dòng của khách hàng
3. Nhấn "Xóa" trong hộp thoại xác nhận

**Expected**

- Hộp thoại "Xác nhận xóa" hiển thị câu "Bạn có chắc muốn xóa khách hàng <họ tên>?"
- Hiển thị "Đã xóa khách hàng <họ tên>"
- Tìm lại theo email: hiển thị "Không tìm thấy khách hàng nào"

## TC-CUS-008: Hủy thao tác xóa khách hàng

- **Type:** negative
- **Priority:** medium
- **Tags:** crud
- **Preconditions:** Có một khách hàng do test tạo ra
- **Test data:** —

**Steps**

1. Tìm khách hàng theo email, nhấn "Xóa"
2. Nhấn "Hủy" trong hộp thoại xác nhận

**Expected**

- Hộp thoại đóng lại
- Khách hàng vẫn còn trong bảng

## TC-CUS-009: Tìm kiếm không phân biệt hoa thường

- **Type:** positive
- **Priority:** medium
- **Tags:** search
- **Preconditions:** Có khách hàng mẫu "Nguyễn Văn An"
- **Test data:** Từ khóa: nguyễn văn an

**Steps**

1. Mở màn hình Khách hàng
2. Nhập từ khóa chữ thường vào ô tìm kiếm

**Expected**

- Bảng hiển thị khách hàng "Nguyễn Văn An"

## TC-CUS-010: Lọc theo trạng thái Ngừng hoạt động

- **Type:** positive
- **Priority:** medium
- **Tags:** search
- **Preconditions:** Có khách hàng ở trạng thái Ngừng hoạt động (dữ liệu mẫu)
- **Test data:** Trạng thái: Ngừng hoạt động

**Steps**

1. Mở màn hình Khách hàng
2. Chọn bộ lọc Trạng thái = "Ngừng hoạt động"

**Expected**

- Mọi dòng trong bảng đều có trạng thái "Ngừng hoạt động"
- Có ít nhất 1 dòng

## TC-CUS-011: Phân trang danh sách khách hàng

- **Type:** navigation
- **Priority:** low
- **Tags:** pagination
- **Preconditions:** Có hơn 5 khách hàng (dữ liệu mẫu có 12)
- **Test data:** —

**Steps**

1. Mở màn hình Khách hàng
2. Nhấn "Trang sau"
3. Nhấn "Trang trước"

**Expected**

- Ban đầu: hiển thị 5 dòng, "Trang 1 / N", nút "Trang trước" bị vô hiệu hóa
- Sau bước 2: hiển thị "Trang 2 / N", nút "Trang trước" được bật
- Sau bước 3: quay lại "Trang 1 / N"

## TC-CUS-012: Kiểm tra biên độ dài Họ tên

- **Type:** boundary
- **Priority:** low
- **Tags:** validation
- **Preconditions:** Đã đăng nhập
- **Test data:** Họ tên 100 ký tự → hợp lệ; Họ tên 101 ký tự → lỗi

**Steps**

1. Mở popup "Thêm khách hàng", nhập Email hợp lệ (duy nhất)
2. Nhập Họ tên theo test data
3. Nhấn "Lưu"

**Expected**

- 100 ký tự: hiển thị "Đã thêm khách hàng thành công"
- 101 ký tự: hiển thị "Họ tên tối đa 100 ký tự"
