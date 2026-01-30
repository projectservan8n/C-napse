# C-napse Installer for Windows
# Run: irm https://raw.githubusercontent.com/projectservan8n/C-napse/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

# Hide cursor during install
[Console]::CursorVisible = $false

function Write-Step {
    param([string]$Step, [string]$Message, [string]$Status = "working")
    $symbol = switch ($Status) {
        "working" { "○" }
        "done"    { "●" }
        "skip"    { "◌" }
        "error"   { "✗" }
    }
    $color = switch ($Status) {
        "working" { "Yellow" }
        "done"    { "Green" }
        "skip"    { "DarkGray" }
        "error"   { "Red" }
    }
    Write-Host "`r  $symbol " -NoNewline -ForegroundColor $color
    Write-Host "[$Step] " -NoNewline -ForegroundColor DarkGray
    Write-Host "$Message                    " -NoNewline -ForegroundColor White
}

Clear-Host
Write-Host ""
Write-Host ""
Write-Host "  ██████╗      ███╗   ██╗ █████╗ ██████╗ ███████╗███████╗" -ForegroundColor Cyan
Write-Host " ██╔════╝      ████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝" -ForegroundColor Cyan
Write-Host " ██║     █████╗██╔██╗ ██║███████║██████╔╝███████╗█████╗  " -ForegroundColor Cyan
Write-Host " ██║     ╚════╝██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝  " -ForegroundColor Cyan
Write-Host " ╚██████╗      ██║ ╚████║██║  ██║██║     ███████║███████╗" -ForegroundColor Cyan
Write-Host "  ╚═════╝      ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "          Your AI-powered PC automation assistant" -ForegroundColor DarkGray
Write-Host ""
Write-Host ""

# Step 1: Check Node.js
Write-Step "1/3" "Checking Node.js..." "working"

$nodeVersion = $null
try {
    $nodeVersion = node --version 2>$null
} catch {}

if ($nodeVersion) {
    $versionNum = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($versionNum -ge 18) {
        Write-Host "`r  ● " -NoNewline -ForegroundColor Green
        Write-Host "[1/3] " -NoNewline -ForegroundColor DarkGray
        Write-Host "Node.js $nodeVersion" -ForegroundColor White
    } else {
        Write-Host "`r  ○ " -NoNewline -ForegroundColor Yellow
        Write-Host "[1/3] " -NoNewline -ForegroundColor DarkGray
        Write-Host "Node.js $nodeVersion (upgrading to v18+)..." -ForegroundColor Yellow
        winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements 2>$null
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Host "`r  ● " -NoNewline -ForegroundColor Green
        Write-Host "[1/3] " -NoNewline -ForegroundColor DarkGray
        Write-Host "Node.js upgraded" -ForegroundColor White
    }
} else {
    Write-Host "`r  ○ " -NoNewline -ForegroundColor Yellow
    Write-Host "[1/3] " -NoNewline -ForegroundColor DarkGray
    Write-Host "Installing Node.js..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements 2>$null
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "`r  ● " -NoNewline -ForegroundColor Green
    Write-Host "[1/3] " -NoNewline -ForegroundColor DarkGray
    Write-Host "Node.js installed" -ForegroundColor White
}
Write-Host ""

# Step 2: Install C-napse globally via npm
Write-Step "2/3" "Installing C-napse..." "working"
Write-Host ""

try {
    npm install -g @opusautomations/cnapse@latest 2>&1 | Out-Null
    Write-Host "`r  ● " -NoNewline -ForegroundColor Green
    Write-Host "[2/3] " -NoNewline -ForegroundColor DarkGray
    Write-Host "C-napse installed" -ForegroundColor White
} catch {
    Write-Host "`r  ✗ " -NoNewline -ForegroundColor Red
    Write-Host "[2/3] " -NoNewline -ForegroundColor DarkGray
    Write-Host "Failed - try: npm install -g @opusautomations/cnapse" -ForegroundColor Red
}
Write-Host ""

# Step 3: Check Ollama (optional)
Write-Step "3/3" "Checking Ollama..." "working"

$ollamaInstalled = Get-Command ollama -ErrorAction SilentlyContinue
if ($ollamaInstalled) {
    Write-Host "`r  ● " -NoNewline -ForegroundColor Green
    Write-Host "[3/3] " -NoNewline -ForegroundColor DarkGray
    Write-Host "Ollama ready (local AI available)" -ForegroundColor White
} else {
    Write-Host "`r  ◌ " -NoNewline -ForegroundColor DarkGray
    Write-Host "[3/3] " -NoNewline -ForegroundColor DarkGray
    Write-Host "Ollama not found (optional)" -ForegroundColor DarkGray
}
Write-Host ""

# Restore cursor
[Console]::CursorVisible = $true

# Done!
Write-Host ""
Write-Host "  ╭──────────────────────────────────────────╮" -ForegroundColor Green
Write-Host "  │                                          │" -ForegroundColor Green
Write-Host "  │   " -NoNewline -ForegroundColor Green
Write-Host "✓ C-napse installed successfully!" -NoNewline -ForegroundColor White
Write-Host "      │" -ForegroundColor Green
Write-Host "  │                                          │" -ForegroundColor Green
Write-Host "  ╰──────────────────────────────────────────╯" -ForegroundColor Green
Write-Host ""
Write-Host "  Quick Setup:" -ForegroundColor White
Write-Host ""
Write-Host "  1. Set your API key (OpenRouter, Anthropic, or OpenAI):" -ForegroundColor DarkGray
Write-Host ""
Write-Host "     cnapse auth openrouter " -NoNewline -ForegroundColor Cyan
Write-Host "YOUR_API_KEY" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Set provider:" -ForegroundColor DarkGray
Write-Host ""
Write-Host "     cnapse config set provider openrouter" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Start chatting:" -ForegroundColor DarkGray
Write-Host ""
Write-Host "     cnapse" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Or use local AI with Ollama (no API key needed):" -ForegroundColor DarkGray
Write-Host ""
Write-Host "     cnapse config set provider ollama" -ForegroundColor Cyan
Write-Host ""
Write-Host ""
