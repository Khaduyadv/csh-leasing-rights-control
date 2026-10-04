# CSH Leasing Rights Control

Hệ thống kiểm soát vòng đời khai thác và bàn giao các căn có Cam kết tiền thuê.

## Nghiệp vụ đã chốt

- HĐT1: ký giữa Chủ sở hữu và Chủ đầu tư; ngày kết thúc HĐT1 trùng ngày hết Cam kết tiền thuê.
- HĐT2: ký giữa Chủ đầu tư và Khách thuê; có thể kết thúc trước, đúng hoặc sau ngày hết Cam kết tiền thuê.
- Không theo dõi ý định Chủ sở hữu về môi giới; không có nghiệp vụ môi giới/hoa hồng/Hợp đồng môi giới trong phạm vi này.
- Hệ thống theo dõi đến khi bàn giao hoàn tất cho Chủ sở hữu.
- Chỉ các căn đã onboard T-45 và chưa hoàn tất xuất hiện trên workspace làm việc chính.
- Căn hoàn tất không bị xóa; được giữ trong lịch sử.

## Kiến trúc

- Local Master Shared: nguồn định danh và dữ liệu nền dùng chung.
- Supabase: nguồn dữ liệu vận hành của CSH.
- GitHub: mã nguồn, migration, hợp đồng dữ liệu, quy tắc và release.
- Mobile/Web: giao diện nhập liệu và cảnh báo.
- Claude/Cowork: CSH Operational Engine.
- GPT: Independent Review / Decision Support theo ngoại lệ.
- AIOS Core: governance và tiêu thụ governed output.

## Supabase

Project: `csh-leasing-rights-control`

Các bảng lõi hiện có:

- `shop_master`
- `assignment`
- `hdt1`
- `hdt2`
- `case_current`
- `case_event_history`
- `exception`

Các view điều khiển chính:

- `v_case_control`
- `v_active_workspace`
- `v_completed_cases`
- `v_workspace_cases`
- `v_cbld_attention`

## UI vận hành

Luồng vào không yêu cầu sign-in nghiệp vụ:

`Chọn CBLĐ → chọn CSKH → xác nhận workspace → danh sách case → chi tiết case`

Màn hình mặc định chỉ hiện case T-45 đến quá hạn và chưa hoàn tất.

Mỗi case phải trả lời được:

- Trạng thái hiện tại
- HĐT2 thuộc nhánh nào so với Cam kết tiền thuê
- Việc tiếp theo
- Cảnh báo
- Vướng mắc/đề xuất
- Điều kiện hoàn tất
