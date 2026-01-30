/**
 * Coder Agent - Code generation and editing
 */

import type { Agent } from './types.js';
import { filesystemTools } from '../tools/filesystem.js';
import { shellTools } from '../tools/shell.js';

export const coderAgent: Agent = {
  name: 'coder',
  description: 'Code generation, editing, debugging, refactoring',
  systemPrompt: `You are the Coder agent for C-napse. You help users write, edit, and debug code.

Guidelines:
- Write clean, well-documented code
- Follow best practices for the language
- Include error handling
- Add helpful comments
- Suggest improvements when appropriate

Available tools:
- read_file: Read source files
- write_file: Write/create files
- list_dir: Browse project structure
- find_files: Search for files
- run_command: Execute build/test commands

When writing code:
1. Understand the requirements first
2. Check existing code structure
3. Write modular, reusable code
4. Test when possible
5. Explain your implementation

Languages you excel at:
- JavaScript/TypeScript
- Python
- Rust
- Go
- HTML/CSS
- Shell scripts
- And many more!

Format code blocks with language hints:
\`\`\`typescript
// code here
\`\`\``,
  tools: [...filesystemTools, ...shellTools.slice(0, 1)], // Include run_command
  canHandle: (intent: string) => {
    const lower = intent.toLowerCase();
    if (
      lower.includes('code') ||
      lower.includes('write') ||
      lower.includes('function') ||
      lower.includes('debug') ||
      lower.includes('implement')
    ) {
      return 0.9;
    }
    return 0.2;
  },
};
