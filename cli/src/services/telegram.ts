/**
 * Telegram Bot Service - Remote PC control via Telegram
 */

import { EventEmitter } from 'events';
import { getConfig, getApiKey } from '../lib/config.js';
import { describeScreen, captureScreenshot } from '../lib/vision.js';
import { runCommand } from '../tools/shell.js';
import { chat as chatWithAI, chatWithVision, Message } from '../lib/api.js';
import * as computer from '../tools/computer.js';
import { parseTask, executeTask, formatTask, Task, TaskStep } from '../lib/tasks.js';

export interface TelegramMessage {
  chatId: number;
  text: string;
  from: string;
}

export interface TelegramBotEvents {
  message: (msg: TelegramMessage) => void;
  command: (cmd: string, args: string, chatId: number) => void;
  error: (error: Error) => void;
  started: () => void;
  stopped: () => void;
}

/**
 * Convert markdown to Telegram-safe format (MarkdownV2)
 * Escapes special characters and converts some markdown syntax
 */
function formatForTelegram(text: string): { text: string; parseMode: 'MarkdownV2' | undefined } {
  // Check if text has markdown that could be rendered
  const hasMarkdown = /[*_`\[\]()]/.test(text);

  if (!hasMarkdown) {
    return { text, parseMode: undefined };
  }

  try {
    // Convert to Telegram MarkdownV2 format
    let formatted = text;

    // First, escape special characters that aren't part of markdown
    // MarkdownV2 requires escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
    const escapeChars = ['\\', '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];

    // Temporarily replace valid markdown with placeholders
    const placeholders: { placeholder: string; original: string }[] = [];
    let placeholderIndex = 0;

    // Protect code blocks (```code```)
    formatted = formatted.replace(/```([\s\S]*?)```/g, (match, code) => {
      const placeholder = `__CODEBLOCK_${placeholderIndex++}__`;
      placeholders.push({ placeholder, original: '```' + code.replace(/\\/g, '\\\\') + '```' });
      return placeholder;
    });

    // Protect inline code (`code`)
    formatted = formatted.replace(/`([^`]+)`/g, (match, code) => {
      const placeholder = `__INLINECODE_${placeholderIndex++}__`;
      placeholders.push({ placeholder, original: '`' + code.replace(/\\/g, '\\\\') + '`' });
      return placeholder;
    });

    // Protect bold (**text** or __text__)
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, (match, text) => {
      const placeholder = `__BOLD_${placeholderIndex++}__`;
      placeholders.push({ placeholder, original: '*' + text + '*' });
      return placeholder;
    });

    // Protect italic (*text* or _text_) - but only single asterisks
    formatted = formatted.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, (match, text) => {
      const placeholder = `__ITALIC_${placeholderIndex++}__`;
      placeholders.push({ placeholder, original: '_' + text + '_' });
      return placeholder;
    });

    // Protect links [text](url)
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      const placeholder = `__LINK_${placeholderIndex++}__`;
      placeholders.push({ placeholder, original: '[' + text + '](' + url + ')' });
      return placeholder;
    });

    // Now escape remaining special characters
    for (const char of escapeChars) {
      if (char === '\\') continue; // Skip backslash for now
      formatted = formatted.split(char).join('\\' + char);
    }

    // Restore placeholders
    for (const { placeholder, original } of placeholders) {
      formatted = formatted.replace(placeholder, original);
    }

    return { text: formatted, parseMode: 'MarkdownV2' };
  } catch {
    // If formatting fails, return plain text
    return { text, parseMode: undefined };
  }
}

/**
 * Send a message with proper formatting, falling back to plain text if markdown fails
 */
async function sendFormattedMessage(ctx: any, text: string): Promise<void> {
  const { text: formatted, parseMode } = formatForTelegram(text);

  try {
    if (parseMode) {
      await ctx.reply(formatted, { parse_mode: parseMode });
    } else {
      await ctx.reply(text);
    }
  } catch {
    // If markdown parsing fails, send as plain text
    await ctx.reply(text);
  }
}

export class TelegramBotService extends EventEmitter {
  private bot: any = null;
  private isRunning = false;
  private allowedChatIds: Set<number> = new Set();
  private chatHistory: Map<number, Message[]> = new Map();

  constructor() {
    super();
  }

  /**
   * Start the Telegram bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    const botToken = getApiKey('telegram');
    if (!botToken) {
      throw new Error('Telegram bot token not configured. Use: cnapse auth telegram YOUR_BOT_TOKEN');
    }

    try {
      // Dynamically import telegraf
      const { Telegraf } = await import('telegraf');
      this.bot = new Telegraf(botToken);

      // Load allowed chat IDs from config
      const config = getConfig();
      if (config.telegram?.chatId) {
        this.allowedChatIds.add(config.telegram.chatId);
      }

      this.setupHandlers();

      // Start polling
      await this.bot.launch();
      this.isRunning = true;
      this.emit('started');
    } catch (error) {
      throw new Error(`Failed to start Telegram bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop the Telegram bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.bot) {
      return;
    }

    this.bot.stop('SIGTERM');
    this.isRunning = false;
    this.bot = null;
    this.emit('stopped');
  }

  /**
   * Check if bot is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Setup message and command handlers
   */
  private setupHandlers(): void {
    if (!this.bot) return;

    // /start command - registers user
    this.bot.command('start', async (ctx: any) => {
      const chatId = ctx.chat.id;
      this.allowedChatIds.add(chatId);
      await ctx.reply(
        '🤖 C-napse connected!\n\n' +
        'Commands:\n' +
        '/screen - Take screenshot\n' +
        '/describe - Screenshot + AI description\n' +
        '/task <desc> - Multi-step automation\n' +
        '/run <cmd> - Execute shell command\n' +
        '/status - System status\n\n' +
        'Examples:\n' +
        '• /task open folder E:/Test and list files\n' +
        '• /task open notepad and type hello\n' +
        '• minimize chrome\n' +
        '• what windows are open?\n\n' +
        `Your chat ID: ${chatId}`
      );
    });

    // /screen command - send screenshot
    this.bot.command('screen', async (ctx: any) => {
      if (!this.isAllowed(ctx.chat.id)) {
        await ctx.reply('⛔ Not authorized. Send /start first.');
        return;
      }

      await ctx.reply('📸 Taking screenshot...');

      try {
        const screenshot = await captureScreenshot();
        if (!screenshot) {
          await ctx.reply('❌ Failed to capture screenshot');
          return;
        }

        // Send as photo
        const buffer = Buffer.from(screenshot, 'base64');
        await ctx.replyWithPhoto({ source: buffer }, { caption: '📸 Current screen' });
      } catch (error) {
        await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // /describe command - screenshot + AI description
    this.bot.command('describe', async (ctx: any) => {
      if (!this.isAllowed(ctx.chat.id)) {
        await ctx.reply('⛔ Not authorized. Send /start first.');
        return;
      }

      await ctx.reply('🔍 Analyzing screen...');

      try {
        const result = await describeScreen();
        const buffer = Buffer.from(result.screenshot, 'base64');

        // Send photo with description as caption
        const caption = `🖥️ Screen Analysis:\n\n${result.description}`.slice(0, 1024); // Telegram caption limit
        await ctx.replyWithPhoto({ source: buffer }, { caption });

        // If description is longer, send the rest as text
        if (result.description.length > 900) {
          await ctx.reply(result.description);
        }
      } catch (error) {
        await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // /run command - execute shell command
    this.bot.command('run', async (ctx: any) => {
      if (!this.isAllowed(ctx.chat.id)) {
        await ctx.reply('⛔ Not authorized. Send /start first.');
        return;
      }

      const cmd = ctx.message.text.replace('/run ', '').trim();
      if (!cmd) {
        await ctx.reply('Usage: /run <command>\nExample: /run dir');
        return;
      }

      await ctx.reply(`⚙️ Running: ${cmd}`);

      try {
        const result = await runCommand(cmd, 30000);
        if (result.success) {
          const output = result.output.slice(0, 4000) || '(no output)';
          await ctx.reply(`✅ Output:\n\`\`\`\n${output}\n\`\`\``, { parse_mode: 'Markdown' });
        } else {
          await ctx.reply(`❌ Error:\n\`\`\`\n${result.error}\n\`\`\``, { parse_mode: 'Markdown' });
        }
      } catch (error) {
        await ctx.reply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // /status command - system status
    this.bot.command('status', async (ctx: any) => {
      if (!this.isAllowed(ctx.chat.id)) {
        await ctx.reply('⛔ Not authorized. Send /start first.');
        return;
      }

      const config = getConfig();
      const status = [
        '📊 C-napse Status',
        '',
        `Provider: ${config.provider}`,
        `Model: ${config.model}`,
        `Platform: ${process.platform}`,
        `Node: ${process.version}`,
      ].join('\n');

      await ctx.reply(status);
    });

    // /task command - multi-step task automation
    this.bot.command('task', async (ctx: any) => {
      if (!this.isAllowed(ctx.chat.id)) {
        await ctx.reply('⛔ Not authorized. Send /start first.');
        return;
      }

      const taskDescription = ctx.message.text.replace('/task', '').trim();
      if (!taskDescription) {
        await ctx.reply(
          '📋 Usage: /task <description>\n\n' +
          'Examples:\n' +
          '• /task open notepad and type hello\n' +
          '• /task open folder E:/Test and list files\n' +
          '• /task search google for weather today\n' +
          '• /task open chrome and go to github.com'
        );
        return;
      }

      await ctx.reply(`🎯 Parsing task: "${taskDescription}"`);

      try {
        // Parse the task into steps
        const task = await parseTask(taskDescription);

        // Show the parsed steps
        let stepsPreview = `📋 Task broken into ${task.steps.length} steps:\n\n`;
        task.steps.forEach((step, i) => {
          stepsPreview += `${i + 1}. ${step.description}\n`;
        });
        stepsPreview += '\n⏳ Executing...';
        await ctx.reply(stepsPreview);

        // Execute the task with progress updates
        let lastUpdate = Date.now();
        const updatedTask = await executeTask(task, async (t: Task, step: TaskStep) => {
          // Send progress update (throttled to avoid spam)
          const now = Date.now();
          if (now - lastUpdate > 2000) { // Update every 2 seconds max
            lastUpdate = now;
            const stepNum = t.steps.indexOf(step) + 1;
            const status = step.status === 'running' ? '🔄' : step.status === 'completed' ? '✅' : '❌';
            await ctx.sendChatAction('typing');
          }
        });

        // Send final result
        const result = formatTask(updatedTask);

        // Split if too long
        if (result.length > 4000) {
          const chunks = result.match(/.{1,4000}/gs) || [result];
          for (const chunk of chunks) {
            await sendFormattedMessage(ctx, chunk);
          }
        } else {
          await sendFormattedMessage(ctx, result);
        }

        // If task had vision/screenshot steps, send a final screenshot
        const hasScreenStep = updatedTask.steps.some(s =>
          s.action.includes('screenshot') || s.action.includes('describe')
        );
        if (hasScreenStep || updatedTask.status === 'completed') {
          try {
            const screenshot = await captureScreenshot();
            if (screenshot) {
              const buffer = Buffer.from(screenshot, 'base64');
              await ctx.replyWithPhoto({ source: buffer }, {
                caption: updatedTask.status === 'completed'
                  ? '✅ Task completed - current screen'
                  : '📸 Final screen state'
              });
            }
          } catch {
            // Screenshot failed, that's ok
          }
        }
      } catch (error) {
        await ctx.reply(`❌ Task failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Handle text messages - forward to AI and respond
    this.bot.on('text', async (ctx: any) => {
      if (!this.isAllowed(ctx.chat.id)) {
        return;
      }

      // Skip commands
      if (ctx.message.text.startsWith('/')) {
        return;
      }

      const chatId = ctx.chat.id;
      const userText = ctx.message.text;
      const from = ctx.from.username || ctx.from.first_name || 'User';

      const message: TelegramMessage = {
        chatId,
        text: userText,
        from,
      };

      this.emit('message', message);

      // Get or initialize chat history for this user
      if (!this.chatHistory.has(chatId)) {
        this.chatHistory.set(chatId, []);
      }
      const history = this.chatHistory.get(chatId)!;

      // Add user message to history
      history.push({ role: 'user', content: userText });

      // Keep only last 10 messages for context
      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }

      try {
        // Send typing indicator
        await ctx.sendChatAction('typing');

        // Check if this looks like a computer control request
        const computerControlResult = await this.tryComputerControl(userText);
        if (computerControlResult) {
          await sendFormattedMessage(ctx, computerControlResult);
          history.push({ role: 'assistant', content: computerControlResult });
          return;
        }

        // Check if this looks like a screen/vision request
        const isVisionRequest = /screen|see|look|what('?s| is) (on|visible)|show me|screenshot/i.test(userText);

        let response;
        if (isVisionRequest) {
          // Capture screenshot and use vision
          const screenshot = await captureScreenshot();
          if (screenshot) {
            response = await chatWithVision(history, screenshot);
          } else {
            response = await chatWithAI(history);
          }
        } else {
          response = await chatWithAI(history);
        }

        // Add assistant response to history
        history.push({ role: 'assistant', content: response.content });

        // Send response with proper formatting (split if too long for Telegram)
        const responseText = response.content || '(no response)';
        if (responseText.length > 4000) {
          // Split into chunks
          const chunks = responseText.match(/.{1,4000}/gs) || [responseText];
          for (const chunk of chunks) {
            await sendFormattedMessage(ctx, chunk);
          }
        } else {
          await sendFormattedMessage(ctx, responseText);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        await ctx.reply(`❌ Error: ${errorMsg}`);
        this.emit('error', new Error(errorMsg));
      }
    });

    // Error handling
    this.bot.catch((err: Error) => {
      this.emit('error', err);
    });
  }

  /**
   * Check if chat is authorized
   */
  private isAllowed(chatId: number): boolean {
    // If no chat IDs configured, allow all (first-come authorization)
    if (this.allowedChatIds.size === 0) {
      return true;
    }
    return this.allowedChatIds.has(chatId);
  }

  /**
   * Try to execute computer control commands directly
   * Returns response string if handled, null if not a computer command
   */
  private async tryComputerControl(text: string): Promise<string | null> {
    const lower = text.toLowerCase();

    // Minimize window
    let match = lower.match(/minimize\s+(?:the\s+)?(.+)/i);
    if (match) {
      const result = await computer.minimizeWindow(match[1].trim());
      return result.success ? `✅ ${result.output}` : `❌ ${result.error}`;
    }

    // Maximize window
    match = lower.match(/maximize\s+(?:the\s+)?(.+)/i);
    if (match) {
      const result = await computer.maximizeWindow(match[1].trim());
      return result.success ? `✅ ${result.output}` : `❌ ${result.error}`;
    }

    // Close window
    match = lower.match(/close\s+(?:the\s+)?(.+)/i);
    if (match) {
      const result = await computer.closeWindow(match[1].trim());
      return result.success ? `✅ ${result.output}` : `❌ ${result.error}`;
    }

    // Restore window
    match = lower.match(/restore\s+(?:the\s+)?(.+)/i);
    if (match) {
      const result = await computer.restoreWindow(match[1].trim());
      return result.success ? `✅ ${result.output}` : `❌ ${result.error}`;
    }

    // Focus/open window - but NOT if it looks like a multi-step task
    // Skip if text contains task indicators: "and", "then", "tell me", "list", "what", etc.
    const looksLikeTask = /\b(and|then|after|tell me|list|what|show|describe|check|find|search|create|write|type\s+.+\s+in)\b/i.test(text);
    if (!looksLikeTask) {
      match = lower.match(/(?:focus|open|switch to)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i);
      if (match) {
        const result = await computer.focusWindow(match[1].trim());
        return result.success ? `✅ ${result.output}` : `❌ ${result.error}`;
      }
    }

    // Type text
    match = text.match(/type\s+["'](.+)["']/i);
    if (match) {
      const result = await computer.typeText(match[1]);
      return result.success ? `✅ ${result.output}` : `❌ ${result.error}`;
    }

    // Press key
    match = lower.match(/press\s+(?:the\s+)?(\w+)/i);
    if (match) {
      const result = await computer.pressKey(match[1]);
      return result.success ? `✅ ${result.output}` : `❌ ${result.error}`;
    }

    // Click
    if (/^click$/i.test(lower) || /click\s+(?:the\s+)?mouse/i.test(lower)) {
      const result = await computer.clickMouse('left');
      return result.success ? `✅ ${result.output}` : `❌ ${result.error}`;
    }

    // Right click
    if (/right\s*click/i.test(lower)) {
      const result = await computer.clickMouse('right');
      return result.success ? `✅ ${result.output}` : `❌ ${result.error}`;
    }

    // Double click
    if (/double\s*click/i.test(lower)) {
      const result = await computer.doubleClick();
      return result.success ? `✅ ${result.output}` : `❌ ${result.error}`;
    }

    // Move mouse to coordinates
    match = lower.match(/move\s+(?:the\s+)?mouse\s+(?:to\s+)?(\d+)[,\s]+(\d+)/i);
    if (match) {
      const result = await computer.moveMouse(parseInt(match[1]), parseInt(match[2]));
      return result.success ? `✅ ${result.output}` : `❌ ${result.error}`;
    }

    // Scroll
    match = lower.match(/scroll\s+(up|down)(?:\s+(\d+))?/i);
    if (match) {
      const amount = match[1] === 'up' ? (parseInt(match[2]) || 3) : -(parseInt(match[2]) || 3);
      const result = await computer.scrollMouse(amount);
      return result.success ? `✅ ${result.output}` : `❌ ${result.error}`;
    }

    // List windows
    if (/list\s+(?:all\s+)?windows/i.test(lower) || /what\s+windows/i.test(lower)) {
      const result = await computer.listWindows();
      return result.success ? `📋 Open Windows:\n${result.output}` : `❌ ${result.error}`;
    }

    // Get active window
    if (/(?:active|current|focused)\s+window/i.test(lower) || /what\s+(?:window|app)/i.test(lower)) {
      const result = await computer.getActiveWindow();
      return result.success ? `🪟 Active: ${result.output}` : `❌ ${result.error}`;
    }

    // Mouse position
    if (/mouse\s+position/i.test(lower) || /where.*mouse/i.test(lower)) {
      const result = await computer.getMousePosition();
      return result.success ? `🖱️ ${result.output}` : `❌ ${result.error}`;
    }

    // Not a computer control command
    return null;
  }

  /**
   * Send a message to a specific chat
   */
  async sendMessage(chatId: number, text: string): Promise<void> {
    if (!this.bot || !this.isRunning) {
      throw new Error('Telegram bot is not running');
    }
    await this.bot.telegram.sendMessage(chatId, text);
  }

  /**
   * Send a photo to a specific chat
   */
  async sendPhoto(chatId: number, base64Image: string, caption?: string): Promise<void> {
    if (!this.bot || !this.isRunning) {
      throw new Error('Telegram bot is not running');
    }
    const buffer = Buffer.from(base64Image, 'base64');
    await this.bot.telegram.sendPhoto(chatId, { source: buffer }, { caption });
  }
}

// Singleton instance
let instance: TelegramBotService | null = null;

export function getTelegramBot(): TelegramBotService {
  if (!instance) {
    instance = new TelegramBotService();
  }
  return instance;
}

export default TelegramBotService;
