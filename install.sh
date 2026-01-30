#!/bin/bash
# C-napse Installer for macOS/Linux
# One command: curl -fsSL https://raw.githubusercontent.com/projectservan8n/C-napse/main/install.sh | bash

set -e

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
DIM='\033[0;90m'
NC='\033[0m' # No Color

# Print logo
echo ""
echo -e "${CYAN}  ██████╗      ███╗   ██╗ █████╗ ██████╗ ███████╗███████╗${NC}"
echo -e "${CYAN} ██╔════╝      ████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝${NC}"
echo -e "${CYAN} ██║     █████╗██╔██╗ ██║███████║██████╔╝███████╗█████╗  ${NC}"
echo -e "${CYAN} ██║     ╚════╝██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝  ${NC}"
echo -e "${CYAN} ╚██████╗      ██║ ╚████║██║  ██║██║     ███████║███████╗${NC}"
echo -e "${CYAN}  ╚═════╝      ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝${NC}"
echo ""
echo -e "${DIM}          Your AI-powered PC automation assistant${NC}"
echo ""

# Step 1: Check Node.js
echo -e "  ${YELLOW}○${NC} ${DIM}[1/3]${NC} Checking Node.js..."

NODE_VERSION=""
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
fi

if [[ -n "$NODE_VERSION" ]] && [[ "$NODE_VERSION" -ge 18 ]]; then
    echo -e "\r  ${GREEN}●${NC} ${DIM}[1/3]${NC} Node.js v$(node --version | cut -d'v' -f2)"
else
    echo -e "\r  ${YELLOW}○${NC} ${DIM}[1/3]${NC} Installing Node.js..."

    # Detect OS for node installation
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - use brew if available, otherwise use nvm
        if command -v brew &> /dev/null; then
            brew install node@20 > /dev/null 2>&1
            brew link --overwrite node@20 > /dev/null 2>&1 || true
        else
            echo -e "    ${DIM}Installing via nvm...${NC}"
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash > /dev/null 2>&1
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
            nvm install 20 > /dev/null 2>&1
            nvm use 20 > /dev/null 2>&1
        fi
    else
        # Linux - use NodeSource
        if command -v apt-get &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
            sudo apt-get install -y nodejs > /dev/null 2>&1
        elif command -v dnf &> /dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - > /dev/null 2>&1
            sudo dnf install -y nodejs > /dev/null 2>&1
        elif command -v pacman &> /dev/null; then
            sudo pacman -S --noconfirm nodejs npm > /dev/null 2>&1
        else
            echo -e "    ${RED}Please install Node.js 18+ manually: https://nodejs.org${NC}"
            exit 1
        fi
    fi

    echo -e "\r  ${GREEN}●${NC} ${DIM}[1/3]${NC} Node.js installed"
fi

# Step 2: Install C-napse via npm
echo -e "  ${YELLOW}○${NC} ${DIM}[2/3]${NC} Installing C-napse..."

if npm install -g @projectservan8n/cnapse@latest > /dev/null 2>&1; then
    echo -e "\r  ${GREEN}●${NC} ${DIM}[2/3]${NC} C-napse installed"
else
    echo -e "\r  ${RED}✗${NC} ${DIM}[2/3]${NC} ${RED}Failed - try: npm install -g @projectservan8n/cnapse${NC}"
    exit 1
fi

# Step 3: Check for Ollama (optional)
echo -e "  ${YELLOW}○${NC} ${DIM}[3/3]${NC} Checking Ollama..."

if command -v ollama &> /dev/null; then
    echo -e "\r  ${GREEN}●${NC} ${DIM}[3/3]${NC} Ollama ready (local AI available)"
else
    echo -e "\r  ${DIM}◌${NC} ${DIM}[3/3]${NC} ${DIM}Ollama not found (optional)${NC}"
fi

# Done!
echo ""
echo -e "  ${GREEN}╭──────────────────────────────────────────╮${NC}"
echo -e "  ${GREEN}│${NC}                                          ${GREEN}│${NC}"
echo -e "  ${GREEN}│${NC}   ✓ C-napse installed successfully!      ${GREEN}│${NC}"
echo -e "  ${GREEN}│${NC}                                          ${GREEN}│${NC}"
echo -e "  ${GREEN}╰──────────────────────────────────────────╯${NC}"
echo ""
echo -e "  ${DIM}Quick Setup:${NC}"
echo ""
echo -e "  1. Set your API key (OpenRouter, Anthropic, or OpenAI):"
echo ""
echo -e "     ${CYAN}cnapse auth openrouter${NC} ${YELLOW}YOUR_API_KEY${NC}"
echo ""
echo -e "  2. Set provider:"
echo ""
echo -e "     ${CYAN}cnapse config set provider openrouter${NC}"
echo ""
echo -e "  3. Start chatting:"
echo ""
echo -e "     ${CYAN}cnapse${NC}"
echo ""
echo -e "  Or use local AI with Ollama (no API key needed):"
echo ""
echo -e "     ${CYAN}cnapse config set provider ollama${NC}"
echo ""
