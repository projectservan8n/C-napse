/**
 * Chat Hook - AI conversation management
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { chat, chatWithVision, Message } from '../lib/api.js';
import { captureScreenshot } from '../lib/vision.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface UseChatResult {
  messages: ChatMessage[];
  isProcessing: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  addSystemMessage: (content: string) => void;
  clearMessages: () => void;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: '0',
  role: 'system',
  content: 'Welcome to C-napse! Type your message and press Enter.\n\nShortcuts: Ctrl+H for help, Ctrl+P for provider',
  timestamp: new Date(),
};

export function useChat(screenWatch: boolean = false): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const screenWatchRef = useRef(screenWatch);

  // Keep ref in sync with prop
  useEffect(() => {
    screenWatchRef.current = screenWatch;
  }, [screenWatch]);

  const addSystemMessage = useCallback((content: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'system',
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isProcessing) return;

    setError(null);

    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    // Add assistant placeholder
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsProcessing(true);

    try {
      // Build message history
      const apiMessages: Message[] = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      apiMessages.push({ role: 'user', content });

      let response;

      // If screen watching is enabled, capture screenshot and use vision API
      if (screenWatchRef.current) {
        const screenshot = await captureScreenshot();
        if (screenshot) {
          response = await chatWithVision(apiMessages, screenshot);
        } else {
          // Fallback to regular chat if screenshot fails
          response = await chat(apiMessages);
        }
      } else {
        response = await chat(apiMessages);
      }

      // Update assistant message
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: response.content || '(no response)', isStreaming: false }
            : m
        )
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `Error: ${errorMsg}`, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsProcessing(false);
    }
  }, [messages, isProcessing]);

  const clearMessages = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setError(null);
  }, []);

  return {
    messages,
    isProcessing,
    error,
    sendMessage,
    addSystemMessage,
    clearMessages,
  };
}
