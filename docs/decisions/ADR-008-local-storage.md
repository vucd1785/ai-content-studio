# ADR-008: Lưu file tại đĩa local

- Trạng thái: Accepted
- Ngày: 2026-10-27

## Bối cảnh

WAV, MP4 và upload cần chỗ chứa trước khi có tài khoản object storage. Path do client gửi là đường path traversal.

## Quyết định

Volume `data/` là implementation mặc định. DB lưu `storage_key` tương đối. Một module storage có `put`, `get` và `openRead`. Implementation S3-compatible được thêm sau bằng cùng các hàm đó, không đổi cột thành URL công khai.

Resolve key từ chối `..`, path tuyệt đối và symlink trỏ ra ngoài volume.

## Hệ quả

Backup máy local là backup media. Task S3 sau này không sửa hợp đồng artifact.

Xem [../08-SECURITY.md](../08-SECURITY.md).
