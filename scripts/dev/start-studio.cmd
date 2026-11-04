@echo off
rem Bấm đúp để mở API, worker, web. Tham số được chuyển cho start-studio.ps1, ví dụ: start-studio.cmd -Only worker
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-studio.ps1" %*
pause
