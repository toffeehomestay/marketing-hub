# Đồng bộ Google Calendar — bản nháp

Module `google-calendar.mjs` chỉ chuẩn bị logic tạo hoặc cập nhật sự kiện; nó chưa được gọi bởi website, chưa có kết nối hay dữ liệu Google. Các bài kiểm tra dùng API giả lập.

`google-oauth.mjs` là phần xử lý OAuth phía máy chủ đang thử nghiệm: tạo URL chọn tài khoản và trao đổi mã khi callback khớp trạng thái và người dùng. Module chưa có API route, kho lưu token hoặc giao diện kết nối, nên không thể sử dụng độc lập.

Để đồng bộ tự động thật, cần bổ sung backend xác thực người dùng, luồng Google OAuth, quyền Calendar, lưu và bảo vệ refresh token ở phía máy chủ, hàng đợi bền vững, xử lý xung đột và cơ chế thử lại. Cần hiển thị trạng thái chưa đồng bộ thay vì báo thành công khi ghi vào Google thất bại. Khi sửa ghi chú, không ghi đè thay đổi trên Google Calendar nếu phiên bản đã thay đổi; việc xóa sự kiện cần có chính sách rõ ràng. Không đưa token, client secret hoặc khóa mã hóa vào trình duyệt, mã nguồn hoặc chat.

Ngày và giờ cần lưu cùng múi giờ IANA của người dùng; các sự kiện demo trong module dùng mặc định 30 phút và nhắc 15 phút, chưa xác minh các trường hợp chuyển đổi giờ mùa hè. Việc gửi thông báo điện thoại phụ thuộc cài đặt Google Calendar và thiết bị.
