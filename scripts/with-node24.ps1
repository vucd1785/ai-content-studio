# Chạy lệnh dưới Node.js 24 (fnm store trên E:). Không đổi PATH hệ thống hay fnm default.
# Ví dụ: .\scripts\with-node24.ps1 pnpm run typecheck
# Ví dụ: .\scripts\with-node24.ps1 node -p "process.version + ' | ' + process.execPath"

param(
	[Parameter(ValueFromRemainingArguments = $true)]
	[string[]]$Command
)

$ErrorActionPreference = "Stop"

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
	Write-Error "Không tìm thấy fnm trên PATH. Cài fnm hoặc đặt biến FNM_EXE trỏ tới fnm.exe."
}

if ($Command.Count -eq 0) {
	Write-Error "Usage: scripts/with-node24.ps1 <command...>"
}

function Escape-CmdToken {
	param([string]$Text)
	if ($Text -match '[\s&|<>^"]') {
		return '"' + ($Text -replace '"', '""') + '"'
	}
	return $Text
}

$launch = [string[]]$Command.Clone()
$corepackTools = @("pnpm", "pnpx", "yarn", "yarnpkg")
if ($launch[0] -in $corepackTools) {
	$launch = @("corepack") + $launch
}

$cmdLine = ($launch | ForEach-Object { Escape-CmdToken $_ }) -join " "

& $fnmExe --fnm-dir $FnmDir exec --using=$NodeMajor -- cmd /c $cmdLine
exit $LASTEXITCODE
