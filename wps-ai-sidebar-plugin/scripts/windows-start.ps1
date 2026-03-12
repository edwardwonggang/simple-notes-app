$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Resolve-Path (Join-Path $scriptDir "..")
$logDir = Join-Path $projectDir ".run"
$timeStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logDir "windows-start-$timeStamp.log"
$configPath = Join-Path $projectDir "config.local.json"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-LogLine {
    param([string]$Text)
    $Text | Tee-Object -FilePath $logFile -Append
}

function Write-Section {
    param([string]$Title)
    Write-LogLine ""
    Write-LogLine "==== $Title ===="
}

function Invoke-LoggedCommand {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    Write-LogLine ""
    Write-LogLine "> $FilePath $($Arguments -join ' ')"
    & $FilePath @Arguments 2>&1 | Tee-Object -FilePath $logFile -Append
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE: $FilePath $($Arguments -join ' ')"
    }
}

function Require-Command {
    param([string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "未找到命令：$Name。请先安装并加入 PATH。"
    }
    return $command
}

function Test-NodeVersion {
    $versionText = (& node -p "process.versions.node").Trim()
    Write-LogLine "Detected Node.js: $versionText"
    $parts = $versionText.Split(".")
    $major = [int]$parts[0]
    $minor = if ($parts.Length -gt 1) { [int]$parts[1] } else { 0 }

    if ($major -lt 18 -or ($major -eq 18 -and $minor -lt 17)) {
        throw "Node.js 版本过低：$versionText。请安装 Node.js 18.17+ 或 20+。"
    }
}

function Show-Failure {
    param([string]$Message)
    Write-LogLine ""
    Write-LogLine "[ERROR] $Message"
    Write-LogLine "Log file: $logFile"
    Write-Host ""
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    Write-Host "日志文件：$logFile" -ForegroundColor Yellow
    Read-Host "按 Enter 关闭窗口"
    exit 1
}

try {
    Set-Location $projectDir

    Write-Section "WPS AI Sidebar Windows Launcher"
    Write-LogLine "Project: $projectDir"
    Write-LogLine "Log: $logFile"

    Write-Section "Environment Check"
    Require-Command "node" | Out-Null
    Require-Command "npm" | Out-Null
    Test-NodeVersion

    $createdConfig = $false
    if (-not (Test-Path (Join-Path $projectDir "node_modules"))) {
        Write-Section "Install Dependencies"
        Invoke-LoggedCommand "npm" @("install")
    } else {
        Write-LogLine "node_modules already exists, skip npm install."
    }

    if (-not (Test-Path $configPath)) {
        $createdConfig = $true
    }

    Write-Section "Register Addon"
    Invoke-LoggedCommand "node" @("scripts/windows-register.mjs")

    if ($createdConfig) {
        Write-LogLine "config.local.json created. Opening Notepad."
        Start-Process notepad.exe $configPath
        Write-Host ""
        Write-Host "已创建 config.local.json，请先填写 API 配置，然后再次运行 windows-start.cmd" -ForegroundColor Yellow
        Write-Host "日志文件：$logFile" -ForegroundColor DarkYellow
        Read-Host "填写完成后按 Enter 关闭窗口"
        exit 0
    }

    Write-Section "Start Local Server"
    Write-Host ""
    Write-Host "本地服务启动中，请保持当前窗口不要关闭。" -ForegroundColor Green
    Write-Host "如果服务中途退出，日志文件在：$logFile" -ForegroundColor DarkYellow
    Invoke-LoggedCommand "npm" @("run", "dev", "--", "--host", "127.0.0.1", "--port", "3889")

    Write-Host ""
    Write-Host "本地服务已退出。日志文件：$logFile" -ForegroundColor Yellow
    Read-Host "按 Enter 关闭窗口"
    exit 0
}
catch {
    $message = $_.Exception.Message
    Show-Failure $message
}
