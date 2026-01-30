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

C-napse is a modular, agentic CLI that orchestrates specialized AI agents to control and automate your PC. Like Claude Code, but lightweight and provider-agnostic.

[![npm version](https://badge.fury.io/js/%40projectservan8n%2Fcnapse.svg)](https://www.npmjs.com/package/@projectservan8n/cnapse)

## Installation

### One Command Install

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/projectservan8n/C-napse/main/install.ps1 | iex
```

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/projectservan8n/C-napse/main/install.sh | bash
```

### Or via npm

```bash
npm install -g @projectservan8n/cnapse
```

## Quick Start

```bash
# Interactive setup wizard (recommended)
cnapse init

# Or configure manually
cnapse auth openrouter YOUR_API_KEY
cnapse config set provider openrouter

# Launch the TUI
cnapse
```

## Features

- **Interactive Help Menu** - Arrow-key navigation for commands and settings (Ctrl+H)
- **Vision Capability** - AI can see and describe your screen (`/screen`)
- **Computer Control** - Mouse, keyboard, and window automation
- **Multi-Step Tasks** - Automated task sequences (`/task open notepad and type hello`)
- **Telegram Bot** - Remote PC control via Telegram (`/telegram`)
- **Screen Watching** - AI context from your desktop (Ctrl+W)
- **Multi-Agent System** - Specialized agents for shell, code, files, and computer control
- **Multiple Providers** - Ollama (local), OpenRouter, Anthropic, OpenAI

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Ctrl+C` | Exit |
| `Ctrl+H` | Open help menu |
| `Ctrl+W` | Toggle screen watching |
| `Ctrl+T` | Toggle Telegram bot |
| `Ctrl+L` | Clear screen |

## Slash Commands

```
/help      - Interactive help menu
/screen    - Take screenshot + AI description
/task      - Execute multi-step automation
/telegram  - Toggle Telegram bot
/watch     - Toggle screen watching
/clear     - Clear chat
/config    - Show configuration
/quit      - Exit
```

## Vision & Screen Analysis

C-napse can see your screen and describe what's visible:

```bash
# Take screenshot and get AI description
/screen

# Enable continuous screen watching
/watch
```

Supports vision models from:
- **Ollama**: llava, llama3.2-vision, bakllava
- **OpenRouter**: claude-3-5-sonnet, gpt-4-vision
- **Anthropic**: claude-3-5-sonnet
- **OpenAI**: gpt-4-vision-preview

## Multi-Step Task Automation

Natural language task automation:

```bash
/task open notepad and type hello world
/task open vscode, go to folder E:\Projects, then open terminal
/task take a screenshot and describe what you see
```

The AI parses your request into steps and executes them sequentially.

## Telegram Bot Control

Control your PC remotely via Telegram:

```bash
# Set your Telegram bot token
cnapse auth telegram YOUR_BOT_TOKEN

# Start the bot (or use /telegram in the TUI)
```

**Telegram Commands:**
- `/start` - Connect to C-napse
- `/screen` - Receive screenshot
- `/describe` - Screenshot + AI description
- `/run <cmd>` - Execute shell command
- `/status` - System status

## Computer Control Tools

C-napse can control your mouse, keyboard, and windows:

**Mouse:**
- `moveMouse(x, y)` - Move to coordinates
- `clickMouse(button)` - Click left/right/middle
- `doubleClick()` - Double click
- `scrollMouse(amount)` - Scroll up/down
- `dragMouse(x1, y1, x2, y2)` - Drag and drop

**Keyboard:**
- `typeText(text)` - Type text
- `pressKey(key)` - Press single key
- `keyCombo(keys)` - Key combination (e.g., Ctrl+C)

**Windows:**
- `getActiveWindow()` - Get focused window
- `listWindows()` - List all windows
- `focusWindow(title)` - Focus by title

## Providers

| Provider | Setup | Best For |
|----------|-------|----------|
| **Ollama** | `cnapse config set provider ollama` | Free, local, privacy |
| **OpenRouter** | `cnapse auth openrouter KEY` | Many models, pay-per-use |
| **Anthropic** | `cnapse auth anthropic KEY` | Claude models |
| **OpenAI** | `cnapse auth openai KEY` | GPT models |

### Default Models

| Provider | Default Model |
|----------|---------------|
| Ollama | `qwen2.5:0.5b` |
| OpenRouter | `qwen/qwen-2.5-coder-32b-instruct` |
| Anthropic | `claude-3-5-sonnet-20241022` |
| OpenAI | `gpt-4o` |

## Agent Architecture

| Agent | Purpose |
|-------|---------|
| **Router** | Intent classification and query routing |
| **Shell** | Shell commands, process management |
| **Coder** | Code generation, editing, debugging |
| **Filer** | File operations, search, organization |
| **Computer** | Mouse, keyboard, window control |
| **Vision** | Screen capture and analysis |

## Available Tools

**Shell Tools:**
- `run_command` - Execute shell commands
- `get_env` / `set_env` - Environment variables
- `get_cwd` / `set_cwd` - Working directory

**File Tools:**
- `read_file` / `write_file` - File I/O
- `list_dir` - Directory listing (recursive support)
- `copy_file` / `move_path` / `delete_path` - File operations
- `file_info` - File metadata
- `find_files` - Glob pattern search

**Process Tools:**
- `list_processes` - List running processes
- `process_info` - Get process details
- `kill_process` - Terminate process
- `find_process` - Search by name
- `system_info` - System information

**Network Tools:**
- `check_port` - Port availability
- `find_available_port` - Find free port in range
- `check_connection` - Test host connectivity
- `get_local_ip` - Local IP addresses
- `list_interfaces` - Network interfaces
- `fetch_url` - HTTP requests

**Clipboard Tools:**
- `get_clipboard` / `set_clipboard` - Clipboard access

**Vision Tools:**
- `takeScreenshot` - Capture screen
- `describeCurrentScreen` - Screenshot + AI analysis

## Configuration

Config stored via [conf](https://github.com/sindresorhus/conf):

- **Windows:** `%APPDATA%\cnapse-nodejs\Config\config.json`
- **macOS:** `~/Library/Preferences/cnapse-nodejs/config.json`
- **Linux:** `~/.config/cnapse-nodejs/config.json`

### CLI Configuration

```bash
# Set provider
cnapse config set provider openrouter

# Set model
cnapse config set model gpt-4o

# Set API key
cnapse auth anthropic sk-ant-...

# Set Telegram bot token
cnapse auth telegram YOUR_BOT_TOKEN

# View config
cnapse config
```

## System Requirements

- **Node.js:** 18+
- **OS:** Windows 10+, macOS, Linux
- **RAM:** 4GB minimum (for local Ollama models)

## Development

```bash
# Clone the repo
git clone https://github.com/projectservan8n/C-napse.git
cd C-napse/cli

# Install dependencies
npm install

# Run in development
npm run dev

# Build
npm run build

# Type check
npm run typecheck
```

## License

MIT License - see [LICENSE](LICENSE)
