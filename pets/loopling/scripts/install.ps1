$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
$target = Join-Path $codexHome 'pets\loopling'

New-Item -ItemType Directory -Force -Path $target | Out-Null
$staging = Join-Path $target ('.loopling-install-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $staging | Out-Null

try {
    Copy-Item (Join-Path $root 'pet\spritesheet.webp') $staging -Force
    Copy-Item (Join-Path $root 'pet\pet.json') $staging -Force
    foreach ($name in @('spritesheet.webp', 'pet.json')) {
        $source = Join-Path $staging $name
        $destination = Join-Path $target $name
        if (Test-Path -LiteralPath $destination) {
            [System.IO.File]::Replace($source, $destination, $null)
        } else {
            [System.IO.File]::Move($source, $destination)
        }
    }
} finally {
    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Loopling installed to $target"
Write-Host 'Restart ChatGPT, then open Settings -> Pets and select Loopling.'
