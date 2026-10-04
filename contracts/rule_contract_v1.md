# Rule Contract V1

## Mục tiêu

Rule engine phải xác định trạng thái case, việc tiếp theo, cảnh báo và điều kiện hoàn tất mà không yêu cầu CSKH tự suy diễn.

## Onboard T-45

- Nếu `cktt_end_date - current_date <= 45` và case chưa hoàn tất → onboard.
- Case quá hạn nhưng chưa hoàn tất vẫn giữ trên workspace.
- Case chưa tới T-45 không hiển thị trên workspace mặc định.

## Phân nhánh HĐT2

- Không có HĐT2 → `NO_HDT2`.
- HĐT2 kết thúc trước ngày hết Cam kết tiền thuê → `BEFORE_CKTT`.
- HĐT2 kết thúc đúng ngày hết Cam kết tiền thuê → `SAME_AS_CKTT`.
- HĐT2 kết thúc sau ngày hết Cam kết tiền thuê → `AFTER_CKTT`.
- Nhiều HĐT2 thực sự cùng hiệu lực tại mốc xét hoặc dữ liệu không đủ xác định → `DATA_EXCEPTION`.

## Việc tiếp theo

Ưu tiên theo thứ tự:
1. Dữ liệu HĐT2 có ngoại lệ → rà soát dữ liệu HĐT2.
2. HĐT2 còn sau Cam kết tiền thuê và chưa hoàn tất chuyển tiếp → xử lý chuyển tiếp HĐT2.
3. Chưa kiểm tra mặt bằng → kiểm tra mặt bằng.
4. Mặt bằng dưới chuẩn và sửa chữa chưa xong → hoàn thiện mặt bằng.
5. Công nợ chưa xử lý → xử lý công nợ.
6. Hồ sơ chưa hoàn tất → hoàn thiện hồ sơ.
7. Ban quản lý chưa xác nhận → Ban quản lý xác nhận.
8. Đủ điều kiện → hoàn tất bàn giao Chủ sở hữu.

## Cảnh báo

- `CRITICAL`: dữ liệu HĐT2 ngoại lệ hoặc Cam kết tiền thuê đã quá hạn mà case chưa hoàn tất.
- `WARNING`: cần CBLĐ hỗ trợ; hoặc case không có tiến triển từ 10 ngày; hoặc còn <= 7 ngày.
- `INFO`: còn <= 15 ngày.

## Vướng mắc / đề xuất

CSKH có thể nhập:
- loại vướng mắc
- nội dung
- đề xuất xử lý
- có cần CBLĐ hỗ trợ không
- mức độ ưu tiên
- trạng thái xử lý

Nếu `need_cbld_support = true` và vướng mắc chưa xử lý xong thì case phải xuất hiện trong vùng chú ý của CBLĐ.

## Hoàn tất

Không cho người dùng tự quyết định hoàn tất chỉ bằng một nút trạng thái.

Case chỉ được coi là hoàn tất khi các điều kiện bắt buộc theo đúng nhánh nghiệp vụ đã đạt và có bằng chứng/điểm xác nhận cần thiết.

Khi hoàn tất:
- `case_status = COMPLETED`
- ghi `completed_at`
- ghi `completion_ref` nếu có
- rời workspace chính
- vẫn giữ toàn bộ lịch sử

## Không thuộc phạm vi

Loại khỏi rule engine hiện tại:
- ý định Chủ sở hữu về tiếp tục/không tiếp tục môi giới
- chính sách môi giới
- hoa hồng môi giới
- Hợp đồng môi giới
