# C-napse

```
  ██████╗      ███╗   ██╗ █████╗ ██████╗ ███████╗███████╗
 ██╔════╝      ████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝
 ██║     █████╗██╔██╗ ██║███████║██████╔╝███████╗█████╗
 ██║     ╚════╝██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝
 ╚██████╗      ██║ ╚████║██║  ██║██║     ███████║███████╗
  ╚═════╝      ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝
                    agents in sync
```

> **Small models. Fast signals.**

C-napse is a modular, agentic CLI that orchestrates small, specialized AI agents to control and automate your PC. Like Claude Code, but local-first and lightweight.

## Installation

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/projectservan8n/C-napse/main/install.ps1 | iex
```

Or step by step:
```powershell
curl -o install.ps1 https://raw.githubusercontent.com/projectservan8n/C-napse/main/install.ps1
powershell -ExecutionPolicy Bypass -File install.ps1
```

### Prerequisites

- **Rust**: Install from https://rustup.rs or `winget install Rustlang.Rustup`
- **Ollama**: Install from https://ollama.ai or `winget install Ollama.Ollama`

### Manual Build

```bash
git clone https://github.com/projectservan8n/C-napse.git
cd C-napse
cargo build --release
```

## Quick Start

```bash
# Initialize (creates config)
cnapse init

# Launch the TUI
cnapse
```

You'll see:
```
  ██████╗      ███╗   ██╗ █████╗ ██████╗ ███████╗███████╗
 ██╔════╝      ████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝
 ██║     █████╗██╔██╗ ██║███████║██████╔╝███████╗█████╗
 ██║     ╚════╝██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝
 ╚██████╗      ██║ ╚████║██║  ██║██║     ███████║███████╗
  ╚═════╝      ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝
                    ollama │ qwen2.5:0.5b
─────────────────────────────────────────────────────────
```

## Features

- **TUI Chat Interface** - Interactive terminal UI like Claude Code
- **Screen Watching** - AI can see your desktop for context (Ctrl+W to toggle)
- **Tool Execution** - File ops, shell commands, clipboard, processes, screenshots
- **Local-first** - Runs on Ollama with small models (0.5B-1.5B)
- **Cloud Fallback** - Optional Anthropic, OpenAI, OpenRouter APIs
- **Memory** - SQLite-backed conversation history
- **Telegram Bot** - Control your PC remotely
- **Web Server** - REST API and WebSocket support

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Ctrl+C` | Exit |
| `Ctrl+L` | Clear screen |
| `Ctrl+W` | Toggle screen watching |
| `Up/Down` | Navigate history |
| `PageUp/Down` | Scroll messages |

## Slash Commands

```
/help   - Show help
/clear  - Clear chat
/watch  - Toggle screen watching
/model  - Show/switch model
/status - Show status
/new    - New conversation
/exit   - Exit
```

## Usage Examples

```bash
# Interactive TUI mode
cnapse

# Single query
cnapse "list files in downloads"

# With provider override
cnapse -p anthropic "complex task"

# Start web server
cnapse serve

# Telegram bot
cnapse telegram start
```

## Architecture

| Agent | Model | Purpose |
|-------|-------|---------|
| Router | qwen2.5:0.5b | Intent classification |
| Coder | qwen2.5-coder:1.5b | Code generation |
| Shell | qwen2.5:0.5b | Shell commands |
| Filer | qwen2.5:0.5b | File operations |
| Memory | qwen2.5:0.5b | Context management |
| App | qwen2.5-coder:1.5b | Web app creation |

## Configuration

Config stored in `~/.cnapse/`:

```
~/.cnapse/
├── config.toml      # Settings
├── credentials.toml # API keys
├── memory.db        # Conversation history
└── apps/            # Generated apps
```

## System Requirements

- **Minimum**: 4GB RAM (0.5B models only)
- **Recommended**: 8GB+ RAM (all models)
- **GPU**: Optional, Ollama uses GPU automatically if available

## License

MIT License - see [LICENSE](LICENSE)
