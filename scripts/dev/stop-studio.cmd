@echo off
rem Bấm đúp để dừng API, worker, web chạy ngầm. Ví dụ: stop-studio.cmd -Only worker
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-studio.ps1" %*
pause
