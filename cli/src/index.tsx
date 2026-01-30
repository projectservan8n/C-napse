#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';
import { setApiKey, setProvider, setModel, getConfig } from './lib/config.js';

const args = process.argv.slice(2);

// Handle CLI commands
if (args.length > 0) {
  const command = args[0];

  switch (command) {
    case 'auth': {
      const provider = args[1] as 'openrouter' | 'anthropic' | 'openai';
      const key = args[2];

      if (!provider || !key) {
        console.log('Usage: cnapse auth <provider> <api-key>');
        console.log('Providers: openrouter, anthropic, openai');
        process.exit(1);
      }

      if (!['openrouter', 'anthropic', 'openai'].includes(provider)) {
        console.log(`Invalid provider: ${provider}`);
        console.log('Valid providers: openrouter, anthropic, openai');
        process.exit(1);
      }

      setApiKey(provider, key);
      console.log(`✓ ${provider} API key saved`);
      process.exit(0);
    }

    case 'config': {
      const subcommand = args[1];

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

      if (subcommand === 'show' || !subcommand) {
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
      console.log(`
C-napse - Autonomous PC Intelligence

Usage:
  cnapse                     Start interactive chat
  cnapse init                Interactive setup wizard
  cnapse auth <provider> <key>  Set API key
  cnapse config              Show configuration
  cnapse config set <k> <v>  Set config value
  cnapse help                Show this help

Providers:
  ollama      - Local AI (default, free)
  openrouter  - OpenRouter API (many models)
  anthropic   - Anthropic Claude
  openai      - OpenAI GPT

Quick Start:
  cnapse init                # Interactive setup

Manual Setup:
  cnapse auth openrouter sk-or-xxxxx
  cnapse config set provider openrouter
  cnapse config set model qwen/qwen-2.5-coder-32b-instruct
`);
      process.exit(0);
    }

    case 'version':
    case '--version':
    case '-v': {
      console.log('cnapse v0.2.0');
      process.exit(0);
    }

    case 'init': {
      // Interactive setup
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const question = (q: string): Promise<string> =>
        new Promise((resolve) => rl.question(q, resolve));

      console.log('\n🚀 C-napse Setup\n');

      console.log('Select a provider:');
      console.log('  1. ollama     - Local AI (free, requires Ollama installed)');
      console.log('  2. openrouter - OpenRouter API (pay per use, many models)');
      console.log('  3. anthropic  - Anthropic Claude (pay per use)');
      console.log('  4. openai     - OpenAI GPT (pay per use)');
      console.log('');

      const providerChoice = await question('Enter choice (1-4) [1]: ');
      const providers = ['ollama', 'openrouter', 'anthropic', 'openai'] as const;
      const providerIndex = parseInt(providerChoice || '1') - 1;
      const provider = providers[providerIndex] || 'ollama';

      setProvider(provider);
      console.log(`✓ Provider set to: ${provider}`);

      if (provider !== 'ollama') {
        const apiKey = await question(`\nEnter your ${provider} API key: `);
        if (apiKey) {
          setApiKey(provider as any, apiKey);
          console.log(`✓ API key saved`);
        }
      }

      // Set default model based on provider
      const defaultModels: Record<string, string> = {
        ollama: 'qwen2.5:0.5b',
        openrouter: 'qwen/qwen-2.5-coder-32b-instruct',
        anthropic: 'claude-3-5-sonnet-20241022',
        openai: 'gpt-4o',
      };

      const model = await question(`\nModel [${defaultModels[provider]}]: `);
      setModel(model || defaultModels[provider]!);
      console.log(`✓ Model set to: ${model || defaultModels[provider]}`);

      rl.close();

      console.log('\n✅ Setup complete! Run `cnapse` to start chatting.\n');
      process.exit(0);
    }

    default: {
      // Treat as a direct question
      // For now, just start the app
      break;
    }
  }
}

// Start interactive TUI
render(<App />);
