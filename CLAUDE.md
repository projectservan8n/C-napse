# C-napse Project Context

## Overview
C-napse is an autonomous PC control CLI tool. It uses AI to control your computer via mouse/keyboard (nut-js), take screenshots with AI vision, and automate multi-step tasks.

**Current Version:** 0.9.0
**Package:** `@projectservan8n/cnapse`
**npm:** https://www.npmjs.com/package/@projectservan8n/cnapse

## Key Architecture

### No Playwright (as of v0.9.0)
Browser automation uses:
- Shell commands to open URLs in default browser (`start "" "url"` on Windows)
- Computer control (nut-js) for mouse/keyboard in browser
- Vision system (screenshot + AI) to see browser content

### Core Components

```
cli/
├── src/
│   ├── index.tsx           # Entry point, Ink CLI app
│   ├── components/         # React/Ink UI components
│   │   ├── App.tsx         # Main app with chat interface
│   │   ├── HelpMenu.tsx    # Arrow-key navigable help
│   │   └── Setup.tsx       # Initial setup wizard
│   ├── lib/
│   │   ├── api.ts          # LLM API calls (Ollama, OpenRouter, OpenAI, Anthropic)
│   │   ├── config.ts       # Configuration management
│   │   ├── tasks.ts        # Multi-step task automation with learning
│   │   └── vision.ts       # Screenshot + AI description
│   ├── tools/
│   │   ├── computer.ts     # Mouse/keyboard/window control (nut-js)
│   │   ├── filesystem.ts   # File operations
│   │   └── shell.ts        # Command execution
│   ├── services/
│   │   ├── browser.ts      # Browser automation (shell + computer control)
│   │   └── telegram.ts     # Telegram bot for remote control
│   └── agents/
│       ├── router.ts       # Routes tasks to appropriate agent
│       └── executor.ts     # Executes agent actions
```

## Important Files

### tasks.ts
The task automation system. Parses natural language into steps like:
- `open_app:notepad` - Opens via Win+R
- `type_text:hello` - Types text
- `key_combo:control+s` - Key combinations
- `open_url:https://...` - Opens in default browser
- `browse_and_ask:perplexity|question` - Opens AI site, types question
- `web_search:query` - Google search + vision description
- `generate_code:path|description` - AI generates code
- `adaptive_do:goal` - Self-correcting agent

Has a learning system that saves successful task patterns to `~/.cnapse/task-memory.json`.

### browser.ts
NO Playwright. Uses:
- `openUrl()` - Shell command to open in default browser
- `askAI()` - Opens AI site, types with keyboard, uses vision
- `webSearch()` - Opens search URL, describes with vision
- `sendGmail/sendOutlook()` - Opens compose URL with pre-filled fields

### telegram.ts
Telegram bot service with commands:
- `/start` - Initialize bot
- `/screen` - Send screenshot
- `/describe` - Screenshot + AI description
- `/task <desc>` - Multi-step task automation
- `/run <cmd>` - Execute shell command
- `/status` - System info

Natural language messages are processed for:
- Window control: "minimize chrome", "close notepad"
- Computer control: "type 'hello'"
- Complex tasks routed to task system

## Development

```bash
cd cli
npm install
npm run dev      # Run with tsx
npm run build    # Build with tsup
npm run start    # Run built version
```

## Publishing

GitHub Actions auto-publishes to npm on push to main. The NPM_TOKEN secret is valid for 90 days.

```bash
# Bump version in cli/package.json
# Commit and push
git add . && git commit -m "..." && git push origin main
```

## Key Patterns

### Computer Control via nut-js
```typescript
import * as computer from '../tools/computer.js';
await computer.keyCombo(['meta', 'r']);  // Win+R
await computer.typeText('notepad');
await computer.pressKey('Return');
```

### Vision
```typescript
import { describeScreen, captureScreenshot } from '../lib/vision.js';
const { description, screenshot } = await describeScreen();
```

### Opening URLs (no Playwright)
```typescript
import { openUrl } from '../services/browser.js';
await openUrl('https://google.com');  // Opens in default browser
```

## User Instructions (from CLAUDE.md)

- Never add sensitive API keys to files - use Railway env vars
- Always push changes after commits
- Fix issues properly rather than bandaiding with "coming soon"
- Keep it functional and working at 100%

## Recent Changes (v0.9.0)

1. Removed Playwright entirely (~50MB saved)
2. Browser automation now uses shell commands + computer control
3. Vision system describes browser content instead of DOM queries
4. All docs updated to reflect "desktop-based" automation
