import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Header } from './Header.js';
import { ChatMessage } from './ChatMessage.js';
import { ChatInput } from './ChatInput.js';
import { StatusBar } from './StatusBar.js';
import { chat, Message } from '../lib/api.js';
import { getScreenDescription } from '../lib/screen.js';

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

    switch (command) {
      case 'clear':
        setMessages([messages[0]!]);
        addSystemMessage('Chat cleared.');
        break;
      case 'help':
        addSystemMessage(
          'Commands:\n  /clear - Clear chat history\n  /help  - Show this help\n\nJust type naturally to chat with the AI!'
        );
        break;
      default:
        addSystemMessage(`Unknown command: ${command}`);
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

  return (
    <Box flexDirection="column" height="100%">
      <Header screenWatch={screenWatch} />

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
