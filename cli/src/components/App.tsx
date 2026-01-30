import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Header } from './Header.js';
import { ChatMessage } from './ChatMessage.js';
import { ChatInput } from './ChatInput.js';
import { StatusBar } from './StatusBar.js';
import { HelpMenu } from './HelpMenu.js';
import { ProviderSelector } from './ProviderSelector.js';
import { chat, Message } from '../lib/api.js';
import { getConfig } from '../lib/config.js';
import { getScreenDescription } from '../lib/screen.js';
import { describeScreen } from '../lib/vision.js';
import { getTelegramBot, TelegramMessage } from '../services/telegram.js';
import { parseTask, executeTask, formatTask, Task } from '../lib/tasks.js';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export function App() {
  const { exit } = useApp();
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: '0',
      role: 'system',
      content: 'Welcome to C-napse! Type your message and press Enter.\n\nShortcuts:\n  Ctrl+C - Exit\n  Ctrl+W - Toggle screen watch\n  /clear - Clear chat\n  /help  - Show help',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState<string | null>(null);
  const [screenWatch, setScreenWatch] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [showProviderSelector, setShowProviderSelector] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const screenContextRef = useRef<string | null>(null);

  // Screen watching effect
  useEffect(() => {
    if (!screenWatch) {
      screenContextRef.current = null;
      return;
    }

    const checkScreen = async () => {
      const desc = await getScreenDescription();
      if (desc) {
        screenContextRef.current = desc;
      }
    };

    checkScreen();
    const interval = setInterval(checkScreen, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [screenWatch]);

  useInput((inputChar, key) => {
    // If any menu is open, don't process other shortcuts
    if (showHelpMenu || showProviderSelector) {
      return;
    }

    if (key.ctrl && inputChar === 'c') {
      exit();
    }
    if (key.ctrl && inputChar === 'l') {
      setMessages([messages[0]!]); // Keep welcome message
      setError(null);
    }
    if (key.ctrl && inputChar === 'w') {
      setScreenWatch((prev) => {
        const newState = !prev;
        addSystemMessage(
          newState
            ? '🖥️ Screen watching enabled. AI will have context of your screen.'
            : '🖥️ Screen watching disabled.'
        );
        return newState;
      });
    }
    if (key.ctrl && inputChar === 'h') {
      setShowHelpMenu(true);
    }
    if (key.ctrl && inputChar === 't') {
      setTelegramEnabled((prev) => {
        const newState = !prev;
        addSystemMessage(
          newState
            ? '📱 Telegram bot enabled.'
            : '📱 Telegram bot disabled.'
        );
        return newState;
      });
    }
    if (key.ctrl && inputChar === 'p') {
      setShowProviderSelector(true);
    }
  });

  const handleSubmit = async (value: string) => {
    if (!value.trim() || isProcessing) return;

    const userInput = value.trim();
    setInput('');
    setError(null);

    // Handle commands
    if (userInput.startsWith('/')) {
      handleCommand(userInput);
      return;
    }

    // Add user message
    const userMsg: ChatMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Add placeholder for assistant
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    setIsProcessing(true);
    setStatus('Thinking...');

    try {
      // Build message history for API
      const apiMessages: Message[] = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      // Add screen context if watching
      let finalInput = userInput;
      if (screenWatch && screenContextRef.current) {
        finalInput = `[Screen context: ${screenContextRef.current}]\n\n${userInput}`;
      }

      apiMessages.push({ role: 'user', content: finalInput });

      const response = await chat(apiMessages);

      // Update assistant message with response
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: response.content || '(no response)', isStreaming: false }
            : m
        )
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      // Update assistant message with error
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${errorMsg}`, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsProcessing(false);
      setStatus('Ready');
    }
  };

  const handleCommand = (cmd: string) => {
    const parts = cmd.slice(1).split(' ');
    const command = parts[0];
    const args = parts.slice(1).join(' ');

    switch (command) {
      case 'clear':
        setMessages([messages[0]!]);
        addSystemMessage('Chat cleared.');
        break;
      case 'help':
        setShowHelpMenu(true);
        break;
      case 'watch':
        setScreenWatch((prev) => {
          const newState = !prev;
          addSystemMessage(
            newState
              ? '🖥️ Screen watching enabled.'
              : '🖥️ Screen watching disabled.'
          );
          return newState;
        });
        break;
      case 'telegram':
        handleTelegramToggle();
        break;
      case 'screen':
        handleScreenCommand();
        break;
      case 'task':
        if (args) {
          handleTaskCommand(args);
        } else {
          addSystemMessage('Usage: /task <description>\nExample: /task open notepad and type hello');
        }
        break;
      case 'config': {
        const config = getConfig();
        addSystemMessage(
          `⚙️ Current Configuration:\n` +
          `  Provider: ${config.provider}\n` +
          `  Model: ${config.model}\n` +
          `  Ollama Host: ${config.ollamaHost}\n\n` +
          `Use /provider to change provider/model`
        );
        break;
      }
      case 'model':
      case 'provider':
        setShowProviderSelector(true);
        break;
      case 'quit':
      case 'exit':
        exit();
        break;
      default:
        addSystemMessage(`Unknown command: ${command}\nType /help to see available commands.`);
    }
  };

  const handleHelpMenuSelect = (command: string) => {
    // Execute the selected command
    handleCommand(command);
  };

  const handleProviderSelect = (provider: string, model: string) => {
    addSystemMessage(`✅ Configuration updated:\n  Provider: ${provider}\n  Model: ${model}`);
  };

  const handleScreenCommand = async () => {
    addSystemMessage('📸 Taking screenshot and analyzing...');
    setStatus('Analyzing screen...');
    setIsProcessing(true);

    try {
      const result = await describeScreen();
      addSystemMessage(`🖥️ Screen Analysis:\n\n${result.description}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Vision analysis failed';
      addSystemMessage(`❌ Screen capture failed: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
      setStatus('Ready');
    }
  };

  const handleTaskCommand = async (taskDescription: string) => {
    addSystemMessage(`📋 Parsing task: ${taskDescription}`);
    setStatus('Parsing task...');
    setIsProcessing(true);

    try {
      // Parse the task into steps
      const task = await parseTask(taskDescription);
      addSystemMessage(`📋 Task planned (${task.steps.length} steps):\n${formatTask(task)}`);

      // Execute the task
      addSystemMessage('🚀 Executing task...');
      setStatus('Executing task...');

      await executeTask(task, (updatedTask, currentStep) => {
        // Update progress
        if (currentStep.status === 'running') {
          setStatus(`Running: ${currentStep.description}`);
        }
      });

      // Show final result
      addSystemMessage(`\n${formatTask(task)}`);

      if (task.status === 'completed') {
        addSystemMessage('✅ Task completed successfully!');
      } else {
        addSystemMessage('❌ Task failed. Check the steps above for errors.');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Task failed';
      addSystemMessage(`❌ Task error: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
      setStatus('Ready');
    }
  };

  const handleTelegramToggle = async () => {
    const bot = getTelegramBot();

    if (telegramEnabled) {
      // Stop the bot
      try {
        await bot.stop();
        setTelegramEnabled(false);
        addSystemMessage('📱 Telegram bot stopped.');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to stop bot';
        addSystemMessage(`❌ Error stopping bot: ${errorMsg}`);
      }
    } else {
      // Start the bot
      addSystemMessage('📱 Starting Telegram bot...');
      setStatus('Starting Telegram...');

      try {
        // Setup event handlers
        bot.on('message', (msg: TelegramMessage) => {
          addSystemMessage(`📱 Telegram [${msg.from}]: ${msg.text}`);
        });

        bot.on('error', (error: Error) => {
          addSystemMessage(`📱 Telegram error: ${error.message}`);
        });

        await bot.start();
        setTelegramEnabled(true);
        addSystemMessage(
          '📱 Telegram bot started!\n\n' +
          'Open Telegram and send /start to your bot to connect.\n' +
          'Commands: /screen, /describe, /run <cmd>, /status'
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to start bot';
        addSystemMessage(`❌ Telegram error: ${errorMsg}`);
      } finally {
        setStatus('Ready');
      }
    }
  };

  const addSystemMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'system',
        content,
        timestamp: new Date(),
      },
    ]);
  };

  // Only show last N messages that fit
  const visibleMessages = messages.slice(-20);

  // If help menu is open, show it as overlay
  if (showHelpMenu) {
    return (
      <Box flexDirection="column" height="100%" alignItems="center" justifyContent="center">
        <HelpMenu
          onClose={() => setShowHelpMenu(false)}
          onSelect={handleHelpMenuSelect}
        />
      </Box>
    );
  }

  // If provider selector is open, show it as overlay
  if (showProviderSelector) {
    return (
      <Box flexDirection="column" height="100%" alignItems="center" justifyContent="center">
        <ProviderSelector
          onClose={() => setShowProviderSelector(false)}
          onSelect={handleProviderSelect}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Header screenWatch={screenWatch} telegramEnabled={telegramEnabled} />

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

      {error && (
        <Box marginY={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
      />

      <StatusBar status={status} />
    </Box>
  );
}
