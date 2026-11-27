# Bản thử nghiệm Supabase — chưa triển khai

`secure.html` là bản thử giao diện đăng nhập và lưu trữ, tách khỏi bản gốc. Cấu hình đang để trống có chủ ý; chưa được kiểm thử với Supabase thật và không được xem là an toàn để đưa vào sử dụng cho dữ liệu thật.

Trước khi triển khai cần: kiểm tra migration trên một dự án thử; kiểm thử phân quyền bằng ít nhất hai tài khoản; tắt tự đăng ký và chỉ tạo tài khoản được phép; cấu hình đúng URL chuyển hướng; xác minh khôi phục bản sao, xung đột khi sửa trên nhiều thiết bị, sự cố mạng và đăng xuất; sau đó mới tích hợp vào đường dẫn chính và cấu hình khóa publishable. Không đưa khóa service-role hoặc mật khẩu database vào mã nguồn.

Dữ liệu cũ trong localStorage không được tự động chuyển sang tài khoản. Người dùng cần xuất bản sao từ bản cũ và tự nhập sau khi hệ thống mới đã được kiểm thử. Các kết nối Google, Meta và AI chưa được triển khai.
