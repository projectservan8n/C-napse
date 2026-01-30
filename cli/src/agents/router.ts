/**
 * Router Agent - Classifies user intent and dispatches to specialist agents
 */

import type { Agent } from './types.js';

export type AgentType = 'CODER' | 'FILER' | 'SHELL' | 'MEMORY' | 'COMPUTER' | 'VISION' | 'GENERAL';

export const routerAgent: Agent = {
  name: 'router',
  description: 'Classifies user intent and dispatches to the appropriate specialist agent',
  systemPrompt: `You are a routing agent for C-napse. Your job is to analyze user requests and determine which specialist agent should handle them.

Available agents:
- CODER: Code generation, editing, debugging, refactoring
- FILER: File operations (read, write, search, organize)
- SHELL: Shell commands, system operations, process management
- MEMORY: Context recall, summarization, search history
- COMPUTER: Mouse, keyboard, window control, desktop automation
- VISION: Screen capture, describe what's on screen
- GENERAL: General conversation and questions

Respond with ONLY the agent name, nothing else.

Examples:
User: "Write a Python script to sort files by date"
CODER

User: "Find all PDFs in my Documents folder"
FILER

User: "What's using port 8080?"
SHELL

User: "What did we talk about yesterday?"
MEMORY

User: "How does React work?"
GENERAL

User: "Click on the Start button"
COMPUTER

User: "Open notepad and type hello"
COMPUTER

User: "What's on my screen?"
VISION

User: "Take a screenshot"
VISION`,
  tools: [],
  canHandle: () => 1.0,
};

/**
 * Route query to appropriate agent using keyword matching
 */
export function routeByKeywords(query: string): AgentType {
  const q = query.toLowerCase();

  // Code-related keywords
  if (
    q.includes('code') ||
    q.includes('write') ||
    q.includes('function') ||
    q.includes('script') ||
    q.includes('debug') ||
    q.includes('fix') ||
    q.includes('implement') ||
    q.includes('refactor') ||
    q.includes('class') ||
    q.includes('method') ||
    q.includes('program')
  ) {
    return 'CODER';
  }

  // File-related keywords
  if (
    q.includes('file') ||
    q.includes('folder') ||
    q.includes('directory') ||
    q.includes('find') ||
    q.includes('search') ||
    q.includes('list') ||
    q.includes('copy') ||
    q.includes('move') ||
    q.includes('delete') ||
    q.includes('rename') ||
    q.includes('read')
  ) {
    return 'FILER';
  }

  // Shell-related keywords
  if (
    q.includes('run') ||
    q.includes('execute') ||
    q.includes('command') ||
    q.includes('install') ||
    q.includes('process') ||
    q.includes('port') ||
    q.includes('service') ||
    q.includes('start') ||
    q.includes('stop') ||
    q.includes('restart') ||
    q.includes('terminal') ||
    q.includes('shell')
  ) {
    return 'SHELL';
  }

  // Memory-related keywords
  if (
    q.includes('remember') ||
    q.includes('recall') ||
    q.includes('history') ||
    q.includes('yesterday') ||
    q.includes('earlier') ||
    q.includes('before') ||
    q.includes('last time') ||
    q.includes('previous')
  ) {
    return 'MEMORY';
  }

  // Computer control keywords
  if (
    q.includes('click') ||
    q.includes('mouse') ||
    q.includes('type') ||
    q.includes('keyboard') ||
    q.includes('window') ||
    q.includes('open ') ||
    q.includes('close ') ||
    q.includes('minimize') ||
    q.includes('maximize') ||
    q.includes('press') ||
    q.includes('scroll') ||
    q.includes('drag')
  ) {
    return 'COMPUTER';
  }

  // Vision keywords
  if (
    q.includes('screen') ||
    q.includes('screenshot') ||
    q.includes('see') ||
    q.includes('look') ||
    q.includes('what') && q.includes('visible') ||
    q.includes('describe') && q.includes('screen') ||
    q.includes('capture')
  ) {
    return 'VISION';
  }

  return 'GENERAL';
}
