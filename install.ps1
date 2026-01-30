# C-napse Windows Installer
# One command: irm https://raw.githubusercontent.com/projectservan8n/C-napse/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ██████╗      ███╗   ██╗ █████╗ ██████╗ ███████╗███████╗" -ForegroundColor Cyan
Write-Host " ██╔════╝      ████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝" -ForegroundColor Cyan
Write-Host " ██║     █████╗██╔██╗ ██║███████║██████╔╝███████╗█████╗  " -ForegroundColor Cyan
Write-Host " ██║     ╚════╝██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝  " -ForegroundColor Cyan
Write-Host " ╚██████╗      ██║ ╚████║██║  ██║██║     ███████║███████╗" -ForegroundColor Cyan
Write-Host "  ╚═════╝      ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "                    Installing C-napse..." -ForegroundColor White
Write-Host ""

# Install location
$installDir = "$env:LOCALAPPDATA\Programs\cnapse"
$exePath = "$installDir\cnapse.exe"

# Create install directory
if (!(Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# Download latest release
Write-Host "[1/4] Downloading cnapse..." -ForegroundColor Yellow
$releaseUrl = "https://github.com/projectservan8n/C-napse/releases/latest/download/cnapse-windows-x86_64.exe"
try {
    Invoke-WebRequest -Uri $releaseUrl -OutFile $exePath -UseBasicParsing
    Write-Host "      Done" -ForegroundColor Green
} catch {
    Write-Host "      Release not ready yet. Building from source..." -ForegroundColor Yellow

    # Check for Rust
    if (!(Get-Command cargo -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "[!] Rust not found. Installing..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "$env:TEMP\rustup-init.exe"
        Start-Process -FilePath "$env:TEMP\rustup-init.exe" -ArgumentList "-y" -Wait
        $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
    }

    # Clone and build
    $tempDir = "$env:TEMP\cnapse-build"
    if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
    git clone https://github.com/projectservan8n/C-napse.git $tempDir
    Push-Location $tempDir
    cargo build --release
    Copy-Item "target\release\cnapse.exe" $exePath
    Pop-Location
    Remove-Item -Recurse -Force $tempDir
    Write-Host "      Built successfully" -ForegroundColor Green
}

# Add to PATH
Write-Host "[2/4] Adding to PATH..." -ForegroundColor Yellow
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$installDir", "User")
    $env:Path = "$env:Path;$installDir"
}
Write-Host "      Done" -ForegroundColor Green

# Check for Ollama
Write-Host "[3/4] Checking Ollama..." -ForegroundColor Yellow
if (!(Get-Command ollama -ErrorAction SilentlyContinue)) {
    Write-Host "      Installing Ollama..." -ForegroundColor Yellow
    winget install Ollama.Ollama --accept-source-agreements --accept-package-agreements 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      Please install Ollama from https://ollama.ai" -ForegroundColor Yellow
    }
} else {
    Write-Host "      Found" -ForegroundColor Green
}

# Pull models
Write-Host "[4/4] Pulling AI models (this may take a minute)..." -ForegroundColor Yellow
if (Get-Command ollama -ErrorAction SilentlyContinue) {
    Start-Process ollama -ArgumentList "pull qwen2.5:0.5b" -NoNewWindow -Wait 2>$null
    Write-Host "      Done" -ForegroundColor Green
} else {
    Write-Host "      Skipped (install Ollama first)" -ForegroundColor Yellow
}

# Done
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  C-napse installed successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Restart your terminal, then run:" -ForegroundColor White
Write-Host ""
Write-Host "    cnapse" -ForegroundColor Cyan
Write-Host ""
