# Chạy bản trải nghiệm CSH Mobile/Web trên máy Windows

Bản preview dùng nhánh `build/mobile-v1` và kết nối trực tiếp Supabase project CSH hiện tại bằng publishable key + Anonymous Sign-In.

## Cách 1 — GitHub Desktop
1. Mở repository `Khaduyadv/csh-leasing-rights-control` trong GitHub Desktop.
2. Checkout branch `build/mobile-v1`.
3. Mở thư mục repository trên máy.
4. Vào thư mục `app`.
5. Double-click `PREVIEW.bat`.
6. Trình duyệt mở `http://127.0.0.1:8765`.

## Cách 2 — Git command line
```bat
git clone -b build/mobile-v1 https://github.com/Khaduyadv/csh-leasing-rights-control.git
cd csh-leasing-rights-control\app
PREVIEW.bat
```

## Điều kiện
- Máy có Python launcher `py` hoặc lệnh `python`.
- Có Internet để tải `supabase-js` từ `esm.sh` và kết nối Supabase.
- Supabase Anonymous Sign-Ins đã bật.

## Kiểm tra nhanh
- Chế độ CSKH: chọn CBLĐ → CSKH → kiểm tra 3 chỉ số và danh sách case.
- Chế độ CBLĐ: xem tải từng CSKH, case quá hạn và case cần hỗ trợ.
- Chế độ Lãnh đạo: kiểm tra 461 quỹ CSH, 86 trong T-45, 19 quá hạn, 14 HĐT2 sau CKTT và 1 exception mở.

Không merge `main` từ bản preview này. Mọi chỉnh sửa tiếp tục ở `build/mobile-v1` cho tới khi UI/UX được nghiệm thu.