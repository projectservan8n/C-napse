import React, { useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Header } from './Header.js';
import { ChatMessage } from './ChatMessage.js';
import { ChatInput } from './ChatInput.js';
import { StatusBar } from './StatusBar.js';
import { HelpMenu } from './HelpMenu.js';
import { ProviderSelector } from './ProviderSelector.js';
import { getConfig } from '../lib/config.js';
import { useChat, useVision, useTelegram, useTasks } from '../hooks/index.js';
import { isNamedShortcut, getShortcutDisplay } from '../lib/keyboard.js';

type OverlayType = 'none' | 'help' | 'provider';

export function App() {
  const { exit } = useApp();

  // UI State
  const [overlay, setOverlay] = useState<OverlayType>('none');
  const [screenWatch, setScreenWatch] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [inputValue, setInputValue] = useState('');

  // Feature hooks
  const chat = useChat(screenWatch);
  const vision = useVision();
  const telegram = useTelegram((msg) => {
    chat.addSystemMessage(`📱 Telegram [${msg.from}]: ${msg.text}`);
  });
  const tasks = useTasks((task, step) => {
    if (step.status === 'running') {
      setStatus(`Running: ${step.description}`);
    }
  });

  // Keyboard shortcuts - platform-flexible (Ctrl on Windows/Linux, Cmd or Ctrl on macOS)
  useInput((inputChar, key) => {
    if (overlay !== 'none') return;

    if (isNamedShortcut(inputChar, key, 'EXIT')) exit();
    if (isNamedShortcut(inputChar, key, 'CLEAR')) chat.clearMessages();
    if (isNamedShortcut(inputChar, key, 'HELP')) setOverlay('help');
    if (isNamedShortcut(inputChar, key, 'PROVIDER')) setOverlay('provider');
    // Note: Ctrl+W avoided - conflicts with terminal close
    if (isNamedShortcut(inputChar, key, 'SCREEN_WATCH')) {
      setScreenWatch(prev => {
        const newState = !prev;
        chat.addSystemMessage(newState
          ? `🖥️ Screen watching enabled (${getShortcutDisplay('SCREEN_WATCH')} to toggle)`
          : '🖥️ Screen watching disabled.'
        );
        return newState;
      });
    }
    if (isNamedShortcut(inputChar, key, 'TELEGRAM')) {
      handleTelegramToggle();
    }
  });

  // Command handlers
  const handleCommand = useCallback(async (cmd: string) => {
    const parts = cmd.slice(1).split(' ');
    const command = parts[0];
    const args = parts.slice(1).join(' ');

    switch (command) {
      case 'clear':
        chat.clearMessages();
        chat.addSystemMessage('Chat cleared.');
        break;

      case 'help':
        setOverlay('help');
        break;

      case 'provider':
      case 'model':
        setOverlay('provider');
        break;

      case 'config': {
        const config = getConfig();
        chat.addSystemMessage(
          `⚙️ Configuration:\n` +
          `  Provider: ${config.provider}\n` +
          `  Model: ${config.model}\n` +
          `  Ollama: ${config.ollamaHost}\n\n` +
          `Use /provider to change`
        );
        break;
      }

      case 'screen':
        await handleScreenCommand();
        break;

      case 'watch':
        setScreenWatch(prev => {
          const newState = !prev;
          chat.addSystemMessage(newState
            ? '🖥️ Screen watching enabled.'
            : '🖥️ Screen watching disabled.'
          );
          return newState;
        });
        break;

      case 'telegram':
        await handleTelegramToggle();
        break;

      case 'task':
        if (args) {
          await handleTaskCommand(args);
        } else {
          chat.addSystemMessage('Usage: /task <description>\nExample: /task open notepad and type hello');
        }
        break;

      case 'memory':
        if (args === 'clear') {
          tasks.clearMemory();
          chat.addSystemMessage('🧠 Task memory cleared.');
        } else {
          const stats = tasks.getMemoryStats();
          chat.addSystemMessage(
            `🧠 Task Memory:\n\n` +
            `  Learned patterns: ${stats.patternCount}\n` +
            `  Total successful uses: ${stats.totalUses}\n\n` +
            (stats.topPatterns.length > 0
              ? `  Top patterns:\n${stats.topPatterns.map(p => `    • ${p}`).join('\n')}\n\n`
              : '  No patterns learned yet.\n\n') +
            `The more you use /task, the smarter it gets!\n` +
            `Use /memory clear to reset.`
          );
        }
        break;

      case 'quit':
      case 'exit':
        exit();
        break;

      default:
        chat.addSystemMessage(`Unknown command: ${command}\nType /help for commands`);
    }
  }, [chat, exit]);

  // Screen command
  const handleScreenCommand = useCallback(async () => {
    chat.addSystemMessage('📸 Analyzing screen...');
    setStatus('Analyzing...');

    try {
      const description = await vision.analyze();
      chat.addSystemMessage(`🖥️ Screen:\n\n${description}`);
    } catch (err) {
      chat.addSystemMessage(`❌ ${vision.error || 'Vision failed'}`);
    } finally {
      setStatus('Ready');
    }
  }, [chat, vision]);

  // Telegram toggle
  const handleTelegramToggle = useCallback(async () => {
    if (telegram.isEnabled) {
      await telegram.stop();
      chat.addSystemMessage('📱 Telegram stopped.');
    } else {
      chat.addSystemMessage('📱 Starting Telegram...');
      setStatus('Starting Telegram...');
      try {
        await telegram.start();
        chat.addSystemMessage(
          '📱 Telegram started!\n' +
          'Send /start to your bot to connect.\n' +
          'Commands: /screen, /describe, /run, /status'
        );
      } catch {
        chat.addSystemMessage(`❌ ${telegram.error || 'Telegram failed'}`);
      } finally {
        setStatus('Ready');
      }
    }
  }, [chat, telegram]);

  // Task command
  const handleTaskCommand = useCallback(async (description: string) => {
    chat.addSystemMessage(`📋 Parsing: ${description}`);
    setStatus('Parsing task...');

    try {
      const task = await tasks.run(description);
      chat.addSystemMessage(`\n${tasks.format(task)}`);
      chat.addSystemMessage(task.status === 'completed'
        ? '✅ Task completed!'
        : '❌ Task failed.'
      );
    } catch {
      chat.addSystemMessage(`❌ ${tasks.error || 'Task failed'}`);
    } finally {
      setStatus('Ready');
    }
  }, [chat, tasks]);

  // Check if message looks like a computer control request
  const isComputerControlRequest = useCallback((text: string): boolean => {
    const lower = text.toLowerCase();
    const patterns = [
      /^(can you |please |)?(open|close|minimize|maximize|restore|focus|click|type|press|scroll|move|drag)/i,
      /^(can you |please |)?move (the |my |)mouse/i,
      /^(can you |please |)?(start|launch|run) [a-z]/i,
      /(open|close|minimize|maximize) (the |my |)?[a-z]/i,
      /click (on |the |)/i,
      /type ["'].+["']/i,
      /press (enter|escape|tab|ctrl|alt|shift|space|backspace|delete|f\d+)/i,
    ];
    return patterns.some(p => p.test(lower));
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setInputValue(''); // Clear input immediately

    if (value.startsWith('/')) {
      await handleCommand(value);
    } else if (isComputerControlRequest(value)) {
      // Auto-route to task system for computer control
      chat.addSystemMessage(`🤖 Executing: ${value}`);
      await handleTaskCommand(value);
    } else {
      setStatus('Thinking...');
      await chat.sendMessage(value);
      setStatus('Ready');
    }
  }, [chat, handleCommand, handleTaskCommand, isComputerControlRequest]);

  // Provider selection callback
  const handleProviderSelect = useCallback((provider: string, model: string) => {
    chat.addSystemMessage(`✅ Updated: ${provider} / ${model}`);
  }, [chat]);

  // Render overlays
  if (overlay === 'help') {
    return (
      <Box flexDirection="column" height="100%" alignItems="center" justifyContent="center">
        <HelpMenu
          onClose={() => setOverlay('none')}
          onSelect={(cmd) => { setOverlay('none'); handleCommand(cmd); }}
        />
      </Box>
    );
  }

  if (overlay === 'provider') {
    return (
      <Box flexDirection="column" height="100%" alignItems="center" justifyContent="center">
        <ProviderSelector
          onClose={() => setOverlay('none')}
          onSelect={handleProviderSelect}
        />
      </Box>
    );
  }

  // Main UI
  const visibleMessages = chat.messages.slice(-20);
  const isProcessing = chat.isProcessing || vision.isAnalyzing || tasks.isRunning || telegram.isStarting;

  return (
    <Box flexDirection="column" height="100%">
      <Header screenWatch={screenWatch} telegramEnabled={telegram.isEnabled} />

      <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor="gray" padding={1}>
        <Text bold color="gray"> Chat </Text>
        {visibleMessages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
            isStreaming={msg.isStreaming}
          />
        ))}
      </Box>

      {chat.error && (
        <Box marginY={1}>
          <Text color="red">Error: {chat.error}</Text>
        </Box>
      )}

      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
      />

      <StatusBar status={status} />
    </Box>
  );
}
