# C-napse Windows Installation Script
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install.ps1

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  C-napse Installer for Windows" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

# Check for Rust
if (!(Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Rust not found. Please install from https://rustup.rs" -ForegroundColor Red
    Write-Host "    Run: winget install Rustlang.Rustup" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Rust found" -ForegroundColor Green

# Check for Ollama
if (!(Get-Command ollama -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Ollama not found. Please install from https://ollama.ai" -ForegroundColor Yellow
    Write-Host "    Run: winget install Ollama.Ollama" -ForegroundColor Yellow
    Write-Host "    Continuing anyway..." -ForegroundColor Yellow
} else {
    Write-Host "[OK] Ollama found" -ForegroundColor Green
}

# Build release
Write-Host ""
Write-Host "Building C-napse (this may take a few minutes)..." -ForegroundColor Cyan
cargo build --release

if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Build successful" -ForegroundColor Green

# Install location
$installDir = "$env:LOCALAPPDATA\Programs\cnapse"
Write-Host ""
Write-Host "Installing to: $installDir" -ForegroundColor Cyan

# Create install directory
if (!(Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# Copy binaries
Copy-Item "target\release\cnapse.exe" "$installDir\cnapse.exe" -Force
Copy-Item "target\release\cn.exe" "$installDir\cn.exe" -Force
Copy-Item "target\release\c.exe" "$installDir\c.exe" -Force

Write-Host "[OK] Binaries installed" -ForegroundColor Green

# Add to PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$installDir", "User")
    Write-Host "[OK] Added to PATH" -ForegroundColor Green
    Write-Host "    NOTE: Restart your terminal for PATH changes to take effect" -ForegroundColor Yellow
} else {
    Write-Host "[OK] Already in PATH" -ForegroundColor Green
}

# Pull Ollama models
Write-Host ""
Write-Host "Pulling Ollama models (this may take a while)..." -ForegroundColor Cyan
if (Get-Command ollama -ErrorAction SilentlyContinue) {
    ollama pull qwen2.5:0.5b
    ollama pull qwen2.5-coder:1.5b
    Write-Host "[OK] Models downloaded" -ForegroundColor Green
} else {
    Write-Host "[!] Skipped - Ollama not installed" -ForegroundColor Yellow
}

# Initialize config
Write-Host ""
Write-Host "Initializing C-napse..." -ForegroundColor Cyan
& "$installDir\cnapse.exe" init 2>$null
Write-Host "[OK] Configuration created" -ForegroundColor Green

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Usage:" -ForegroundColor Cyan
Write-Host "  c          - Launch interactive TUI" -ForegroundColor White
Write-Host "  cn         - Launch interactive TUI" -ForegroundColor White
Write-Host "  cnapse     - Launch interactive TUI" -ForegroundColor White
Write-Host '  c "query"  - Quick query mode' -ForegroundColor White
Write-Host ""
Write-Host "Restart your terminal, then run: c" -ForegroundColor Yellow
