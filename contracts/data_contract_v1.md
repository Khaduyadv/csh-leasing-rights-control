# Data Contract V1

## Khóa chuẩn

`shop_id` là khóa liên kết chuẩn giữa Local Master Shared, Supabase và các engine AI.

Không fuzzy match khi đồng bộ dữ liệu.

## Nguồn dữ liệu

### Local Master Shared
Nguồn chuẩn cho dữ liệu nền dùng chung:
- Shop_ID
- dự án/khu/zone
- định danh căn
- mapping chuẩn

### Supabase
Nguồn chuẩn vận hành của CSH:
- HĐT1
- HĐT2
- ngày hết Cam kết tiền thuê
- assignment vận hành
- trạng thái case
- dữ liệu người dùng cập nhật
- vướng mắc/đề xuất
- lịch sử sự kiện
- cảnh báo và exception
- bàn giao và completion

### GitHub
Không lưu dữ liệu nghiệp vụ sống.
Giữ:
- schema/migration
- rule contract
- UI/API code
- test
- release history

## Quy tắc HĐT1

- HĐT1 là hợp đồng Chủ sở hữu ↔ Chủ đầu tư.
- `hdt1.end_date = hdt1.cktt_end_date`.

## Quy tắc HĐT2

HĐT2 là hợp đồng Chủ đầu tư ↔ Khách thuê.

Tại ngày hết Cam kết tiền thuê, mỗi case được phân loại:
- `BEFORE_CKTT`
- `SAME_AS_CKTT`
- `AFTER_CKTT`
- `NO_HDT2`
- `DATA_EXCEPTION`

Nếu có hơn một HĐT2 thực sự còn hiệu lực tại cùng mốc xét thì phải sinh ngoại lệ dữ liệu; không tự chọn một hợp đồng.

## Onboard

Case xuất hiện trên workspace khi:
- còn tối đa 45 ngày tới ngày hết Cam kết tiền thuê; hoặc
- đã quá hạn nhưng chưa hoàn tất.

Case `COMPLETED` không xuất hiện trên workspace chính nhưng vẫn còn lịch sử.

## Human Input

Người dùng chỉ nhập dữ kiện họ trực tiếp xác nhận.
Không yêu cầu nhập lại dữ liệu hệ thống có nguồn chuẩn.

Các nhóm nhập chính:
- kiểm tra mặt bằng
- điều kiện bàn giao
- sửa chữa/chênh lệch
- công nợ
- hồ sơ
- xác nhận Ban quản lý
- chuyển tiếp HĐT2 nếu áp dụng
- vướng mắc/đề xuất
- bằng chứng hoàn tất

## Lịch sử

Mọi thay đổi vận hành phải có khả năng truy vết theo:
- Shop_ID
- trường thay đổi
- giá trị trước/sau
- người/role được chọn
- session
- thời điểm
- nguồn/evidence nếu có
