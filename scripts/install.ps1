#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$repo = "yourusername/cnapse"
$installDir = "$env:LOCALAPPDATA\cnapse\bin"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                          ║" -ForegroundColor Cyan
Write-Host "║   ██████╗      ███╗   ██╗ █████╗ ██████╗ ███████╗███████╗║" -ForegroundColor Cyan
Write-Host "║  ██╔════╝      ████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝║" -ForegroundColor Cyan
Write-Host "║  ██║     █████╗██╔██╗ ██║███████║██████╔╝███████╗█████╗  ║" -ForegroundColor Cyan
Write-Host "║  ██║     ╚════╝██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝  ║" -ForegroundColor Cyan
Write-Host "║  ╚██████╗      ██║ ╚████║██║  ██║██║     ███████║███████╗║" -ForegroundColor Cyan
Write-Host "║   ╚═════╝      ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝║" -ForegroundColor Cyan
Write-Host "║                                                          ║" -ForegroundColor Cyan
Write-Host "║                     agents in sync                       ║" -ForegroundColor Cyan
Write-Host "║                                                          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  C-napse Installer" -ForegroundColor Green
Write-Host ""

# Detect architecture
$arch = if ([Environment]::Is64BitOperatingSystem) { "x86_64" } else { "i686" }
$binary = "cnapse-windows-${arch}.exe"

Write-Host "-> Detected: windows/${arch}"

# Get latest release
Write-Host "-> Fetching latest release..."
try {
    $release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
    $version = $release.tag_name
    Write-Host "-> Latest version: $version"
} catch {
    Write-Host "Failed to fetch release info" -ForegroundColor Red
    exit 1
}

# Download
$url = "https://github.com/$repo/releases/download/$version/$binary"
$tmpFile = "$env:TEMP\cnapse.exe"

Write-Host "-> Downloading..."
try {
    Invoke-WebRequest -Uri $url -OutFile $tmpFile -UseBasicParsing
} catch {
    Write-Host "Download failed: $_" -ForegroundColor Red
    exit 1
}

# Install
Write-Host "-> Installing to $installDir"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Move-Item -Force $tmpFile "$installDir\cnapse.exe"

# Add to PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$installDir", "User")
    Write-Host "-> Added to PATH (restart terminal to use)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✓ C-napse installed!" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:"
Write-Host "    cnapse init            # Initialize config" -ForegroundColor Cyan
Write-Host "    cnapse auth anthropic  # Add API key (optional)" -ForegroundColor Cyan
Write-Host "    cnapse                 # Start REPL" -ForegroundColor Cyan
Write-Host ""
