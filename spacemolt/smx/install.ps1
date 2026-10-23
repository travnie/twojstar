param(
    [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"

function Invoke-Python {
    param([string[]]$PythonArgs)

    & $pythonExe @PythonArgs
    if ($LASTEXITCODE -ne 0) { throw "Python command failed." }
}

if (Get-Command uv -ErrorAction SilentlyContinue) {
    Write-Host "Installing smx with uv..."
    & uv tool install --force $PSScriptRoot
    if ($LASTEXITCODE -ne 0) { throw "uv tool install failed." }
    $smxBinDir = & uv tool dir --bin
    if ($LASTEXITCODE -ne 0) { throw "uv tool directory lookup failed." }
} else {
    # Resolve a compatible interpreter even if the system default is older.
    $pythonCandidates = @()
    if (Get-Command py -ErrorAction SilentlyContinue) {
        try {
            $pythonCandidates += @(& py -3 -c "import sys; print(sys.executable)" 2>$null)
        } catch {}
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        try {
            $pythonCandidates += @(& python -c "import sys; print(sys.executable)" 2>$null)
        } catch {}
    }
    $pythonExe = $null
    foreach ($candidate in $pythonCandidates) {
        if (-not $candidate) { continue }
        & $candidate -c "import sys; sys.exit(sys.version_info < (3, 14))" 2>$null
        if ($LASTEXITCODE -eq 0) {
            $pythonExe = $candidate
            break
        }
    }
    if (-not $pythonExe) {
        throw "smx requires Python 3.14 or newer (or uv)."
    }
    Write-Host "Installing smx with pipx..."
    Invoke-Python @("-m", "pip", "install", "--user", "--upgrade", "pipx")
    Invoke-Python @("-m", "pipx", "ensurepath")
    Invoke-Python @("-m", "pipx", "install", "--python", $pythonExe, "--force", $PSScriptRoot)
    $smxBinDir = & $pythonExe -m pipx environment --value PIPX_BIN_DIR
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
