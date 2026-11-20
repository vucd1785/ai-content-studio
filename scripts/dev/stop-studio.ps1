# Dừng API, worker, web đã chạy ngầm bằng start-studio.ps1. Không đụng tới container Docker hay dữ liệu.
# Ví dụ:
#   .\scripts\dev\stop-studio.ps1                 # dừng cả ba
#   .\scripts\dev\stop-studio.ps1 -Only worker    # chỉ dừng worker

param(
	[ValidateSet("api", "worker", "web")]
	[string[]]$Only = @("api", "worker", "web")
)

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$LogDir = Join-Path $RepoRoot "data\logs"
$ports = @{ api = 3001; web = 5173 }

foreach ($name in $Only) {
	$ids = @()
	$pidFile = Join-Path $LogDir "studio-$name.pid"
	if (Test-Path -LiteralPath $pidFile) {
		$ids += [int](Get-Content -LiteralPath $pidFile -Raw)
	}
	if ($ports.ContainsKey($name)) {
		$ids += Get-NetTCPConnection -State Listen -LocalPort $ports[$name] -ErrorAction SilentlyContinue |
			Select-Object -ExpandProperty OwningProcess
	}
	$alive = $ids | Select-Object -Unique | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }
	if (-not $alive) {
		Write-Host "'$name' không chạy." -ForegroundColor DarkGray
		continue
	}
	foreach ($id in $alive) {
		# /T: dừng cả cây tiến trình (powershell -> fnm -> cmd -> node).
		taskkill /PID $id /T /F *> $null
	}
	# Đợi thoát hẳn để start-studio ngay sau đó không tưởng tiến trình vẫn còn chạy.
	$deadline = (Get-Date).AddSeconds(15)
	while (($alive | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }) -and (Get-Date) -lt $deadline) {
		Start-Sleep -Milliseconds 300
	}
	Write-Host "Đã dừng '$name'." -ForegroundColor Green
}
