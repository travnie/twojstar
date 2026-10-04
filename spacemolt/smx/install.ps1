param(
    [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"

function Invoke-Python {
    param([string[]]$PythonArgs)

    if ($usePyLauncher) {
        & py -3 @PythonArgs
    } else {
        & python @PythonArgs
    }
    if ($LASTEXITCODE -ne 0) { throw "Python command failed." }
}

if (Get-Command uv -ErrorAction SilentlyContinue) {
    Write-Host "Installing smx with uv..."
    & uv tool install --force $PSScriptRoot
    if ($LASTEXITCODE -ne 0) { throw "uv tool install failed." }
    $smxBinDir = & uv tool dir --bin
    if ($LASTEXITCODE -ne 0) { throw "uv tool directory lookup failed." }
} else {
    $usePyLauncher = $null -ne (Get-Command py -ErrorAction SilentlyContinue)
    if (-not $usePyLauncher -and -not (Get-Command python -ErrorAction SilentlyContinue)) {
        throw "Python 3 not found. Install Python or uv."
    }
    Write-Host "Installing smx with pipx..."
    Invoke-Python @("-m", "pip", "install", "--user", "--upgrade", "pipx")
    Invoke-Python @("-m", "pipx", "ensurepath")
    Invoke-Python @("-m", "pipx", "install", "--force", $PSScriptRoot)
    $smxBinDir = if ($usePyLauncher) {
        & py -3 -m pipx environment --value PIPX_BIN_DIR
    } else {
        & python -m pipx environment --value PIPX_BIN_DIR
    }
    if ($LASTEXITCODE -ne 0) { throw "pipx tool directory lookup failed." }
}

if (-not $SkipBackend) {
    & (Join-Path $smxBinDir "smx.exe") backend update
    if ($LASTEXITCODE -ne 0) { throw "Verified backend update failed." }
}

Write-Host ""
Write-Host "Done. Open a new terminal, then run:"
Write-Host "  smx paths"
Write-Host "  smx --help"
