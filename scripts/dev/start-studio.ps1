# Mở API, worker, web mỗi thứ một cửa sổ PowerShell riêng (Node 24 qua with-node24.ps1).
# Ví dụ:
#   .\scripts\dev\start-studio.ps1                 # bật container rồi mở cả ba
#   .\scripts\dev\start-studio.ps1 -Only worker    # chỉ mở lại worker
#   .\scripts\dev\start-studio.ps1 -Only api,web -NoDocker
# Dừng một tiến trình: bấm Ctrl+C trong cửa sổ của nó (cửa sổ giữ lại để đọc lỗi).

param(
	[ValidateSet("api", "worker", "web")]
	[string[]]$Only = @("api", "worker", "web"),
	[switch]$NoDocker
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$WithNode = Join-Path $RepoRoot "scripts\with-node24.ps1"

if (-not $NoDocker) {
	Write-Host "Bật postgres, redis, tts..." -ForegroundColor Cyan
	Push-Location $RepoRoot
	try {
		docker compose --profile cpu up -d postgres redis tts
		if ($LASTEXITCODE -ne 0) { throw "docker compose lỗi (Docker Desktop đã mở chưa?)" }
	} finally {
		Pop-Location
	}

	# tts nạp model mất vài phút; worker cần tts healthy trước bước giọng đọc.
	$deadline = (Get-Date).AddMinutes(10)
	foreach ($name in @("postgres", "redis", "tts")) {
		do {
			$health = docker inspect -f "{{.State.Health.Status}}" "ai-content-studio-$name-1" 2>$null
			if ($health -eq "healthy") { break }
			Write-Host "  chờ $name ($health)..." -ForegroundColor DarkGray
			Start-Sleep -Seconds 5
		} while ((Get-Date) -lt $deadline)
		if ($health -ne "healthy") { throw "$name chưa healthy sau 10 phút: docker logs ai-content-studio-$name-1" }
		Write-Host "  $name healthy" -ForegroundColor Green
	}
}

$processes = @{
	api    = @{ Dir = "apps\api"; Cmd = "node --env-file=..\..\.env --import tsx src/main.ts" }
	worker = @{ Dir = "apps\worker"; Cmd = "node --env-file-if-exists=..\..\.env --import tsx src/queue/run-worker.ts" }
	web    = @{ Dir = "apps\web"; Cmd = "pnpm run dev" }
}

foreach ($name in $Only) {
	$p = $processes[$name]
	$dir = Join-Path $RepoRoot $p.Dir
	$inner = "`$Host.UI.RawUI.WindowTitle = 'studio: $name'; Set-Location -LiteralPath '$dir'; & '$WithNode' $($p.Cmd)"
	Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $inner)
	Write-Host "Đã mở cửa sổ '$name'" -ForegroundColor Green
}

Write-Host "Web: http://localhost:5173" -ForegroundColor Cyan
