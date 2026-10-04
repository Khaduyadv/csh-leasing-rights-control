# UI/UX V1 — Mobile-first

## Nguyên tắc

- Mobile-first.
- Không bắt người dùng nhìn bảng 60–70 trường.
- Mỗi màn hình có một mục tiêu chính.
- Một case phải trả lời được: `Bây giờ cần làm gì?`
- Dữ liệu hệ thống chỉ đọc.
- Human Input chỉ hiện khi cần theo nhánh nghiệp vụ.
- Cảnh báo nằm ngay trên case.
- Hoàn tất do rule xác định, không chỉ do người dùng bấm chọn.

## Luồng vào

Không dùng sign-in nghiệp vụ ở V1.

`Chọn CBLĐ → lọc CSKH thuộc CBLĐ → chọn CSKH → xác nhận workspace`

Lưu ý: đây là lựa chọn persona/workspace, không phải cơ chế xác thực bảo mật.

## Workspace CSKH

Mặc định chỉ hiện:
- case đã onboard T-45;
- case quá hạn;
- chưa hoàn tất.

Không hiện:
- case ngoài T-45;
- case đã hoàn tất.

Ba vùng chính:
- `Đang xử lý`
- `Có vướng mắc`
- `Đã hoàn tất`

### Thẻ case

Chỉ hiện:
- Mã căn
- T-xx / Quá hạn
- Nhánh HĐT2
- Việc tiếp theo
- Cảnh báo

Thứ tự ưu tiên:
1. Quá hạn
2. Còn <= 7 ngày
3. Còn <= 15 ngày
4. Còn <= 30 ngày
5. Còn <= 45 ngày

Ưu tiên thêm nếu:
- HĐT2 còn sau Cam kết tiền thuê;
- cần CBLĐ hỗ trợ;
- không tiến triển >= 10 ngày;
- có ngoại lệ dữ liệu.

## Chi tiết case

### 1. Tình trạng hiện tại
- Mã căn
- Ngày hết Cam kết tiền thuê
- số ngày còn lại
- HĐT1
- HĐT2 liên quan
- nhánh HĐT2
- việc tiếp theo
- cảnh báo

### 2. Việc cần cập nhật
Chỉ hiện các trường Human Input liên quan tới trạng thái hiện tại.

Nhóm trường có thể gồm:
- kiểm tra mặt bằng
- so với điều kiện bàn giao khai thác
- sửa chữa/chênh lệch
- công nợ
- hồ sơ
- xác nhận Ban quản lý
- chuyển tiếp HĐT2

### 3. Vướng mắc / đề xuất
- loại vướng mắc
- nội dung
- đề xuất xử lý
- cần CBLĐ hỗ trợ?
- mức độ
- trạng thái xử lý

### 4. Lịch sử
Ẩn mặc định; mở khi cần.

## Workspace CBLĐ

Ưu tiên quản trị thay vì nhập thay CSKH.

Các vùng:
- `Cần tôi xử lý`
- `Theo dõi nhóm`
- `Theo CSKH`
- `Đã hoàn tất`

Ưu tiên hiển thị:
- quá hạn
- cảnh báo nghiêm trọng
- cần CBLĐ hỗ trợ
- không tiến triển
- ngoại lệ HĐT2

## Dashboard lãnh đạo

Chỉ đọc.

Các chỉ số chính:
- tổng quỹ thuộc phạm vi
- đã onboard T-45
- đang xử lý
- quá hạn
- HĐT2 trước/đúng/sau Cam kết tiền thuê
- không có HĐT2
- ngoại lệ dữ liệu
- chờ bàn giao
- đã hoàn tất
- vướng mắc theo nhóm
- biến động so với kỳ trước

Không dùng dashboard lãnh đạo làm màn hình nhập liệu.
