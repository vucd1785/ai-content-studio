# Khởi tạo Node.js 24 cho terminal tích hợp (chỉ repo AI Content Studio).
# Gọi từ profile "AI Studio Node 24" trong .vscode/settings.json.
# Không đổi PATH hệ thống, không chạy fnm default, không sửa D:\nodejs.

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$FnmDir = "E:\NodeVersions"
$NodeMajor = "24"

$fnmExe = $env:FNM_EXE
if (-not $fnmExe) {
	$fnmCmd = Get-Command fnm -ErrorAction SilentlyContinue
	if ($fnmCmd) {
		$fnmExe = $fnmCmd.Source
	}
}
if (-not $fnmExe -or -not (Test-Path -LiteralPath $fnmExe)) {
	Write-Error "Không tìm thấy fnm trên PATH. Cài fnm hoặc đặt FNM_EXE."
}

$env:FNM_DIR = $FnmDir
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
fnm use $NodeMajor | Out-Null

Set-Location -LiteralPath $RepoRoot

Write-Host "AI Content Studio — Node $(node -v) — $(node -p 'process.execPath')" -ForegroundColor DarkGreen
Write-Host "Repo: $RepoRoot" -ForegroundColor DarkGray
Write-Host "pnpm: dùng corepack hoặc scripts/with-node24.ps1 (xem docs/12-MODEL-HANDOFF.md)" -ForegroundColor DarkGray
