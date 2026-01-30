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

You'll see:
```
  ██████╗      ███╗   ██╗ █████╗ ██████╗ ███████╗███████╗
 ██╔════╝      ████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝
 ██║     █████╗██╔██╗ ██║███████║██████╔╝███████╗█████╗
 ██║     ╚════╝██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝
 ╚██████╗      ██║ ╚████║██║  ██║██║     ███████║███████╗
  ╚═════╝      ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝
                    openrouter │ qwen/qwen-2.5-coder-32b-instruct
─────────────────────────────────────────────────────────
```

## Features

- **TUI Chat Interface** - Interactive terminal UI built with Ink (React for CLI)
- **Screen Watching** - AI can see your desktop for context (Ctrl+W to toggle)
- **Multi-Agent System** - Specialized agents for shell, code, and file operations
- **Tool Execution** - File ops, shell commands, clipboard, processes, network
- **Multiple Providers** - Ollama (local), OpenRouter, Anthropic, OpenAI
- **Interactive Setup** - Arrow-key navigation for easy configuration

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Ctrl+C` | Exit |
| `Ctrl+L` | Clear screen |
| `Ctrl+W` | Toggle screen watching |

## Slash Commands

```
/help   - Show help
/clear  - Clear chat
```

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
