/**
 * Clipboard tools
 */

import clipboardy from 'clipboardy';
import { ToolResult, ok, err } from './index.js';

/**
 * Get clipboard contents
 */
export async function getClipboard(): Promise<ToolResult> {
  try {
    const text = await clipboardy.read();
    return ok(text);
  } catch (error: any) {
    return err(`Failed to read clipboard: ${error.message}`);
  }
}

/**
 * Set clipboard contents
 */
export async function setClipboard(text: string): Promise<ToolResult> {
  try {
    await clipboardy.write(text);
    return ok(`Copied ${text.length} characters to clipboard`);
  } catch (error: any) {
    return err(`Failed to write clipboard: ${error.message}`);
  }
}

/**
 * Clipboard tool definitions for agents
 */
export const clipboardTools = [
  {
    name: 'get_clipboard',
    description: 'Get clipboard contents',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'set_clipboard',
    description: 'Set clipboard contents',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to copy' },
      },
      required: ['text'],
    },
  },
];
