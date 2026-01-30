#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';
import { setApiKey, setProvider, setModel, getConfig } from './lib/config.js';

const args = process.argv.slice(2);

async function main() {
  // Handle CLI commands
  if (args.length > 0) {
    const command = args[0];

    switch (command) {
      case 'auth': {
        const provider = args[1] as 'openrouter' | 'anthropic' | 'openai' | 'telegram';
        const key = args[2];

        if (!provider || !key) {
          console.log('Usage: cnapse auth <provider> <api-key>');
          console.log('Providers: openrouter, anthropic, openai, telegram');
          process.exit(1);
        }

        if (!['openrouter', 'anthropic', 'openai', 'telegram'].includes(provider)) {
          console.log(`Invalid provider: ${provider}`);
          console.log('Valid providers: openrouter, anthropic, openai, telegram');
          process.exit(1);
        }

        setApiKey(provider, key);
        console.log(`✓ ${provider} API key saved`);
        if (provider === 'telegram') {
          console.log('Start the bot with: cnapse, then /telegram or Ctrl+T');
        }
        process.exit(0);
      }

      case 'config': {
        const subcommand = args[1];

        // Interactive config TUI if no subcommand
        if (!subcommand) {
          const { ConfigUI } = await import('./components/ConfigUI.js');
          render(<ConfigUI />);
          return; // Don't render App
        }

        if (subcommand === 'set') {
          const key = args[2];
          const value = args[3];

          if (key === 'provider') {
            if (!['openrouter', 'ollama', 'anthropic', 'openai'].includes(value!)) {
              console.log('Valid providers: openrouter, ollama, anthropic, openai');
              process.exit(1);
            }
            setProvider(value as any);
            console.log(`✓ Provider set to: ${value}`);
          } else if (key === 'model') {
            setModel(value!);
            console.log(`✓ Model set to: ${value}`);
          } else {
            console.log('Usage: cnapse config set <provider|model> <value>');
          }
          process.exit(0);
        }

        if (subcommand === 'show') {
          const config = getConfig();
          console.log('\nC-napse Configuration:');
          console.log(`  Provider: ${config.provider}`);
          console.log(`  Model: ${config.model}`);
          console.log(`  Ollama Host: ${config.ollamaHost}`);
          console.log(`  API Keys configured:`);
          console.log(`    - OpenRouter: ${config.apiKeys.openrouter ? '✓' : '✗'}`);
          console.log(`    - Anthropic: ${config.apiKeys.anthropic ? '✓' : '✗'}`);
          console.log(`    - OpenAI: ${config.apiKeys.openai ? '✓' : '✗'}`);
          console.log('');
          process.exit(0);
        }

        console.log('Usage: cnapse config [show|set <key> <value>]');
        process.exit(1);
      }

      case 'help':
      case '--help':
      case '-h': {
        // Colorful help using ANSI escape codes
        const cyan = '\x1b[36m';
        const green = '\x1b[32m';
        const yellow = '\x1b[33m';
        const magenta = '\x1b[35m';
        const bold = '\x1b[1m';
        const dim = '\x1b[2m';
        const reset = '\x1b[0m';

        console.log(`
${cyan}${bold}╔═══════════════════════════════════════════════════════════╗
║                                                               ║
║   ${magenta}██████╗      ${cyan}███╗   ██╗ █████╗ ██████╗ ███████╗███████╗${reset}${cyan}${bold}   ║
║   ${magenta}██╔════╝      ${cyan}████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝${reset}${cyan}${bold}   ║
║   ${magenta}██║     █████╗${cyan}██╔██╗ ██║███████║██████╔╝███████╗█████╗${reset}${cyan}${bold}     ║
║   ${magenta}██║     ╚════╝${cyan}██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝${reset}${cyan}${bold}     ║
║   ${magenta}╚██████╗      ${cyan}██║ ╚████║██║  ██║██║     ███████║███████╗${reset}${cyan}${bold}   ║
║   ${magenta} ╚═════╝      ${cyan}╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝${reset}${cyan}${bold}   ║
║                                                               ║
║              ${reset}${dim}Autonomous PC Intelligence${reset}${cyan}${bold}                     ║
╚═══════════════════════════════════════════════════════════╝${reset}

${yellow}${bold}USAGE${reset}
  ${green}cnapse${reset}                        Start interactive chat
  ${green}cnapse init${reset}                   Interactive setup wizard
  ${green}cnapse config${reset}                 Interactive configuration
  ${green}cnapse config show${reset}            Show current configuration
  ${green}cnapse auth <provider> <key>${reset}  Set API key
  ${green}cnapse help${reset}                   Show this help

${yellow}${bold}PROVIDERS${reset}
  ${cyan}ollama${reset}      Local AI ${dim}(default, free, private)${reset}
  ${cyan}openrouter${reset}  OpenRouter API ${dim}(many models, pay-per-use)${reset}
  ${cyan}anthropic${reset}   Anthropic Claude ${dim}(best reasoning)${reset}
  ${cyan}openai${reset}      OpenAI GPT ${dim}(reliable)${reset}
  ${cyan}telegram${reset}    Telegram bot token ${dim}(remote control)${reset}

${yellow}${bold}QUICK START${reset}
  ${dim}# Interactive setup - easiest way${reset}
  ${green}cnapse init${reset}

  ${dim}# Manual setup with OpenRouter${reset}
  ${green}cnapse auth openrouter sk-or-v1-xxxxx${reset}
  ${green}cnapse config set provider openrouter${reset}

  ${dim}# Add Telegram for remote control${reset}
  ${green}cnapse auth telegram YOUR_BOT_TOKEN${reset}

${yellow}${bold}IN-APP SHORTCUTS${reset}
  ${cyan}Ctrl+H${reset}  Help menu       ${cyan}Ctrl+P${reset}  Change provider
  ${cyan}Ctrl+E${reset}  Screen watch    ${cyan}Ctrl+T${reset}  Toggle Telegram
  ${cyan}Ctrl+L${reset}  Clear chat      ${cyan}Ctrl+C${reset}  Exit

${dim}GitHub: https://github.com/projectservan8n/C-napse${reset}
`);
        process.exit(0);
      }

      case 'version':
      case '--version':
      case '-v': {
        console.log('cnapse v0.5.0');
        process.exit(0);
      }

      case 'init': {
        // Interactive setup with Ink UI
        const { Setup } = await import('./components/Setup.js');
        render(<Setup />);
        return; // Don't render App
      }

      default: {
        // Unknown command - start app anyway
        break;
      }
    }
  }

  // Start interactive TUI
  render(<App />);
}

main();
