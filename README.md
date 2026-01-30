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

> **Autonomous PC Intelligence - AI that sees your screen, controls your computer, and learns as it goes.**

C-napse is an agentic CLI that orchestrates specialized AI agents to control and automate your PC. Think Claude Code meets desktop automation - with vision, browser control, and the ability to ask other AIs for help when stuck.

[![npm version](https://badge.fury.io/js/%40projectservan8n%2Fcnapse.svg)](https://www.npmjs.com/package/@projectservan8n/cnapse)

## What Can It Do?

- **See your screen** - Takes screenshots, AI describes what's visible
- **Control your computer** - Mouse, keyboard, windows, like a human would
- **Browse the web** - Opens browser, searches, interacts with websites (Playwright)
- **Ask other AIs** - Gets stuck? Asks Perplexity/ChatGPT/Claude for help
- **Send emails** - Gmail, Outlook via browser automation
- **Use Google apps** - Sheets, Docs via browser
- **Research topics** - Multi-step web research with source gathering
- **Learn from experience** - Remembers successful task patterns
- **Remote control** - Control your PC from Telegram

## Installation

### Install

```bash
npm install -g @projectservan8n/cnapse
npx playwright install chromium  # For browser features
```

> **Note:** Windows-first for now. macOS/Linux support coming soon.

## Quick Start

```bash
# Interactive setup wizard
cnapse init

# Or configure manually
cnapse auth openrouter YOUR_API_KEY
cnapse config set provider openrouter

# Launch
cnapse
```

## Features

### Vision & Screen Analysis
```bash
/screen                    # Take screenshot + AI description
/watch                     # Enable continuous screen watching
```

### Multi-Step Task Automation
```bash
/task open notepad and type hello
/task open vscode, go to folder E:\Projects
/task minimize chrome
/task close notepad
```

### Web Automation (Playwright-powered)
```bash
/task ask perplexity what is the capital of France
/task search google for best restaurants NYC
/task send email via gmail to john@example.com about meeting
/task create google sheet called Sales Report
```

### Adaptive Agent (asks for help when stuck)
```bash
/task book a hotel on booking.com        # Will ask Perplexity if stuck
/task I don't know how to use this app   # Analyzes UI, suggests actions
```

### Telegram Remote Control
```bash
cnapse auth telegram YOUR_BOT_TOKEN

# In Telegram:
/start              # Connect
/screen             # Get screenshot
/describe           # Screenshot + AI description
minimize chrome     # Control windows
type "hello"        # Type text
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+H` | Help menu |
| `Ctrl+P` | Change provider/model |
| `Ctrl+E` | Toggle screen watching |
| `Ctrl+T` | Toggle Telegram bot |
| `Ctrl+L` | Clear chat |
| `Ctrl+C` | Exit |

## Slash Commands

```
/help      - Interactive help menu
/screen    - Screenshot + AI description
/task      - Execute multi-step automation
/telegram  - Toggle Telegram bot
/watch     - Toggle screen watching
/memory    - View learned task patterns
/provider  - Change AI provider/model
/config    - Show configuration
/clear     - Clear chat
/quit      - Exit
```

## Task Actions

C-napse understands these action types:

**Apps & Windows:**
- `open_app` - Open via Run dialog
- `focus_window`, `minimize_window`, `maximize_window`, `close_window`, `restore_window`

**Input:**
- `type_text`, `press_key`, `key_combo`, `click`

**Files:**
- `read_file`, `write_file`, `list_files`
- `generate_code`, `edit_code` - AI-powered

**Web (Playwright):**
- `open_url`, `web_search`, `browse_and_ask`
- `send_email` (gmail, outlook)
- `google_sheets`, `google_docs`
- `research` - Multi-step research

**Adaptive:**
- `ask_llm` - Ask Perplexity/ChatGPT/Claude with screenshot
- `learn_ui` - Analyze current screen
- `adaptive_do` - Try task, ask for help if stuck

## Providers

| Provider | Setup | Best For |
|----------|-------|----------|
| **Ollama** | Local, free | Privacy, offline |
| **OpenRouter** | `cnapse auth openrouter KEY` | Budget, many models |
| **Anthropic** | `cnapse auth anthropic KEY` | Best reasoning |
| **OpenAI** | `cnapse auth openai KEY` | Reliable |

## Self-Learning

C-napse learns from successful tasks:

```bash
/memory              # View learned patterns
/memory clear        # Reset memory
```

The more you use `/task`, the smarter it gets - it remembers what worked.

## Configuration

```bash
cnapse config              # Interactive config UI
cnapse config show         # Show current config
cnapse config set provider openrouter
cnapse config set model gpt-4o
cnapse auth telegram BOT_TOKEN
```

Config location:
- **Windows:** `%APPDATA%\cnapse-nodejs\Config\config.json`
- **macOS:** `~/Library/Preferences/cnapse-nodejs/config.json`
- **Linux:** `~/.config/cnapse-nodejs/config.json`

## System Requirements

- **Node.js:** 18+
- **OS:** Windows 10+ (macOS/Linux coming soon)
- **RAM:** 4GB+ (for local Ollama models)
- **Chromium:** Installed via `npx playwright install chromium`

## Development

```bash
git clone https://github.com/projectservan8n/C-napse.git
cd C-napse/cli

npm install
npm run dev       # Development
npm run build     # Build
npm run typecheck # Type check
```

## License

MIT License - see [LICENSE](LICENSE)
