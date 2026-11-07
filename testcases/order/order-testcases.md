# Feature: order

- **Source:** order-testcases.csv (imported 2026-11-07)
- **Screens:** UNKNOWN — the generator maps steps to knowledge/screens/

## TC-ORD-001: Tạo đơn hàng hợp lệ

- **Type:** positive
- **Priority:** high
- **Tags:** smoke
- **Preconditions:** Đã đăng nhập
- **Test data:** Khách hàng: Trần Thị Bình; Sản phẩm: Chuột không dây M2; Số lượng: 3; Thanh toán: Chuyển khoản

**Steps**

1. Mở màn hình Tạo đơn hàng
2. Chọn khách hàng, sản phẩm, nhập số lượng, chọn phương thức thanh toán
3. Nhấn "Tạo đơn"

**Expected**

- Chuyển sang trang chi tiết đơn hàng
- Hiển thị thông báo "Đã tạo đơn hàng DHxxxx"
- Chi tiết hiển thị đúng khách hàng, sản phẩm, số lượng 3, thanh toán Chuyển khoản, trạng thái "Chờ xử lý"

## TC-ORD-002: Không chọn khách hàng

- **Type:** negative
- **Priority:** high
- **Tags:** validation
- **Preconditions:** Đã đăng nhập
- **Test data:** —

**Steps**

1. Mở màn hình Tạo đơn hàng
2. Không chọn khách hàng
3. Nhấn "Tạo đơn"

**Expected**

- Hiển thị "Vui lòng chọn khách hàng"
- Vẫn ở trang Tạo đơn hàng

## TC-ORD-003: Kiểm tra biên số lượng

- **Type:** boundary
- **Priority:** medium
- **Tags:** validation
- **Preconditions:** Đã đăng nhập
- **Test data:** 0 → lỗi; 101 → lỗi; 1 → hợp lệ; 100 → hợp lệ

**Steps**

1. Mở màn hình Tạo đơn hàng và chọn khách hàng Nguyễn Văn An
2. Nhập từng giá trị số lượng theo test data
3. Nhấn "Tạo đơn"

**Expected**

- Giá trị 0 và 101: hiển thị "Số lượng phải từ 1 đến 100"
- Giá trị 1 và 100: tạo đơn thành công, hiển thị "Đã tạo đơn hàng"

## TC-ORD-004: Tính tổng tiền có giao hàng nhanh

- **Type:** positive
- **Priority:** medium
- **Preconditions:** Đã đăng nhập
- **Test data:** Sản phẩm: Bàn phím cơ K1 (850.000đ); Số lượng: 2; Giao hàng nhanh: có

**Steps**

1. Mở màn hình Tạo đơn hàng
2. Chọn sản phẩm, nhập số lượng
3. Tick "Giao hàng nhanh"

**Expected**

- Tổng tiền hiển thị "1.730.000đ"

## TC-ORD-005: Lọc đơn hàng theo tab Hoàn thành

- **Type:** positive
- **Priority:** low
- **Tags:** search
- **Preconditions:** Có đơn hàng ở trạng thái Hoàn thành (dữ liệu mẫu)
- **Test data:** —

**Steps**

1. Mở màn hình Đơn hàng
2. Chọn tab "Hoàn thành"

**Expected**

- Tab "Hoàn thành" được chọn
- Mọi dòng trong bảng có trạng thái "Hoàn thành"

## TC-ORD-006: Luồng đầy đủ: tạo khách hàng mới rồi tạo và hoàn thành đơn hàng

- **Type:** workflow
- **Priority:** high
- **Tags:** smoke, e2e
- **Preconditions:** Đã đăng nhập
- **Test data:** Khách hàng mới (duy nhất); Sản phẩm: Màn hình 24 inch; Số lượng: 1

**Steps**

1. Thêm khách hàng mới ở màn hình Khách hàng
2. Tạo đơn hàng cho khách hàng đó
3. Mở màn hình Đơn hàng, tab "Chờ xử lý"
4. Mở chi tiết đơn vừa tạo, nhấn "Đánh dấu hoàn thành"

**Expected**

- Bước 3: đơn vừa tạo có trong tab "Chờ xử lý" với tên khách hàng mới
- Bước 4: trạng thái đơn chuyển thành "Hoàn thành", hiển thị "Đã cập nhật trạng thái đơn hàng"

## TC-ORD-007: In hóa đơn PDF

- **Type:** positive
- **Priority:** low
- **Preconditions:** Có đơn hàng ở trạng thái Hoàn thành
- **Test data:** —

**Steps**

1. Mở chi tiết một đơn hàng Hoàn thành
2. Nhấn "In hóa đơn"

**Expected**

- File PDF hóa đơn được tải về đúng mẫu công ty

