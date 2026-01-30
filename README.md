# C-napse

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ██████╗      ███╗   ██╗ █████╗ ██████╗ ███████╗███████╗║
║  ██╔════╝      ████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝║
║  ██║     █████╗██╔██╗ ██║███████║██████╔╝███████╗█████╗  ║
║  ██║     ╚════╝██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝  ║
║  ╚██████╗      ██║ ╚████║██║  ██║██║     ███████║███████╗║
║   ╚═════╝      ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝║
║                                                          ║
║                     agents in sync                       ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

> **Small models. Fast signals.**

C-napse is a modular, agentic command-line interface that orchestrates a swarm of small, specialized AI agents to control and automate PC tasks.

## Features

- 🏠 **Local-first**: Run entirely on your machine with small, fast models
- ☁️ **Cloud hybrid**: Optional fallback to Anthropic, OpenAI, or OpenRouter APIs
- 🧠 **Extended context**: PC memory (RAM/SQLite) as extended context window
- 📱 **Mobile access**: Telegram bot integration for on-the-go control
- 🌐 **Web portal**: Self-hosted app launcher accessible from any device
- 🔄 **Phone sync**: Mirror Ollama + VS Code from your phone

## Quick Start

### Installation

**Unix/macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/cnapse/main/scripts/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/yourusername/cnapse/main/scripts/install.ps1 | iex
```

### First Run

```bash
# Initialize configuration
cnapse init

# (Optional) Add API key for cloud fallback
cnapse auth add anthropic

# Start interactive mode
cnapse
```

## Usage

### Interactive REPL
```bash
cnapse
```

### Single Command
```bash
cnapse "list all python files in current directory"
cnapse "write a script to batch rename images"
cnapse "what's using port 8080?"
```

### With Provider Override
```bash
cnapse -p anthropic "complex refactoring task"
cnapse -p openrouter "generate comprehensive documentation"
```

### Web Server
```bash
cnapse serve
# Access at http://localhost:7777
```

### Telegram Bot
```bash
cnapse telegram setup
cnapse telegram start
```

## Architecture

C-napse uses a multi-agent architecture where specialized agents handle different types of tasks:

| Agent | Model | Purpose |
|-------|-------|---------|
| Router | Qwen2.5-0.5B | Intent classification and dispatch |
| Coder | Qwen2.5-Coder-1.5B | Code generation, editing, debugging |
| Shell | Qwen2.5-0.5B | Shell commands, system operations |
| Filer | Qwen2.5-0.5B | File operations, search, organization |
| Memory | Qwen2.5-0.5B | Context management, summarization |
| App | Qwen2.5-Coder-1.5B | Web app creation for launcher |

## Configuration

Configuration files are stored in `~/.cnapse/`:

```
~/.cnapse/
├── config.toml              # Main configuration
├── credentials.toml         # API keys (chmod 600)
├── apps/                    # User-created apps
├── models/                  # Local GGUF models
├── memory.db                # SQLite context store
└── logs/
```

## CLI Commands

```
cnapse [OPTIONS] [QUERY]

Commands:
  init        Initialize C-napse configuration
  config      View and modify settings
  auth        Manage API credentials
  models      Manage local AI models
  run         Execute a single command
  serve       Start the web server and API
  telegram    Manage Telegram bot
  app         Create and manage apps
  sync        Phone and VS Code sync

Options:
  -p, --provider <PROVIDER>  Override provider [local|anthropic|openai|openrouter]
  -a, --agent <AGENT>        Force specific agent
  -v, --verbose              Increase verbosity
  -o, --output <FORMAT>      Output format [text|json|markdown]
  -V, --version              Print version
  -h, --help                 Print help
```

## Building from Source

```bash
# Clone repository
git clone https://github.com/yourusername/cnapse.git
cd cnapse

# Build release
cargo build --release

# Run
./target/release/cnapse
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
