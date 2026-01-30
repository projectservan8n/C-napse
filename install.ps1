# C-napse Windows Installer
# One command: irm https://raw.githubusercontent.com/projectservan8n/C-napse/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

# Hide cursor during installation
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

function Write-Progress-Spinner {
    param([string]$Message, [scriptblock]$Action)
    $spinner = @("⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏")
    $job = Start-Job -ScriptBlock $Action
    $i = 0
    while ($job.State -eq "Running") {
        Write-Host "`r    $($spinner[$i % 10]) $Message" -NoNewline -ForegroundColor DarkGray
        Start-Sleep -Milliseconds 100
        $i++
    }
    Write-Host "`r                                                              `r" -NoNewline
    $result = Receive-Job -Job $job
    Remove-Job -Job $job
    return $result
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

# Install location
$installDir = "$env:LOCALAPPDATA\Programs\cnapse"
$exePath = "$installDir\cnapse.exe"

# Create install directory
if (!(Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# Step 1: Download
Write-Step "1/4" "Downloading C-napse..." "working"
$releaseUrl = "https://github.com/projectservan8n/C-napse/releases/latest/download/cnapse-windows-x86_64.exe"
$downloaded = $false

try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $releaseUrl -OutFile $exePath -UseBasicParsing -ErrorAction Stop
    $downloaded = $true
    Write-Step "1/4" "Downloaded C-napse" "done"
    Write-Host ""
} catch {
    Write-Step "1/4" "Building from source..." "working"
    Write-Host ""

    # Check for Rust
    if (!(Get-Command cargo -ErrorAction SilentlyContinue)) {
        Write-Host "    Installing Rust toolchain..." -ForegroundColor DarkGray
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "$env:TEMP\rustup-init.exe" -UseBasicParsing
        Start-Process -FilePath "$env:TEMP\rustup-init.exe" -ArgumentList "-y", "--quiet" -Wait -NoNewWindow
        $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
    }

    # Check for Git
    if (!(Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Host "    Git not found. Please install Git first." -ForegroundColor Red
        Write-Host "    https://git-scm.com/download/win" -ForegroundColor DarkGray
        [Console]::CursorVisible = $true
        exit 1
    }

    # Clone and build (quietly)
    $tempDir = "$env:TEMP\cnapse-build-$([System.Guid]::NewGuid().ToString().Substring(0,8))"

    Write-Host "    Cloning repository..." -ForegroundColor DarkGray
    git clone --quiet --depth 1 https://github.com/projectservan8n/C-napse.git $tempDir 2>$null

    Write-Host "    Compiling (this takes 2-5 minutes)..." -ForegroundColor DarkGray
    Push-Location $tempDir

    # Build with minimal output
    $buildOutput = cargo build --release --quiet 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    Build failed. Error details:" -ForegroundColor Red
        Write-Host $buildOutput -ForegroundColor DarkGray
        Pop-Location
        Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
        [Console]::CursorVisible = $true
        exit 1
    }

    Copy-Item "target\release\cnapse.exe" $exePath -Force
    Pop-Location
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue

    Write-Host "`r  ● " -NoNewline -ForegroundColor Green
    Write-Host "[1/4] " -NoNewline -ForegroundColor DarkGray
    Write-Host "Built C-napse from source" -ForegroundColor White
    Write-Host ""
}

# Step 2: Add to PATH
Write-Step "2/4" "Configuring PATH..." "working"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$installDir", "User")
    $env:Path = "$env:Path;$installDir"
}
Write-Step "2/4" "Added to PATH" "done"
Write-Host ""

# Step 3: Check for Ollama
Write-Step "3/4" "Checking Ollama..." "working"
$ollamaInstalled = Get-Command ollama -ErrorAction SilentlyContinue
if (!$ollamaInstalled) {
    Write-Step "3/4" "Installing Ollama..." "working"
    Write-Host ""

    # Try winget first (silently)
    $wingetResult = winget install Ollama.Ollama --accept-source-agreements --accept-package-agreements --silent 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`r  ● " -NoNewline -ForegroundColor Green
        Write-Host "[3/4] " -NoNewline -ForegroundColor DarkGray
        Write-Host "Installed Ollama" -ForegroundColor White
    } else {
        Write-Host "`r  ◌ " -NoNewline -ForegroundColor DarkGray
        Write-Host "[3/4] " -NoNewline -ForegroundColor DarkGray
        Write-Host "Install Ollama from https://ollama.ai" -ForegroundColor DarkGray
    }
    Write-Host ""
} else {
    Write-Step "3/4" "Ollama ready" "done"
    Write-Host ""
}

# Step 4: Pull default model
Write-Step "4/4" "Setting up AI model..." "working"
if (Get-Command ollama -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "    Downloading qwen2.5:0.5b (~400MB)..." -ForegroundColor DarkGray

    # Run ollama pull with output hidden
    $pullProcess = Start-Process -FilePath "ollama" -ArgumentList "pull", "qwen2.5:0.5b" -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$env:TEMP\ollama-out.txt" -RedirectStandardError "$env:TEMP\ollama-err.txt" 2>$null

    if ($pullProcess.ExitCode -eq 0) {
        Write-Host "`r  ● " -NoNewline -ForegroundColor Green
        Write-Host "[4/4] " -NoNewline -ForegroundColor DarkGray
        Write-Host "AI model ready" -ForegroundColor White
    } else {
        Write-Host "`r  ◌ " -NoNewline -ForegroundColor DarkGray
        Write-Host "[4/4] " -NoNewline -ForegroundColor DarkGray
        Write-Host "Run 'ollama pull qwen2.5:0.5b' later" -ForegroundColor DarkGray
    }
    Write-Host ""

    # Cleanup temp files
    Remove-Item "$env:TEMP\ollama-out.txt" -ErrorAction SilentlyContinue
    Remove-Item "$env:TEMP\ollama-err.txt" -ErrorAction SilentlyContinue
} else {
    Write-Step "4/4" "Skipped (install Ollama first)" "skip"
    Write-Host ""
}

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
Write-Host "  Restart your terminal, then run:" -ForegroundColor DarkGray
Write-Host ""
Write-Host "    cnapse" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Or start with a question:" -ForegroundColor DarkGray
Write-Host ""
Write-Host "    cnapse " -NoNewline -ForegroundColor Cyan
Write-Host '"what files are in this folder?"' -ForegroundColor White
Write-Host ""
Write-Host ""
