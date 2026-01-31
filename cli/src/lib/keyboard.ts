/**
 * Platform-flexible keyboard utilities for C-napse TUI
 * Supports both Ctrl (Windows/Linux) and Cmd (macOS) modifiers
 */

import { Key } from 'ink';

// Detect platform
export const isMac = process.platform === 'darwin';
export const isWindows = process.platform === 'win32';
export const isLinux = process.platform === 'linux';

/**
 * Check if the primary modifier is pressed
 * - macOS: Cmd (meta) OR Ctrl
 * - Windows/Linux: Ctrl
 */
export function isPrimaryModifier(key: Key): boolean {
  if (isMac) {
    return key.meta || key.ctrl;
  }
  return key.ctrl;
}

/**
 * Check if a specific shortcut is pressed
 * Handles platform differences automatically
 */
export function isShortcut(inputChar: string, key: Key, targetChar: string): boolean {
  const charMatches = inputChar.toLowerCase() === targetChar.toLowerCase();
  return charMatches && isPrimaryModifier(key);
}

/**
 * Get the display string for the primary modifier
 * - macOS: ⌘ (Cmd)
 * - Windows/Linux: Ctrl
 */
export function getModifierDisplay(): string {
  return isMac ? '⌘' : 'Ctrl';
}

/**
 * Format a shortcut for display
 * Examples: "⌘+C" on macOS, "Ctrl+C" on Windows
 */
export function formatShortcut(char: string): string {
  return `${getModifierDisplay()}+${char.toUpperCase()}`;
}

/**
 * Format a shortcut with fallback for cross-platform display
 * Shows both options when needed
 */
export function formatShortcutWithFallback(char: string): string {
  if (isMac) {
    return `⌘/${formatShortcut(char).replace('⌘+', 'Ctrl+')}`;
  }
  return formatShortcut(char);
}

// Predefined shortcuts with their targets
export const SHORTCUTS = {
  EXIT: 'c',
  CLEAR: 'l',
  HELP: 'h',
  PROVIDER: 'p',
  SCREEN_WATCH: 'e',
  TELEGRAM: 't',
} as const;

export type ShortcutKey = keyof typeof SHORTCUTS;

/**
 * Check if a specific named shortcut is pressed
 */
export function isNamedShortcut(inputChar: string, key: Key, shortcut: ShortcutKey): boolean {
  return isShortcut(inputChar, key, SHORTCUTS[shortcut]);
}

/**
 * Get display string for a named shortcut
 */
export function getShortcutDisplay(shortcut: ShortcutKey): string {
  return formatShortcut(SHORTCUTS[shortcut]);
}

/**
 * Shortcut definitions for help menu
 */
export interface ShortcutDefinition {
  key: ShortcutKey;
  display: string;
  description: string;
}

export function getShortcutDefinitions(): ShortcutDefinition[] {
  return [
    { key: 'HELP', display: getShortcutDisplay('HELP'), description: 'Show help menu' },
    { key: 'CLEAR', display: getShortcutDisplay('CLEAR'), description: 'Clear chat' },
    { key: 'SCREEN_WATCH', display: getShortcutDisplay('SCREEN_WATCH'), description: 'Toggle screen watch' },
    { key: 'TELEGRAM', display: getShortcutDisplay('TELEGRAM'), description: 'Toggle Telegram' },
    { key: 'PROVIDER', display: getShortcutDisplay('PROVIDER'), description: 'Change provider' },
    { key: 'EXIT', display: getShortcutDisplay('EXIT'), description: 'Exit' },
  ];
}
