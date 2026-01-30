#!/bin/sh
set -e

REPO="yourusername/cnapse"
INSTALL_DIR="${CNAPSE_INSTALL_DIR:-$HOME/.local/bin}"
CONFIG_DIR="$HOME/.cnapse"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo "${CYAN}║                                                          ║${NC}"
echo "${CYAN}║   ██████╗      ███╗   ██╗ █████╗ ██████╗ ███████╗███████╗║${NC}"
echo "${CYAN}║  ██╔════╝      ████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝║${NC}"
echo "${CYAN}║  ██║     █████╗██╔██╗ ██║███████║██████╔╝███████╗█████╗  ║${NC}"
echo "${CYAN}║  ██║     ╚════╝██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝  ║${NC}"
echo "${CYAN}║  ╚██████╗      ██║ ╚████║██║  ██║██║     ███████║███████╗║${NC}"
echo "${CYAN}║   ╚═════╝      ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝║${NC}"
echo "${CYAN}║                                                          ║${NC}"
echo "${CYAN}║                     agents in sync                       ║${NC}"
echo "${CYAN}║                                                          ║${NC}"
echo "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  ${GREEN}C-napse Installer${NC}"
echo ""

# Detect OS and arch
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Linux*)     OS=linux ;;
    Darwin*)    OS=darwin ;;
    MINGW*|MSYS*|CYGWIN*) OS=windows ;;
    *)          echo "${RED}Unsupported OS: $OS${NC}"; exit 1 ;;
esac

case "$ARCH" in
    x86_64|amd64)   ARCH=x86_64 ;;
    arm64|aarch64)  ARCH=aarch64 ;;
    *)              echo "${RED}Unsupported architecture: $ARCH${NC}"; exit 1 ;;
esac

# macOS: Check for Apple Silicon
if [ "$OS" = "darwin" ] && [ "$ARCH" = "aarch64" ]; then
    BINARY="cnapse-darwin-aarch64"
elif [ "$OS" = "darwin" ]; then
    BINARY="cnapse-darwin-x86_64"
else
    BINARY="cnapse-${OS}-${ARCH}"
fi

echo "→ Detected: ${OS}/${ARCH}"

# Get latest release
echo "→ Fetching latest release..."
LATEST=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST" ]; then
    echo "${RED}Failed to fetch latest release${NC}"
    exit 1
fi

echo "→ Latest version: ${LATEST}"

# Download
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST}/${BINARY}"
TMP_FILE=$(mktemp)

echo "→ Downloading ${BINARY}..."
if ! curl -fsSL "$DOWNLOAD_URL" -o "$TMP_FILE"; then
    echo "${RED}Download failed${NC}"
    exit 1
fi

# Install
mkdir -p "$INSTALL_DIR"
chmod +x "$TMP_FILE"
mv "$TMP_FILE" "${INSTALL_DIR}/cnapse"

echo "→ Installed to ${INSTALL_DIR}/cnapse"

# Check PATH
case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *)
        echo ""
        echo "${YELLOW}⚠  Add this to your shell config (.bashrc, .zshrc, etc.):${NC}"
        echo ""
        echo "  export PATH=\"\$PATH:$INSTALL_DIR\""
        echo ""
        ;;
esac

# Verify
if command -v cnapse &> /dev/null; then
    echo ""
    echo "${GREEN}✓ C-napse installed successfully!${NC}"
    echo ""
    cnapse --version
else
    echo ""
    echo "${GREEN}✓ C-napse downloaded!${NC}"
    echo "  Run: ${INSTALL_DIR}/cnapse --version"
fi

echo ""
echo "  Next steps:"
echo "    ${CYAN}cnapse init${NC}            # Initialize config"
echo "    ${CYAN}cnapse auth anthropic${NC}  # Add API key (optional)"
echo "    ${CYAN}cnapse${NC}                 # Start REPL"
echo ""
