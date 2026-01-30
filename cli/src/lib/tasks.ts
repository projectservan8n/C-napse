/**
 * Task Automation - Multi-step task sequencing
 * Parses natural language into actionable steps and executes them
 * Uses chain-of-thought prompting + learning from past tasks
 */

import { chat, chatWithVision, Message } from './api.js';
import * as computer from '../tools/computer.js';
import { describeScreen, captureScreenshot } from './vision.js';
import * as filesystem from '../tools/filesystem.js';
import { runCommand } from '../tools/shell.js';
import * as browser from '../services/browser.js';
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

### App Control
- open_app: Open app via Run dialog (e.g., "open_app:notepad", "open_app:code", "open_app:chrome")
- open_folder: Open VS Code with folder (e.g., "open_folder:E:/MyProject")
- focus_window: Focus by title (e.g., "focus_window:Notepad")

### Input
- type_text: Type text string (e.g., "type_text:Hello World")
- press_key: Single key (e.g., "press_key:enter", "press_key:escape", "press_key:tab")
- key_combo: Key combination (e.g., "key_combo:control+s", "key_combo:alt+f4", "key_combo:meta+r")
- click: Mouse click (e.g., "click:left", "click:right")

### File Operations
- read_file: Read file contents (e.g., "read_file:E:/test/index.html")
- write_file: Write content to file (e.g., "write_file:E:/test/output.txt|Hello World")
- list_files: List files in directory (e.g., "list_files:E:/test")

### AI Coding
- generate_code: AI generates code based on description (e.g., "generate_code:E:/test/index.html|create an HTML page with input on left, output on right")
- edit_code: AI modifies existing code (e.g., "edit_code:E:/test/app.js|add error handling to the fetch calls")

### Web Browsing
- open_url: Open URL in default browser (e.g., "open_url:https://perplexity.ai")
- browse_and_ask: Open AI website, type question, wait for response (e.g., "browse_and_ask:perplexity|What is the capital of France?")
- browse_and_ask: Supports: perplexity, chatgpt, claude, google, copilot, bard
- web_search: Search Google and extract results (e.g., "web_search:best restaurants in NYC")

### Email
- send_email: Send email via Gmail or Outlook web (e.g., "send_email:gmail|to@email.com|Subject|Body text here")
- send_email: Supports: gmail, outlook

### Google Apps (via browser)
- google_sheets: Interact with Google Sheets (e.g., "google_sheets:new|My Spreadsheet" or "google_sheets:type|A1|Hello World")
- google_sheets: Commands: new (create), open (open existing), type (type in cell), read (screenshot current view)
- google_docs: Interact with Google Docs (e.g., "google_docs:new|My Document" or "google_docs:type|Hello World")
- google_docs: Commands: new (create), open (open existing), type (type text)

### Research
- research: Multi-step web research - searches, gathers info, summarizes (e.g., "research:What are the latest AI trends in 2024?")

### Adaptive/Learning
- ask_llm: Ask another LLM for help with a screenshot (e.g., "ask_llm:perplexity|How do I do X in this app?")
- ask_llm: Supports: perplexity, chatgpt, claude, copilot - sends screenshot + question, gets answer
- adaptive_do: Try to accomplish something, if stuck ask LLMs for help (e.g., "adaptive_do:book a flight to NYC on kayak.com")
- learn_ui: Take screenshot and learn how to interact with current UI (e.g., "learn_ui:What buttons can I click here?")

### Utility
- wait: Wait N seconds (e.g., "wait:2" - use 1-3s for app loads)
- screenshot: Capture and describe screen
- shell: Run shell command (e.g., "shell:npm install")
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

### Example 4: "open folder E:/Test in vscode and create an HTML editor"
Thinking:
- Goal: Open VS Code with folder, then create/edit HTML file to be an editor
- How: Use open_folder to launch VS Code with the folder, then use AI to generate code
- Sequence: Open folder -> List files to see what exists -> Generate/edit the HTML
- Edge case: File might not exist yet

Output:
[
  { "description": "Open VS Code with the Test folder", "action": "open_folder:E:/Test" },
  { "description": "Wait for VS Code to load", "action": "wait:3" },
  { "description": "List files in the folder", "action": "list_files:E:/Test" },
  { "description": "Generate HTML editor code", "action": "generate_code:E:/Test/editor.html|Create an HTML page with a code editor layout: textarea input on the left side, live preview output on the right side. Include basic CSS for split layout and JavaScript to update preview on input." }
]

### Example 5: "read the config.json and add a new setting"
Thinking:
- Goal: Read existing file, understand it, modify it
- How: read_file to get contents, then edit_code to modify
- Sequence: Read first, then edit

Output:
[
  { "description": "Read the config file", "action": "read_file:config.json" },
  { "description": "Add new setting to config", "action": "edit_code:config.json|add a new setting called 'darkMode' with value true" }
]

### Example 6: "ask perplexity what is the best programming language"
Thinking:
- Goal: Open Perplexity AI in browser and ask a question
- How: Use browse_and_ask with perplexity target
- Sequence: Open site -> type question -> wait for response -> screenshot result

Output:
[
  { "description": "Ask Perplexity the question", "action": "browse_and_ask:perplexity|what is the best programming language" },
  { "description": "Wait for response to generate", "action": "wait:5" },
  { "description": "Capture the response", "action": "screenshot" }
]

### Example 7: "search google for weather today"
Thinking:
- Goal: Open Google and search for something
- How: Use web_search for quick results extraction
- Sequence: Search and get results

Output:
[
  { "description": "Search Google for weather", "action": "web_search:weather today" }
]

### Example 8: "send an email to john@example.com about the meeting tomorrow"
Thinking:
- Goal: Compose and send an email via Gmail
- How: Use send_email with gmail, recipient, subject, body
- Sequence: Open Gmail, compose, fill fields, send

Output:
[
  { "description": "Send email via Gmail", "action": "send_email:gmail|john@example.com|Meeting Tomorrow|Hi John, this is a reminder about our meeting tomorrow. Please let me know if you have any questions." }
]

### Example 9: "create a new google sheet called Sales Report and add headers"
Thinking:
- Goal: Create a new Google Sheet and add content
- How: Use google_sheets to create new, then type in cells
- Sequence: Create sheet -> Navigate to cells -> Type headers

Output:
[
  { "description": "Create new Google Sheet", "action": "google_sheets:new|Sales Report" },
  { "description": "Wait for sheet to load", "action": "wait:3" },
  { "description": "Type header in A1", "action": "google_sheets:type|A1|Product" },
  { "description": "Type header in B1", "action": "google_sheets:type|B1|Quantity" },
  { "description": "Type header in C1", "action": "google_sheets:type|C1|Price" }
]

### Example 10: "research the latest news about AI regulations"
Thinking:
- Goal: Do multi-step research on a topic
- How: Use research action which handles searching, gathering, summarizing
- Sequence: Single research action does it all

Output:
[
  { "description": "Research AI regulations news", "action": "research:latest news about AI regulations 2024" }
]

### Example 11: "write a document in google docs about project status"
Thinking:
- Goal: Create a Google Doc and write content
- How: Use google_docs to create and type
- Sequence: Create doc -> Type content

Output:
[
  { "description": "Create new Google Doc", "action": "google_docs:new|Project Status Report" },
  { "description": "Wait for doc to load", "action": "wait:3" },
  { "description": "Type the content", "action": "google_docs:type|Project Status Report\n\nDate: Today\n\nSummary:\nThe project is on track. All milestones have been met.\n\nNext Steps:\n- Complete testing\n- Deploy to production" }
]

### Example 12: "I don't know how to use this app, can you figure it out?"
Thinking:
- Goal: Learn the current UI and understand how to use it
- How: Use learn_ui to take screenshot and analyze
- Sequence: Screenshot -> AI analysis -> report back

Output:
[
  { "description": "Analyze current UI", "action": "learn_ui:What are all the buttons, menus, and interactive elements I can use?" }
]

### Example 13: "book a hotel on booking.com for next weekend"
Thinking:
- Goal: Complex task on unfamiliar website - need adaptive approach
- How: Use adaptive_do which will try, and if stuck ask LLMs for help
- Sequence: Single adaptive action handles the complexity

Output:
[
  { "description": "Adaptively book hotel", "action": "adaptive_do:Go to booking.com and book a hotel for next weekend" }
]

### Example 14: "I'm stuck, ask Claude how to proceed"
Thinking:
- Goal: Get help from another LLM with current screen context
- How: Use ask_llm with claude and send screenshot
- Sequence: Screenshot + question -> Get answer

Output:
[
  { "description": "Ask Claude for help with screenshot", "action": "ask_llm:claude|I'm stuck on this screen. What should I do next to accomplish my task?" }
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

    case 'open_folder':
      // Open VS Code with a specific folder
      await runCommand(`code "${params}"`, 10000);
      step.result = `Opened VS Code with folder: ${params}`;
      break;

    case 'read_file': {
      const readResult = await filesystem.readFile(params);
      if (readResult.success) {
        step.result = readResult.output;
      } else {
        throw new Error(readResult.error || 'Failed to read file');
      }
      break;
    }

    case 'write_file': {
      // Format: write_file:path|content
      const [filePath, ...contentParts] = params.split('|');
      const content = contentParts.join('|');
      const writeResult = await filesystem.writeFile(filePath, content);
      if (writeResult.success) {
        step.result = `Written to ${filePath}`;
      } else {
        throw new Error(writeResult.error || 'Failed to write file');
      }
      break;
    }

    case 'list_files': {
      const listResult = await filesystem.listDir(params, false);
      if (listResult.success) {
        step.result = listResult.output;
      } else {
        throw new Error(listResult.error || 'Failed to list files');
      }
      break;
    }

    case 'generate_code': {
      // Format: generate_code:path|description
      const [codePath, ...descParts] = params.split('|');
      const codeDescription = descParts.join('|');

      // Ask AI to generate the code
      const codePrompt = `Generate complete, working code for this request. Output ONLY the code, no explanations or markdown:

Request: ${codeDescription}

File: ${codePath}`;

      const codeResponse = await chat([{ role: 'user', content: codePrompt }]);
      let generatedCode = codeResponse.content;

      // Strip markdown code blocks if present
      generatedCode = generatedCode.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '').trim();

      // Write the generated code to file
      const genResult = await filesystem.writeFile(codePath, generatedCode);
      if (genResult.success) {
        step.result = `Generated and saved code to ${codePath}`;
      } else {
        throw new Error(genResult.error || 'Failed to write generated code');
      }
      break;
    }

    case 'edit_code': {
      // Format: edit_code:path|instructions
      const [editPath, ...instrParts] = params.split('|');
      const instructions = instrParts.join('|');

      // Read existing file
      const existingResult = await filesystem.readFile(editPath);
      if (!existingResult.success) {
        throw new Error(`Cannot read file: ${existingResult.error}`);
      }

      // Ask AI to edit the code
      const editPrompt = `Edit this code according to the instructions. Output ONLY the complete modified code, no explanations or markdown:

Instructions: ${instructions}

Current code:
${existingResult.output}`;

      const editResponse = await chat([{ role: 'user', content: editPrompt }]);
      let editedCode = editResponse.content;

      // Strip markdown code blocks if present
      editedCode = editedCode.replace(/^```[\w]*\n?/gm, '').replace(/\n?```$/gm, '').trim();

      // Write the edited code back
      const editWriteResult = await filesystem.writeFile(editPath, editedCode);
      if (editWriteResult.success) {
        step.result = `Edited and saved ${editPath}`;
      } else {
        throw new Error(editWriteResult.error || 'Failed to write edited code');
      }
      break;
    }

    case 'shell': {
      const shellResult = await runCommand(params, 30000);
      if (shellResult.success) {
        step.result = shellResult.output || 'Command completed';
      } else {
        throw new Error(shellResult.error || 'Command failed');
      }
      break;
    }

    case 'open_url': {
      // Open URL in default browser
      const url = params.startsWith('http') ? params : `https://${params}`;
      if (process.platform === 'win32') {
        await runCommand(`start "" "${url}"`, 5000);
      } else if (process.platform === 'darwin') {
        await runCommand(`open "${url}"`, 5000);
      } else {
        await runCommand(`xdg-open "${url}"`, 5000);
      }
      step.result = `Opened ${url} in browser`;
      break;
    }

    case 'browse_and_ask': {
      // Format: browse_and_ask:site|question
      // Using Playwright for reliable browser automation
      const [site, ...questionParts] = params.split('|');
      const question = questionParts.join('|');

      // Check if site is a supported AI chat
      const supportedSites = ['perplexity', 'chatgpt', 'claude', 'copilot', 'google'];
      const siteLower = site.toLowerCase();

      if (supportedSites.includes(siteLower)) {
        // Use Playwright's AI chat helper
        const result = await browser.askAI(siteLower as any, question, true);

        // If response seems short, try getting full response by scrolling
        if (result.response.length < 500) {
          const fullParts = await browser.getFullAIResponse(siteLower as any, 5);
          if (fullParts.length > 0) {
            step.result = `📝 ${site.charAt(0).toUpperCase() + site.slice(1)} says:\n\n${fullParts.join('\n\n')}`;
            break;
          }
        }

        step.result = `📝 ${site.charAt(0).toUpperCase() + site.slice(1)} says:\n\n${result.response}`;
      } else {
        // Generic site - open and type
        await browser.navigateTo(`https://${site}`);
        await sleep(2000);

        // Try to find and fill any input
        const page = await browser.getPage();
        const inputs = ['textarea', 'input[type="text"]', 'input[type="search"]', '[contenteditable="true"]'];

        for (const selector of inputs) {
          if (await browser.elementExists(selector)) {
            await browser.typeInElement(selector, question);
            await browser.pressKey('Enter');
            break;
          }
        }

        await sleep(5000);
        const pageText = await browser.getPageText();
        step.result = `📝 Response from ${site}:\n\n${pageText.slice(0, 3000)}`;
      }
      break;
    }

    case 'screenshot':
      const vision = await describeScreen();
      step.result = vision.description;
      break;

    case 'web_search': {
      // Use Playwright for reliable web search
      const searchResults = await browser.webSearch(params, 'google');

      if (searchResults.length > 0) {
        step.result = `🔍 Search results for "${params}":\n\n${searchResults.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
      } else {
        // Fallback: get page text
        const pageText = await browser.getPageText();
        step.result = `🔍 Search results for "${params}":\n\n${pageText.slice(0, 2000)}`;
      }
      break;
    }

    case 'send_email': {
      // Use Playwright for reliable email sending
      // Format: send_email:provider|to|subject|body
      const [provider, to, subject, ...bodyParts] = params.split('|');
      const body = bodyParts.join('|');

      const emailData = { to, subject, body };

      let success = false;
      if (provider.toLowerCase() === 'gmail') {
        success = await browser.sendGmail(emailData);
      } else if (provider.toLowerCase() === 'outlook') {
        success = await browser.sendOutlook(emailData);
      } else {
        throw new Error(`Unsupported email provider: ${provider}. Use gmail or outlook.`);
      }

      if (success) {
        step.result = `📧 Email sent via ${provider} to ${to}`;
      } else {
        throw new Error(`Failed to send email via ${provider}. Make sure you're logged in.`);
      }
      break;
    }

    case 'google_sheets': {
      // Use Playwright for Google Sheets
      // Format: google_sheets:command|arg1|arg2...
      const [sheetCmd, ...sheetArgs] = params.split('|');

      switch (sheetCmd.toLowerCase()) {
        case 'new': {
          const sheetName = sheetArgs[0] || 'Untitled spreadsheet';
          await browser.navigateTo('https://docs.google.com/spreadsheets/create');
          await sleep(5000);
          step.result = `📊 Created Google Sheet: ${sheetName}`;
          break;
        }
        case 'type': {
          const cell = sheetArgs[0] || 'A1';
          const cellValue = sheetArgs.slice(1).join('|');
          const success = await browser.googleSheetsType([{ cell, value: cellValue }]);
          step.result = success
            ? `📊 Typed "${cellValue}" in cell ${cell}`
            : `📊 Could not type in cell ${cell}`;
          break;
        }
        case 'read': {
          const screenshot = await browser.takeScreenshot();
          const analysis = await chat([{
            role: 'user',
            content: 'Describe the contents of this Google Sheet. List visible data in the cells.'
          }]);
          step.result = `📊 Current sheet view:\n${analysis.content}`;
          break;
        }
        default:
          throw new Error(`Unknown google_sheets command: ${sheetCmd}`);
      }
      break;
    }

    case 'google_docs': {
      // Use Playwright for Google Docs
      // Format: google_docs:command|arg1|arg2...
      const [docCmd, ...docArgs] = params.split('|');

      switch (docCmd.toLowerCase()) {
        case 'new': {
          const docName = docArgs[0] || 'Untitled document';
          const success = await browser.googleDocsType('');
          step.result = success
            ? `📄 Created Google Doc: ${docName}`
            : `📄 Could not create Google Doc`;
          break;
        }
        case 'type': {
          const docText = docArgs.join('|');
          const success = await browser.googleDocsType(docText);
          step.result = success
            ? `📄 Typed content in Google Doc`
            : `📄 Could not type in Google Doc`;
          break;
        }
        default:
          throw new Error(`Unknown google_docs command: ${docCmd}`);
      }
      break;
    }

    case 'research': {
      // Use Playwright for multi-step research
      const researchQuery = params;

      // Use browser.research which handles search, clicking, gathering
      const researchData = await browser.research(researchQuery, 3);

      // Format sources
      const sourceSummaries = researchData.sources.map((s, i) =>
        `Source ${i + 1}: ${s.title}\n${s.content.slice(0, 500)}...`
      ).join('\n\n');

      // Ask AI to synthesize
      const synthesis = await chat([{
        role: 'user',
        content: `Based on the following research gathered about "${researchQuery}", provide a comprehensive summary:

${sourceSummaries}

Create a well-organized summary with:
1. Key findings
2. Important details
3. Any notable facts or statistics
4. Conclusion

Be thorough but concise.`
      }]);

      step.result = `🔬 Research Summary: ${researchQuery}\n\n${synthesis.content}`;
      break;
    }

    case 'ask_llm': {
      // Use Playwright to ask another LLM for help with a screenshot
      // Format: ask_llm:llm_name|question
      const [llmName, ...questionParts] = params.split('|');
      const question = questionParts.join('|');

      // Take screenshot first to describe current context
      const currentScreen = await describeScreen();

      // Compose the question with screen context
      const fullQuestion = `I'm looking at my screen and I need help. ${question}\n\nHere's what I see on my screen: ${currentScreen.description}`;

      // Supported LLMs
      const supportedLLMs = ['perplexity', 'chatgpt', 'claude', 'copilot'];
      const llmLower = llmName.toLowerCase();

      if (!supportedLLMs.includes(llmLower)) {
        throw new Error(`Unknown LLM: ${llmName}. Supported: ${supportedLLMs.join(', ')}`);
      }

      // Use Playwright's AI chat helper
      const result = await browser.askAI(llmLower as any, fullQuestion, false);

      // Get full response if needed
      const fullParts = await browser.getFullAIResponse(llmLower as any, 3);
      const finalResponse = fullParts.length > 0 ? fullParts.join('\n\n') : result.response;

      step.result = `🤖 ${llmName} says:\n\n${finalResponse}`;
      break;
    }

    case 'learn_ui': {
      // Take screenshot and analyze the UI to learn how to interact
      const uiScreen = await describeScreen();

      const uiAnalysis = await chat([{
        role: 'user',
        content: `Analyze this screenshot and identify all interactive UI elements. List:
1. All clickable buttons and their likely functions
2. Text input fields
3. Menus and dropdowns
4. Links
5. Any keyboard shortcuts visible
6. The main actions available in this interface

Question: ${params}

Be specific about locations (top-left, center, etc.) and what each element does.`
      }]);

      step.result = `🔍 UI Analysis:\n\n${uiAnalysis.content}`;
      break;
    }

    case 'adaptive_do': {
      // Adaptive agent using Playwright: try to accomplish something, ask LLMs if stuck
      const goal = params;
      const maxAttempts = 5;
      const actionHistory: string[] = [];
      let accomplished = false;

      // Initialize browser
      const page = await browser.getPage();

      for (let attempt = 0; attempt < maxAttempts && !accomplished; attempt++) {
        // Take screenshot and analyze current state
        const screenshot = await browser.takeScreenshot();
        const currentState = await chat([{
          role: 'user',
          content: `Describe what you see on this screen. What app/website is it? What elements are visible?`
        }]);

        // Ask our AI what to do next
        const nextAction = await chat([{
          role: 'user',
          content: `GOAL: ${goal}

CURRENT SCREEN: ${currentState.content}

PREVIOUS ACTIONS TAKEN:
${actionHistory.length > 0 ? actionHistory.join('\n') : 'None yet'}

Based on what you see, what's the SINGLE next action to take?
Options:
- click: Click element (describe CSS selector or visible text)
- type: Type something (specify selector and text)
- press: Press a key (specify key)
- scroll: Scroll up/down
- navigate: Go to URL
- done: Goal is accomplished
- stuck: Can't figure out what to do

Respond in format:
ACTION: <action_type>
SELECTOR: <css selector or text to find>
VALUE: <text to type or URL>
REASONING: <why>`
        }]);

        const actionContent = nextAction.content;

        // Parse the action
        const actionMatch = actionContent.match(/ACTION:\s*(\w+)/i);
        const selectorMatch = actionContent.match(/SELECTOR:\s*(.+?)(?:\n|$)/i);
        const valueMatch = actionContent.match(/VALUE:\s*(.+?)(?:\n|$)/i);

        if (!actionMatch) {
          actionHistory.push(`Attempt ${attempt + 1}: Couldn't parse action`);
          continue;
        }

        const action = actionMatch[1].toLowerCase();
        const selector = selectorMatch?.[1]?.trim() || '';
        const value = valueMatch?.[1]?.trim() || '';

        if (action === 'done') {
          accomplished = true;
          actionHistory.push(`Attempt ${attempt + 1}: Goal accomplished!`);
          break;
        }

        if (action === 'stuck') {
          // Ask Perplexity for help using Playwright
          actionHistory.push(`Attempt ${attempt + 1}: Got stuck, asking Perplexity for help...`);

          const helpRequest = `I'm trying to: ${goal}\n\nI'm stuck. What should I do next? Be specific about what to click or type.`;
          const advice = await browser.askAI('perplexity', helpRequest, false);
          actionHistory.push(`Got advice: ${advice.response.slice(0, 200)}...`);

          // Navigate back to continue
          await browser.navigateTo(page.url());
          continue;
        }

        // Execute the action using Playwright
        try {
          switch (action) {
            case 'click':
              // Try to click by selector or text
              if (selector) {
                const clicked = await browser.clickElement(selector);
                if (!clicked) {
                  // Try by text
                  await page.getByText(selector).first().click({ timeout: 5000 });
                }
              }
              actionHistory.push(`Attempt ${attempt + 1}: Clicked "${selector}"`);
              break;
            case 'type':
              if (selector && value) {
                const typed = await browser.typeInElement(selector, value);
                if (!typed) {
                  await page.getByPlaceholder(selector).first().fill(value);
                }
              }
              actionHistory.push(`Attempt ${attempt + 1}: Typed "${value}" in "${selector}"`);
              break;
            case 'press':
              await browser.pressKey(value || selector);
              actionHistory.push(`Attempt ${attempt + 1}: Pressed ${value || selector}`);
              break;
            case 'scroll':
              await browser.scroll(value.toLowerCase().includes('up') ? 'up' : 'down');
              actionHistory.push(`Attempt ${attempt + 1}: Scrolled ${value || 'down'}`);
              break;
            case 'navigate':
              const url = value.startsWith('http') ? value : `https://${value}`;
              await browser.navigateTo(url);
              actionHistory.push(`Attempt ${attempt + 1}: Navigated to ${url}`);
              break;
            default:
              actionHistory.push(`Attempt ${attempt + 1}: Unknown action ${action}`);
          }
        } catch (e) {
          actionHistory.push(`Attempt ${attempt + 1}: Action failed - ${e}`);
        }

        await sleep(2000); // Wait for UI to update
      }

      step.result = `🎯 Adaptive Agent Result:\n\nGoal: ${goal}\nAccomplished: ${accomplished ? 'Yes ✅' : 'Partial/No ❌'}\n\nAction Log:\n${actionHistory.join('\n')}`;
      break;
    }

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
