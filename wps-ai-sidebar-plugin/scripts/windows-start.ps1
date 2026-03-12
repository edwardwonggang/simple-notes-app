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

    if ($FilePath -in @("npm", "npm.cmd", "npx", "npx.cmd")) {
        & cmd.exe /d /c $FilePath $Arguments 2>&1 | Tee-Object -FilePath $logFile -Append
    }
    else {
        & $FilePath $Arguments 2>&1 | Tee-Object -FilePath $logFile -Append
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
    }
}

function Require-Command {
    param([string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Required command not found: $Name. Please install it and add it to PATH."
    }

    return $command
}

function Test-NodeVersion {
    $versionText = (node -p "process.versions.node" | Out-String).Trim()
    Write-LogLine "Detected Node.js: $versionText"

    $parts = $versionText.Split(".")
    $major = [int]$parts[0]
    $minor = if ($parts.Length -gt 1) { [int]$parts[1] } else { 0 }

    if ($major -lt 18 -or ($major -eq 18 -and $minor -lt 17)) {
        throw "Node.js version is too old: $versionText. Please install Node.js 18.17+ or 20+."
    }
}

function Test-NpmDependencies {
    Write-LogLine ""
    Write-LogLine "> npm ls --depth=0"
    & cmd.exe /d /c npm ls --depth=0 2>&1 | Tee-Object -FilePath $logFile -Append
    return ($LASTEXITCODE -eq 0)
}

function Stop-ExistingDevServer {
    param([int]$Port)

    $listeners = Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in @($listeners)) {
        $processId = $listener.OwningProcess
        if (-not $processId) {
            continue
        }

        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
        if (-not $process) {
            continue
        }

        $commandLine = [string]$process.CommandLine
        if ($process.Name -eq "node.exe" -and $commandLine -like "*vite*" -and $commandLine -like "*$projectDir*") {
            Write-LogLine "Stopping existing dev server on port ${Port} (PID ${processId})."
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Start-Sleep -Milliseconds 500
        }
    }
}

function Show-Failure {
    param([string]$Message)

    Write-LogLine ""
    Write-LogLine "[ERROR] $Message"
    Write-LogLine "Log file: $logFile"

    Write-Host ""
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    Write-Host "Log file: $logFile" -ForegroundColor Yellow
    Read-Host "Press Enter to close this window"
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
    }
    elseif (-not (Test-NpmDependencies)) {
        Write-Section "Repair Dependencies"
        Invoke-LoggedCommand "npm" @("install")
    }
    else {
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
        Write-Host "Created config.local.json. Fill in the API settings, then run windows-start.cmd again." -ForegroundColor Yellow
        Write-Host "Log file: $logFile" -ForegroundColor DarkYellow
        Read-Host "Press Enter to close this window after editing"
        exit 0
    }

    Write-Section "Start Local Server"
    Stop-ExistingDevServer -Port 3889
    Write-Host ""
    Write-Host "Starting local server. Keep this window open." -ForegroundColor Green
    Write-Host "If the server exits, check the log file: $logFile" -ForegroundColor DarkYellow

    Invoke-LoggedCommand "npm" @("run", "dev", "--", "--host", "127.0.0.1", "--port", "3889")

    Write-Host ""
    Write-Host "Local server stopped. Log file: $logFile" -ForegroundColor Yellow
    Read-Host "Press Enter to close this window"
    exit 0
}
catch {
    $message = $_.Exception.Message
    Show-Failure $message
}
