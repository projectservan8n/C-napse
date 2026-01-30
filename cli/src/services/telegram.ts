/**
 * Telegram Bot Service - Remote PC control via Telegram
 */

import { EventEmitter } from 'events';
import { getConfig, getApiKey } from '../lib/config.js';
import { describeScreen, captureScreenshot } from '../lib/vision.js';
import { runCommand } from '../tools/shell.js';

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

export class TelegramBotService extends EventEmitter {
  private bot: any = null;
  private isRunning = false;
  private allowedChatIds: Set<number> = new Set();

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
        '/run <cmd> - Execute command\n' +
        '/status - System status\n\n' +
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

    // Handle text messages - forward to AI
    this.bot.on('text', async (ctx: any) => {
      if (!this.isAllowed(ctx.chat.id)) {
        return;
      }

      // Skip commands
      if (ctx.message.text.startsWith('/')) {
        return;
      }

      const message: TelegramMessage = {
        chatId: ctx.chat.id,
        text: ctx.message.text,
        from: ctx.from.username || ctx.from.first_name || 'User',
      };

      this.emit('message', message);
      this.emit('command', 'chat', ctx.message.text, ctx.chat.id);
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
