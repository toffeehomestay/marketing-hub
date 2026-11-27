# Bản thử: GitHub + Cloudflare

Bản này đang phát triển và chưa thay thế phiên bản đang chạy. Không xóa project hoặc dữ liệu Supabase trong quá trình chuyển đổi.

- `worker/index.js`: bản nháp xác thực GitHub OAuth và API lưu dữ liệu, chỉ chấp nhận GitHub user ID được cấu hình; không lưu GitHub access token.
- `worker/migration.sql`: cấu trúc database D1 mới; chưa được áp dụng.
- `github-secure.html` và `worker-client.js`: giao diện bản nháp, chưa phải đường dẫn website chính.
- Chạy `node scripts/prepare-github-assets.mjs` tạo `dist-github` chỉ chứa các tệp giao diện. `wrangler.github.example.jsonc` là cấu hình tham khảo, không dùng để triển khai khi chưa điền và kiểm thử.
- Trước khi sử dụng cần tạo OAuth app GitHub, database D1, cấu hình Worker, lưu client secret và khóa phiên dưới dạng secret, thiết lập origin và tài khoản được phép, rồi kiểm thử thực tế. Không đưa mật khẩu hay secret vào GitHub hoặc chat.
- Cần kiểm thử và xây dựng quy trình di chuyển dữ liệu từ Supabase (nếu có); không tự động di chuyển hoặc xóa dữ liệu.
- Đăng xuất bản nháp chỉ xóa cookie của trình duyệt, chưa thu hồi các phiên đã sao chép. Không dùng dữ liệu nhạy cảm cho tới khi cơ chế phiên và phân quyền được kiểm thử đầy đủ.
