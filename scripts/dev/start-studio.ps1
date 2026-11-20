# Mở Docker Desktop (nếu chưa mở), bật postgres, redis, tts rồi chạy API, worker, web.
# Mặc định chạy ngầm (không cửa sổ), log ở data/logs/studio-<tên>.log, PID ở data/logs/studio-<tên>.pid.
# Ví dụ:
#   .\scripts\dev\start-studio.ps1                     # bật mọi thứ, chạy ngầm
#   .\scripts\dev\start-studio.ps1 -Only worker        # chỉ bật lại worker
#   .\scripts\dev\start-studio.ps1 -Only api,web -NoDocker
#   .\scripts\dev\start-studio.ps1 -Windows            # mỗi tiến trình một cửa sổ PowerShell (cách cũ)
# Dừng: .\scripts\dev\stop-studio.ps1 (hoặc stop-studio.cmd). Tiến trình đang chạy thì bỏ qua, không mở trùng.

param(
	[ValidateSet("api", "worker", "web")]
	[string[]]$Only = @("api", "worker", "web"),
	[switch]$NoDocker,
	[switch]$Windows
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$WithNode = Join-Path $RepoRoot "scripts\with-node24.ps1"
$LogDir = Join-Path $RepoRoot "data\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# PowerShell 5.1 với ErrorActionPreference = Stop biến stderr của lệnh native thành lỗi dừng script
# (Docker chưa chạy thì `docker info` ghi stderr). Gọi qua cmd để chỉ đọc mã thoát.
function Invoke-Quiet([string]$commandLine) {
	cmd /c "$commandLine >nul 2>&1"
	return $LASTEXITCODE -eq 0
}

function Get-ContainerHealth([string]$container) {
	$out = cmd /c "docker inspect -f {{.State.Health.Status}} $container 2>nul"
	if ($LASTEXITCODE -ne 0) { return "chưa có" }
	return "$out".Trim()
}

# Docker Desktop mở nhưng engine trong máy ảo không phản hồi thì `docker info` treo mãi: giới hạn 20 giây mỗi lần thử.
function Test-DockerReady {
	$proc = Start-Process cmd -ArgumentList "/c docker info >nul 2>&1" -WindowStyle Hidden -PassThru
	if (-not $proc.WaitForExit(20000)) {
		taskkill /PID $proc.Id /T /F *> $null
		return $false
	}
	return $proc.ExitCode -eq 0
}

function Test-DockerDesktopRunning {
	return [bool](Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue)
}

function Find-DockerDesktop {
	$candidates = @()
	$cli = Get-Command docker -ErrorAction SilentlyContinue
	if ($cli) {
		# ...\DockerDesktop\resources\bin\docker.exe -> ...\DockerDesktop\Docker Desktop.exe
		$candidates += Join-Path (Split-Path (Split-Path (Split-Path $cli.Source))) "Docker Desktop.exe"
	}
	$candidates += Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\Docker Desktop.exe"
	$candidates += Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
	return $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

if (-not $NoDocker) {
	if (-not (Test-DockerReady)) {
		if (Test-DockerDesktopRunning) {
			Write-Host "Docker Desktop đang mở nhưng engine chưa phản hồi, chờ thêm..." -ForegroundColor Cyan
		} else {
			$desktop = Find-DockerDesktop
			if (-not $desktop) { throw "Không tìm thấy Docker Desktop. Hãy mở Docker Desktop bằng tay rồi chạy lại." }
			Write-Host "Mở Docker Desktop..." -ForegroundColor Cyan
			Start-Process -FilePath $desktop
		}
		$deadline = (Get-Date).AddMinutes(5)
		while (-not (Test-DockerReady)) {
			if ((Get-Date) -gt $deadline) {
				throw ("Docker chưa phản hồi sau 5 phút. Engine trong máy ảo có thể bị treo: " +
					"trong Docker Desktop chọn biểu tượng con bọ (Troubleshoot) > Restart, " +
					"hoặc thoát hẳn Docker Desktop, chạy 'wsl --shutdown' rồi mở lại. Sau đó chạy lại script này.")
			}
			Write-Host "  chờ Docker khởi động..." -ForegroundColor DarkGray
			Start-Sleep -Seconds 5
		}
	}
	Write-Host "Docker sẵn sàng. Bật postgres, redis, tts..." -ForegroundColor Cyan
	Push-Location $RepoRoot
	try {
		# docker compose in tiến độ ra stderr: cho phép stderr trong lúc gọi, chỉ xét mã thoát.
		$ErrorActionPreference = "Continue"
		cmd /c "docker compose --profile cpu up -d postgres redis tts 2>&1"
		$ErrorActionPreference = "Stop"
		if ($LASTEXITCODE -ne 0) { throw "docker compose lỗi." }
	} finally {
		Pop-Location
	}

	# tts nạp model mất vài phút; worker cần tts healthy trước bước giọng đọc.
	$deadline = (Get-Date).AddMinutes(10)
	foreach ($name in @("postgres", "redis", "tts")) {
		do {
			$health = Get-ContainerHealth "ai-content-studio-$name-1"
			if ($health -eq "healthy") { break }
			Write-Host "  chờ $name ($health)..." -ForegroundColor DarkGray
			Start-Sleep -Seconds 5
		} while ((Get-Date) -lt $deadline)
		if ($health -ne "healthy") { throw "$name chưa healthy sau 10 phút: docker logs ai-content-studio-$name-1" }
		Write-Host "  $name healthy" -ForegroundColor Green
	}
}

$processes = [ordered]@{
	api    = @{ Dir = "apps\api"; Cmd = @("node", "--env-file=..\..\.env", "--import", "tsx", "src/main.ts"); Port = 3001 }
	worker = @{ Dir = "apps\worker"; Cmd = @("node", "--env-file-if-exists=..\..\.env", "--import", "tsx", "src/queue/run-worker.ts"); Port = $null }
	web    = @{ Dir = "apps\web"; Cmd = @("pnpm", "run", "dev"); Port = 5173 }
}

function Test-Running([string]$name, $p) {
	if ($null -ne $p.Port) {
		if (Get-NetTCPConnection -State Listen -LocalPort $p.Port -ErrorAction SilentlyContinue) { return $true }
	}
	$pidFile = Join-Path $LogDir "studio-$name.pid"
	if (Test-Path -LiteralPath $pidFile) {
		$id = [int](Get-Content -LiteralPath $pidFile -Raw)
		if (Get-Process -Id $id -ErrorAction SilentlyContinue) { return $true }
	}
	return $false
}

foreach ($name in $processes.Keys) {
	if ($Only -notcontains $name) { continue }
	$p = $processes[$name]
	$dir = Join-Path $RepoRoot $p.Dir
	if (Test-Running $name $p) {
		Write-Host "'$name' đang chạy, bỏ qua." -ForegroundColor Yellow
		continue
	}
	if ($Windows) {
		$inner = "`$Host.UI.RawUI.WindowTitle = 'studio: $name'; Set-Location -LiteralPath '$dir'; & '$WithNode' $($p.Cmd -join ' ')"
		Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $inner)
		Write-Host "Đã mở cửa sổ '$name'" -ForegroundColor Green
		continue
	}
	$log = Join-Path $LogDir "studio-$name.log"
	$errLog = Join-Path $LogDir "studio-$name.err.log"
	# Start-Process ghép tham số bằng dấu cách, không tự thêm ngoặc kép: bọc đường dẫn để chịu được dấu cách.
	$psArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$WithNode`"") + $p.Cmd
	$proc = Start-Process powershell -ArgumentList $psArgs -WorkingDirectory $dir -WindowStyle Hidden `
		-RedirectStandardOutput $log -RedirectStandardError $errLog -PassThru
	Set-Content -LiteralPath (Join-Path $LogDir "studio-$name.pid") -Value $proc.Id -Encoding ascii
	Write-Host "Đã chạy ngầm '$name' (PID $($proc.Id)), log: data\logs\studio-$name.log" -ForegroundColor Green
}

Write-Host "Web: http://localhost:5173" -ForegroundColor Cyan
