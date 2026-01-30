/**
 * Task Automation - Multi-step task sequencing
 * Parses natural language into actionable steps and executes them
 */

import { chat, Message } from './api.js';
import * as computer from '../tools/computer.js';
import { describeScreen } from './vision.js';

export type TaskStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

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
 * Parse natural language task into executable steps
 */
export async function parseTask(input: string): Promise<Task> {
  const systemPrompt = `You are a task parser for PC automation. Convert user requests into specific, executable steps.

Available actions:
- open_app: Open an application (e.g., "open_app:notepad", "open_app:vscode")
- type_text: Type text (e.g., "type_text:Hello World")
- press_key: Press a key (e.g., "press_key:enter", "press_key:escape")
- key_combo: Key combination (e.g., "key_combo:control+s", "key_combo:alt+f4")
- click: Click mouse (e.g., "click:left", "click:right")
- wait: Wait seconds (e.g., "wait:2")
- focus_window: Focus window by title (e.g., "focus_window:Notepad")
- screenshot: Take screenshot and describe

Respond ONLY with a JSON array of steps, no other text:
[
  { "description": "Human readable step", "action": "action_type:params" },
  ...
]

Example input: "open notepad and type hello world"
Example output:
[
  { "description": "Open Notepad", "action": "open_app:notepad" },
  { "description": "Wait for Notepad to open", "action": "wait:2" },
  { "description": "Type hello world", "action": "type_text:Hello World" }
]

Example input: "open vscode, go to folder E:\\Projects, then open terminal"
Example output:
[
  { "description": "Open VS Code", "action": "open_app:code" },
  { "description": "Wait for VS Code to load", "action": "wait:3" },
  { "description": "Open folder with Ctrl+K Ctrl+O", "action": "key_combo:control+k" },
  { "description": "Wait for dialog", "action": "wait:1" },
  { "description": "Continue folder open", "action": "key_combo:control+o" },
  { "description": "Wait for folder dialog", "action": "wait:1" },
  { "description": "Type folder path", "action": "type_text:E:\\\\Projects" },
  { "description": "Press Enter to open folder", "action": "press_key:enter" },
  { "description": "Wait for folder to load", "action": "wait:2" },
  { "description": "Open terminal with Ctrl+\`", "action": "key_combo:control+\`" }
]`;

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
