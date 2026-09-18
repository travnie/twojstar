param(
    [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"

$usePyLauncher = $null -ne (Get-Command py -ErrorAction SilentlyContinue)
if (-not $usePyLauncher -and -not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python 3 not found."
}

function Invoke-Python {
    param([string[]]$PythonArgs)

    if ($usePyLauncher) {
        & py -3 @PythonArgs
    } else {
        & python @PythonArgs
    }
    if ($LASTEXITCODE -ne 0) { throw "Python command failed." }
}

Write-Host "Installing smx with pipx..."
Invoke-Python @("-m", "pip", "install", "--user", "--upgrade", "pipx")
Invoke-Python @("-m", "pipx", "ensurepath")
Invoke-Python @("-m", "pipx", "install", "--force", $PSScriptRoot)

if (-not $SkipBackend) {
    if ($env:PROCESSOR_ARCHITECTURE -notin @("AMD64", "x86_64")) {
        throw "Official SpaceMolt client-v2 currently has no Windows ARM64 asset."
    }

    if ($env:SMX_STATE_DIR) {
        $stateDir = [Environment]::ExpandEnvironmentVariables($env:SMX_STATE_DIR)
    } elseif ($env:LOCALAPPDATA) {
        $stateDir = Join-Path $env:LOCALAPPDATA "smx"
    } else {
        $stateDir = Join-Path $HOME "AppData\Local\smx"
    }

    $binDir = Join-Path $stateDir "bin"
    $backend = Join-Path $binDir "spacemolt.exe"
    New-Item -ItemType Directory -Force $binDir | Out-Null

    $url = "https://github.com/SpaceMolt/client-v2/releases/latest/download/spacemolt-client-v2-windows-x64.exe"
    Write-Host "Installing official SpaceMolt v2 backend..."
    Invoke-WebRequest -Uri $url -OutFile $backend
    Write-Host "Backend: $backend"
}

Write-Host ""
Write-Host "Done. Open a new terminal, then run:"
Write-Host "  smx paths"
Write-Host "  smx --help"
