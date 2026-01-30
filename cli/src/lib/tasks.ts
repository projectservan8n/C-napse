/**
 * Task Automation - Multi-step task sequencing
 * Parses natural language into actionable steps and executes them
 * Uses chain-of-thought prompting + learning from past tasks
 */

import { chat, Message } from './api.js';
import * as computer from '../tools/computer.js';
import { describeScreen } from './vision.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type TaskStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

// Task memory file location
const TASK_MEMORY_FILE = path.join(os.homedir(), '.cnapse', 'task-memory.json');

interface TaskPattern {
  input: string;
  normalizedInput: string;
  steps: Array<{ description: string; action: string }>;
  successCount: number;
  lastUsed: string;
}

interface TaskMemory {
  patterns: TaskPattern[];
  version: number;
}

/**
 * Load learned task patterns from disk
 */
function loadTaskMemory(): TaskMemory {
  try {
    if (fs.existsSync(TASK_MEMORY_FILE)) {
      const data = fs.readFileSync(TASK_MEMORY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Ignore errors, return empty memory
  }
  return { patterns: [], version: 1 };
}

/**
 * Save task pattern to memory
 */
function saveTaskPattern(input: string, steps: Array<{ description: string; action: string }>): void {
  try {
    const memory = loadTaskMemory();
    const normalized = normalizeInput(input);

    // Find existing pattern or create new
    const existing = memory.patterns.find(p => p.normalizedInput === normalized);
    if (existing) {
      existing.steps = steps;
      existing.successCount++;
      existing.lastUsed = new Date().toISOString();
    } else {
      memory.patterns.push({
        input,
        normalizedInput: normalized,
        steps,
        successCount: 1,
        lastUsed: new Date().toISOString(),
      });
    }

    // Keep only last 100 patterns
    memory.patterns = memory.patterns
      .sort((a, b) => b.successCount - a.successCount)
      .slice(0, 100);

    // Ensure directory exists
    const dir = path.dirname(TASK_MEMORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(TASK_MEMORY_FILE, JSON.stringify(memory, null, 2));
  } catch {
    // Ignore write errors
  }
}

/**
 * Normalize input for pattern matching
 */
function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find similar learned patterns
 */
function findSimilarPatterns(input: string): TaskPattern[] {
  const memory = loadTaskMemory();
  const normalized = normalizeInput(input);
  const words = normalized.split(' ').filter(w => w.length > 2);

  return memory.patterns
    .filter(pattern => {
      // Check if patterns share key action words
      const patternWords = pattern.normalizedInput.split(' ');
      const matches = words.filter(w => patternWords.includes(w));
      return matches.length >= Math.min(2, words.length * 0.5);
    })
    .sort((a, b) => b.successCount - a.successCount)
    .slice(0, 3);
}

export interface TaskStep {
  id: string;
  description: string;
  action: string; // The actual action to perform
  status: TaskStepStatus;
  result?: string;
  error?: string;
}

export interface Task {
  id: string;
  description: string;
  steps: TaskStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export type TaskProgressCallback = (task: Task, step: TaskStep) => void;

/**
 * Build chain-of-thought prompt for task parsing
 * This guides small models through systematic reasoning
 */
function buildChainOfThoughtPrompt(input: string): string {
  // Find similar patterns the model has successfully executed before
  const similarPatterns = findSimilarPatterns(input);

  let learnedExamples = '';
  if (similarPatterns.length > 0) {
    learnedExamples = `
## LEARNED PATTERNS (from successful past tasks)
These patterns worked before - use them as reference:

${similarPatterns.map((p, i) => `
Pattern ${i + 1} (used ${p.successCount} times):
Input: "${p.input}"
Steps: ${JSON.stringify(p.steps, null, 2)}
`).join('\n')}
`;
  }

  return `You are a task parser for Windows PC automation. Your job is to convert natural language into precise, executable steps.

## THINKING PROCESS
Before outputting steps, THINK through these questions:

1. **WHAT** is the main goal?
   - What application needs to open?
   - What action needs to happen inside it?
   - What is the expected end result?

2. **HOW** to achieve it on Windows?
   - Use Win+R (meta+r) to open Run dialog for apps
   - Wait 1-3 seconds after opening apps for them to load
   - Use keyboard shortcuts when possible (faster, more reliable)
   - Common shortcuts: Ctrl+S (save), Ctrl+O (open), Ctrl+N (new), Alt+F4 (close)

3. **SEQUENCE** - what order makes sense?
   - Open app FIRST
   - WAIT for it to load
   - THEN interact with it
   - Add waits between actions that need time

4. **EDGE CASES** - what could go wrong?
   - App might already be open -> focus_window first
   - Dialogs might appear -> handle or dismiss them
   - Typing too fast -> add small waits

## AVAILABLE ACTIONS
- open_app: Open app via Run dialog (e.g., "open_app:notepad", "open_app:code", "open_app:chrome")
- type_text: Type text string (e.g., "type_text:Hello World")
- press_key: Single key (e.g., "press_key:enter", "press_key:escape", "press_key:tab")
- key_combo: Key combination (e.g., "key_combo:control+s", "key_combo:alt+f4", "key_combo:meta+r")
- click: Mouse click (e.g., "click:left", "click:right")
- wait: Wait N seconds (e.g., "wait:2" - use 1-3s for app loads)
- focus_window: Focus by title (e.g., "focus_window:Notepad")
- screenshot: Capture and describe screen
${learnedExamples}
## EXAMPLES WITH REASONING

### Example 1: "open notepad and type hello"
Thinking:
- Goal: Open Notepad, then type text into it
- How: Win+R -> notepad -> Enter to open, then type
- Sequence: Open -> Wait for load -> Type
- Edge case: Need wait time for Notepad window to be ready

Output:
[
  { "description": "Open Notepad via Run dialog", "action": "open_app:notepad" },
  { "description": "Wait for Notepad to fully load", "action": "wait:2" },
  { "description": "Type the greeting text", "action": "type_text:hello" }
]

### Example 2: "save the current document"
Thinking:
- Goal: Save whatever is in the current app
- How: Ctrl+S is universal save shortcut
- Sequence: Just the key combo, maybe wait for save
- Edge case: If file is new, Save As dialog might appear

Output:
[
  { "description": "Press Ctrl+S to save", "action": "key_combo:control+s" },
  { "description": "Wait for save to complete", "action": "wait:1" }
]

### Example 3: "close this window"
Thinking:
- Goal: Close the current active window
- How: Alt+F4 closes active window on Windows
- Sequence: Single action
- Edge case: Might prompt to save - user handles that

Output:
[
  { "description": "Close active window with Alt+F4", "action": "key_combo:alt+f4" }
]

## YOUR TASK
Now parse this request: "${input}"

First, briefly think through the 4 questions above, then output ONLY a JSON array:
[
  { "description": "Human readable step", "action": "action_type:params" },
  ...
]`;
}

/**
 * Parse natural language task into executable steps
 */
export async function parseTask(input: string): Promise<Task> {
  const systemPrompt = buildChainOfThoughtPrompt(input);

  const messages: Message[] = [
    { role: 'user', content: input }
  ];

  try {
    const response = await chat(messages, systemPrompt);
    const content = response.content || '[]';

    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse task steps');
    }

    const parsedSteps = JSON.parse(jsonMatch[0]) as Array<{ description: string; action: string }>;

    const steps: TaskStep[] = parsedSteps.map((step, index) => ({
      id: `step-${index + 1}`,
      description: step.description,
      action: step.action,
      status: 'pending' as TaskStepStatus,
    }));

    return {
      id: `task-${Date.now()}`,
      description: input,
      steps,
      status: 'pending',
      createdAt: new Date(),
    };
  } catch (error) {
    // If AI parsing fails, try to create a simple task
    return {
      id: `task-${Date.now()}`,
      description: input,
      steps: [{
        id: 'step-1',
        description: input,
        action: `chat:${input}`,
        status: 'pending',
      }],
      status: 'pending',
      createdAt: new Date(),
    };
  }
}

/**
 * Execute a single task step
 */
async function executeStep(step: TaskStep): Promise<void> {
  const [actionType, ...paramParts] = step.action.split(':');
  const params = paramParts.join(':'); // Rejoin in case params contain ':'

  switch (actionType) {
    case 'open_app':
      // Use Windows Run dialog to open apps
      await computer.keyCombo(['meta', 'r']);
      await sleep(500);
      await computer.typeText(params);
      await sleep(300);
      await computer.pressKey('Return');
      step.result = `Opened ${params}`;
      break;

    case 'type_text':
      await computer.typeText(params);
      step.result = `Typed: ${params}`;
      break;

    case 'press_key':
      await computer.pressKey(params);
      step.result = `Pressed ${params}`;
      break;

    case 'key_combo':
      const keys = params.split('+').map(k => k.trim());
      await computer.keyCombo(keys);
      step.result = `Pressed ${params}`;
      break;

    case 'click':
      const button = (params || 'left') as 'left' | 'right' | 'middle';
      await computer.clickMouse(button);
      step.result = `Clicked ${button}`;
      break;

    case 'wait':
      const seconds = parseInt(params) || 1;
      await sleep(seconds * 1000);
      step.result = `Waited ${seconds}s`;
      break;

    case 'focus_window':
      await computer.focusWindow(params);
      step.result = `Focused window: ${params}`;
      break;

    case 'screenshot':
      const vision = await describeScreen();
      step.result = vision.description;
      break;

    case 'chat':
      // This is a fallback - just describe what user wants
      step.result = `Task noted: ${params}`;
      break;

    default:
      throw new Error(`Unknown action: ${actionType}`);
  }
}

/**
 * Execute a complete task with progress callbacks
 */
export async function executeTask(
  task: Task,
  onProgress?: TaskProgressCallback
): Promise<Task> {
  task.status = 'running';

  for (const step of task.steps) {
    if (task.status === 'failed') {
      step.status = 'skipped';
      continue;
    }

    step.status = 'running';
    onProgress?.(task, step);

    try {
      await executeStep(step);
      step.status = 'completed';
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : 'Unknown error';
      task.status = 'failed';
    }

    onProgress?.(task, step);
  }

  if (task.status !== 'failed') {
    task.status = 'completed';

    // Learn from successful tasks - save pattern for future use
    const steps = task.steps.map(s => ({
      description: s.description,
      action: s.action,
    }));
    saveTaskPattern(task.description, steps);
  }
  task.completedAt = new Date();

  return task;
}

/**
 * Helper sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get task memory statistics
 */
export function getTaskMemoryStats(): { patternCount: number; totalUses: number; topPatterns: string[] } {
  const memory = loadTaskMemory();
  const totalUses = memory.patterns.reduce((sum, p) => sum + p.successCount, 0);
  const topPatterns = memory.patterns
    .sort((a, b) => b.successCount - a.successCount)
    .slice(0, 5)
    .map(p => `"${p.input}" (${p.successCount}x)`);

  return {
    patternCount: memory.patterns.length,
    totalUses,
    topPatterns,
  };
}

/**
 * Clear task memory
 */
export function clearTaskMemory(): void {
  try {
    if (fs.existsSync(TASK_MEMORY_FILE)) {
      fs.unlinkSync(TASK_MEMORY_FILE);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Format task for display
 */
export function formatTask(task: Task): string {
  const statusEmoji = {
    pending: '⏳',
    running: '🔄',
    completed: '✅',
    failed: '❌',
  };

  const stepStatusEmoji = {
    pending: '○',
    running: '◐',
    completed: '●',
    failed: '✗',
    skipped: '◌',
  };

  let output = `${statusEmoji[task.status]} Task: ${task.description}\n\n`;

  for (const step of task.steps) {
    output += `  ${stepStatusEmoji[step.status]} ${step.description}`;
    if (step.result) {
      output += ` → ${step.result}`;
    }
    if (step.error) {
      output += ` (Error: ${step.error})`;
    }
    output += '\n';
  }

  return output;
}
