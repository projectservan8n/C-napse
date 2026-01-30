/**
 * Telegram Hook - Remote PC control via Telegram bot
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getTelegramBot, TelegramMessage } from '../services/telegram.js';

export interface UseTelegramResult {
  isEnabled: boolean;
  isStarting: boolean;
  error: string | null;
  lastMessage: TelegramMessage | null;
  toggle: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function useTelegram(onMessage?: (msg: TelegramMessage) => void): UseTelegramResult {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<TelegramMessage | null>(null);
  const onMessageRef = useRef(onMessage);

  // Keep callback ref updated
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const start = useCallback(async () => {
    if (isEnabled) return;

    setIsStarting(true);
    setError(null);

    try {
      const bot = getTelegramBot();

      // Setup event handlers
      bot.on('message', (msg: TelegramMessage) => {
        setLastMessage(msg);
        onMessageRef.current?.(msg);
      });

      bot.on('error', (err: Error) => {
        setError(err.message);
      });

      await bot.start();
      setIsEnabled(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start Telegram bot';
      setError(errorMsg);
      throw err;
    } finally {
      setIsStarting(false);
    }
  }, [isEnabled]);

  const stop = useCallback(async () => {
    if (!isEnabled) return;

    try {
      const bot = getTelegramBot();
      await bot.stop();
      setIsEnabled(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to stop Telegram bot';
      setError(errorMsg);
      throw err;
    }
  }, [isEnabled]);

  const toggle = useCallback(async () => {
    if (isEnabled) {
      await stop();
    } else {
      await start();
    }
  }, [isEnabled, start, stop]);

  return {
    isEnabled,
    isStarting,
    error,
    lastMessage,
    toggle,
    start,
    stop,
  };
}
