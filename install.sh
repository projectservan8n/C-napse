#!/bin/bash
# C-napse Installer for macOS/Linux
# One command: curl -fsSL https://raw.githubusercontent.com/projectservan8n/C-napse/main/install.sh | bash

set -e

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
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

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
    linux*)  OS="linux" ;;
    darwin*) OS="macos" ;;
    *)       echo "Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
    x86_64)  ARCH="x86_64" ;;
    aarch64) ARCH="aarch64" ;;
    arm64)   ARCH="aarch64" ;;
    *)       echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

BINARY="cnapse-${OS}-${ARCH}"
INSTALL_DIR="${HOME}/.local/bin"
RELEASE_URL="https://github.com/projectservan8n/C-napse/releases/latest/download/${BINARY}"

# Create install directory
mkdir -p "$INSTALL_DIR"

# Step 1: Download
echo -e "  ${YELLOW}○${NC} ${DIM}[1/3]${NC} Downloading C-napse..."

if curl -fsSL "$RELEASE_URL" -o "${INSTALL_DIR}/cnapse" 2>/dev/null; then
    chmod +x "${INSTALL_DIR}/cnapse"
    echo -e "\r  ${GREEN}●${NC} ${DIM}[1/3]${NC} Downloaded C-napse"
else
    echo -e "\r  ${YELLOW}○${NC} ${DIM}[1/3]${NC} Building from source..."

    # Check for Rust
    if ! command -v cargo &> /dev/null; then
        echo -e "    ${DIM}Installing Rust toolchain...${NC}"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --quiet
        source "$HOME/.cargo/env"
    fi

    # Check for Git
    if ! command -v git &> /dev/null; then
        echo -e "    ${YELLOW}Git not found. Please install git first.${NC}"
        exit 1
    fi

    # Clone and build
    TEMP_DIR=$(mktemp -d)
    echo -e "    ${DIM}Cloning repository...${NC}"
    git clone --quiet --depth 1 https://github.com/projectservan8n/C-napse.git "$TEMP_DIR"

    echo -e "    ${DIM}Compiling (this takes 2-5 minutes)...${NC}"
    cd "$TEMP_DIR"
    cargo build --release --quiet 2>/dev/null

    cp target/release/cnapse "${INSTALL_DIR}/cnapse"
    chmod +x "${INSTALL_DIR}/cnapse"

    cd - > /dev/null
    rm -rf "$TEMP_DIR"

    echo -e "\r  ${GREEN}●${NC} ${DIM}[1/3]${NC} Built C-napse from source"
fi

# Step 2: Add to PATH
echo -e "  ${YELLOW}○${NC} ${DIM}[2/3]${NC} Configuring PATH..."

# Detect shell and config file
SHELL_NAME=$(basename "$SHELL")
case "$SHELL_NAME" in
    bash)
        if [[ -f "$HOME/.bashrc" ]]; then
            SHELL_RC="$HOME/.bashrc"
        else
            SHELL_RC="$HOME/.bash_profile"
        fi
        ;;
    zsh)  SHELL_RC="$HOME/.zshrc" ;;
    fish) SHELL_RC="$HOME/.config/fish/config.fish" ;;
    *)    SHELL_RC="$HOME/.profile" ;;
esac

# Add to PATH if not already there
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    if [[ "$SHELL_NAME" == "fish" ]]; then
        echo "set -gx PATH \$PATH $INSTALL_DIR" >> "$SHELL_RC"
    else
        echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$SHELL_RC"
    fi
    export PATH="$PATH:$INSTALL_DIR"
fi

echo -e "\r  ${GREEN}●${NC} ${DIM}[2/3]${NC} Added to PATH"

# Step 3: Check for Ollama
echo -e "  ${YELLOW}○${NC} ${DIM}[3/3]${NC} Checking Ollama..."

if command -v ollama &> /dev/null; then
    echo -e "\r  ${GREEN}●${NC} ${DIM}[3/3]${NC} Ollama ready"

    # Pull default model
    echo -e "    ${DIM}Downloading qwen2.5:0.5b (~400MB)...${NC}"
    ollama pull qwen2.5:0.5b > /dev/null 2>&1 || true
else
    echo -e "\r  ${DIM}◌${NC} ${DIM}[3/3]${NC} ${DIM}Install Ollama from https://ollama.ai${NC}"
fi

# Done!
echo ""
echo -e "  ${GREEN}╭──────────────────────────────────────────╮${NC}"
echo -e "  ${GREEN}│${NC}                                          ${GREEN}│${NC}"
echo -e "  ${GREEN}│${NC}   ✓ C-napse installed successfully!      ${GREEN}│${NC}"
echo -e "  ${GREEN}│${NC}                                          ${GREEN}│${NC}"
echo -e "  ${GREEN}╰──────────────────────────────────────────╯${NC}"
echo ""
echo -e "  ${DIM}Restart your terminal, then run:${NC}"
echo ""
echo -e "    ${CYAN}cnapse${NC}"
echo ""
echo -e "  ${DIM}Or start with a question:${NC}"
echo ""
echo -e "    ${CYAN}cnapse${NC} \"what files are in this folder?\""
echo ""
