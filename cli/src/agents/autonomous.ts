/**
 * Autonomous Agent - The brain that pursues goals relentlessly
 * Continuously observes, thinks, and acts until goal is achieved
 */

import { EventEmitter } from 'events';
import { describeScreen, captureScreenshot } from '../lib/vision.js';
import { chat } from '../lib/api.js';
import * as computer from '../tools/computer.js';
import { AgentLearner, getLearner, Suggestion } from './learner.js';

export interface ActionRecord {
  timestamp: number;
  action: string;
  value: string;
  result: 'success' | 'failure' | 'pending';
  screenBefore: string;
  screenAfter?: string;
  reasoning: string;
}

export interface AgentState {
  goal: string;
  isActive: boolean;
  isPaused: boolean;
  currentAction: string | null;
  actionHistory: ActionRecord[];
  stuckCount: number;
  attemptCount: number;
  lastScreenHash: string;
  startTime: number;
  confidence: number;
}

export interface AgentConfig {
  maxAttempts: number;          // Max attempts before giving up (default 25)
  actionDelayMs: number;        // Delay between actions (default 1500)
  stuckThreshold: number;       // Same screen count before asking for help (default 3)
  verifyActions: boolean;       // Take screenshot after each action to verify (default true)
  humanLikeTiming: boolean;     // Use human-like delays (default true)
  learnFromSuccess: boolean;    // Save successful actions to memory (default true)
  askForHelpWhenStuck: boolean; // Consult other AIs when stuck (default true)
}

const DEFAULT_CONFIG: AgentConfig = {
  maxAttempts: 25,
  actionDelayMs: 1500,
  stuckThreshold: 3,
  verifyActions: true,
  humanLikeTiming: true,
  learnFromSuccess: true,
  askForHelpWhenStuck: true,
};

export class AutonomousAgent extends EventEmitter {
  private state: AgentState;
  private config: AgentConfig;
  private learner: AgentLearner;
  private abortController: AbortController | null = null;

  constructor(config: Partial<AgentConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.learner = getLearner();
    this.state = this.createInitialState('');
  }

  private createInitialState(goal: string): AgentState {
    return {
      goal,
      isActive: false,
      isPaused: false,
      currentAction: null,
      actionHistory: [],
      stuckCount: 0,
      attemptCount: 0,
      lastScreenHash: '',
      startTime: Date.now(),
      confidence: 100,
    };
  }

  /**
   * Start pursuing a goal autonomously
   */
  async start(goal: string): Promise<{ success: boolean; message: string }> {
    if (this.state.isActive) {
      return { success: false, message: 'Agent is already running' };
    }

    this.state = this.createInitialState(goal);
    this.state.isActive = true;
    this.abortController = new AbortController();

    this.emit('started', { goal });

    try {
      await this.learner.load();

      // Main agent loop
      while (this.state.isActive && this.state.attemptCount < this.config.maxAttempts) {
        if (this.state.isPaused) {
          await this.sleep(500);
          continue;
        }

        this.state.attemptCount++;
        this.emit('attempt', { count: this.state.attemptCount, max: this.config.maxAttempts });

        // 1. OBSERVE - Capture and analyze current screen
        const observation = await this.observe();
        if (!observation) continue;

        // 2. CHECK MEMORY - Have we solved something similar before?
        const remembered = await this.learner.recall(goal, observation.description);
        if (remembered) {
          this.emit('recalled', remembered);
          const result = await this.executeAction(remembered.actionType, remembered.actionValue);
          if (result.success) {
            await this.learner.learn(
              observation.description,
              goal,
              remembered.actionType,
              remembered.actionValue,
              'memory'
            );
          }
          continue;
        }

        // 3. THINK - Ask AI what to do next
        const decision = await this.think(observation.description);

        if (decision.action === 'done') {
          this.state.isActive = false;
          this.emit('completed', { success: true, attempts: this.state.attemptCount });
          return { success: true, message: 'Goal accomplished!' };
        }

        if (decision.action === 'stuck') {
          this.state.stuckCount++;

          if (this.state.stuckCount >= this.config.stuckThreshold && this.config.askForHelpWhenStuck) {
            // Ask for help from multiple sources
            this.emit('asking_help', { stuckCount: this.state.stuckCount });
            const suggestions = await this.learner.getHelp(
              goal,
              observation.description,
              this.state.actionHistory.slice(-5).map(a => `${a.action}: ${a.value}`)
            );

            if (suggestions.length > 0) {
              // Try the best suggestion
              const suggestion = suggestions[0];
              this.emit('trying_suggestion', suggestion);
              const result = await this.executeAction(suggestion.action, suggestion.value);

              if (result.success && this.config.learnFromSuccess) {
                await this.learner.learn(
                  observation.description,
                  goal,
                  suggestion.action,
                  suggestion.value,
                  suggestion.source
                );
                this.state.stuckCount = 0;
              }
            }
          }
          continue;
        }

        // 4. ACT - Execute the decided action
        const result = await this.executeAction(decision.action, decision.value);

        // 5. VERIFY - Check if action had effect
        if (this.config.verifyActions) {
          const afterScreen = await captureScreenshot();
          const screenChanged = afterScreen !== observation.screenshot;

          if (screenChanged) {
            this.state.stuckCount = 0;
            this.state.confidence = Math.min(100, this.state.confidence + 5);

            if (result.success && this.config.learnFromSuccess) {
              await this.learner.learn(
                observation.description,
                goal,
                decision.action,
                decision.value,
                'self'
              );
            }
          } else {
            this.state.stuckCount++;
            this.state.confidence = Math.max(0, this.state.confidence - 10);
          }
        }

        // Delay between actions
        if (this.config.humanLikeTiming) {
          const delay = this.config.actionDelayMs + (Math.random() * 500);
          await this.sleep(delay);
        } else {
          await this.sleep(this.config.actionDelayMs);
        }
      }

      // Reached max attempts
      this.state.isActive = false;
      this.emit('completed', { success: false, attempts: this.state.attemptCount });
      return {
        success: false,
        message: `Reached max attempts (${this.config.maxAttempts}). Goal may be partially complete.`,
      };

    } catch (error) {
      this.state.isActive = false;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { error: message });
      return { success: false, message };
    }
  }

  /**
   * Stop the agent
   */
  stop(): void {
    this.state.isActive = false;
    this.abortController?.abort();
    this.emit('stopped', { attempts: this.state.attemptCount });
  }

  /**
   * Pause the agent
   */
  pause(): void {
    this.state.isPaused = true;
    this.emit('paused');
  }

  /**
   * Resume the agent
   */
  resume(): void {
    this.state.isPaused = false;
    this.emit('resumed');
  }

  /**
   * Observe current screen state
   */
  private async observe(): Promise<{ description: string; screenshot: string } | null> {
    try {
      this.emit('observing');
      const result = await describeScreen();
      this.emit('observed', { description: result.description.slice(0, 200) });
      return result;
    } catch (error) {
      this.emit('observe_error', { error });
      return null;
    }
  }

  /**
   * Think about what action to take next
   */
  private async think(screenDescription: string): Promise<{ action: string; value: string; reasoning: string }> {
    this.emit('thinking');

    const prompt = this.buildThinkingPrompt(screenDescription);

    try {
      const response = await chat([{ role: 'user', content: prompt }]);
      const decision = this.parseDecision(response.content);

      this.emit('decided', decision);
      return decision;
    } catch (error) {
      return { action: 'stuck', value: '', reasoning: 'Failed to get AI decision' };
    }
  }

  private buildThinkingPrompt(screenDescription: string): string {
    const recentActions = this.state.actionHistory.slice(-5)
      .map(a => `- ${a.action}: ${a.value} (${a.result})`)
      .join('\n');

    return `GOAL: ${this.state.goal}

CURRENT SCREEN: ${screenDescription}

PREVIOUS ACTIONS:
${recentActions || 'None yet'}

ATTEMPT: ${this.state.attemptCount}/${this.config.maxAttempts}
STUCK COUNT: ${this.state.stuckCount}

Based on what you see, what's the SINGLE next action to take?

Available actions:
- click: Click at current mouse position
- clickAt: Click at specific coordinates (VALUE: x,y)
- type: Type text (VALUE: text to type)
- press: Press a key (VALUE: Enter, Tab, Escape, etc.)
- keyCombo: Press key combination (VALUE: command+s, control+c, etc.)
- scroll: Scroll (VALUE: up or down)
- navigate: Open URL (VALUE: full URL)
- moveTo: Move mouse (VALUE: x,y coordinates)
- wait: Wait for something (VALUE: seconds)
- done: Goal is accomplished
- stuck: Can't figure out what to do

Respond EXACTLY in this format:
ACTION: <action_type>
VALUE: <parameter>
REASONING: <brief why>`;
  }

  private parseDecision(content: string): { action: string; value: string; reasoning: string } {
    const actionMatch = content.match(/ACTION:\s*(\w+)/i);
    const valueMatch = content.match(/VALUE:\s*(.+?)(?:\n|$)/i);
    const reasoningMatch = content.match(/REASONING:\s*(.+?)(?:\n|$)/i);

    return {
      action: actionMatch?.[1]?.toLowerCase() || 'stuck',
      value: valueMatch?.[1]?.trim() || '',
      reasoning: reasoningMatch?.[1]?.trim() || 'No reasoning provided',
    };
  }

  /**
   * Execute an action
   */
  private async executeAction(action: string, value: string): Promise<{ success: boolean; error?: string }> {
    const record: ActionRecord = {
      timestamp: Date.now(),
      action,
      value,
      result: 'pending',
      screenBefore: this.state.lastScreenHash,
      reasoning: '',
    };

    this.state.currentAction = `${action}: ${value}`;
    this.emit('executing', { action, value });

    try {
      switch (action) {
        case 'click':
          await computer.clickMouse('left');
          break;

        case 'clickat':
        case 'clickAt': {
          const [x, y] = value.split(',').map(n => parseInt(n.trim()));
          if (!isNaN(x) && !isNaN(y)) {
            await computer.moveMouse(x, y);
            await this.sleep(100);
            await computer.clickMouse('left');
          }
          break;
        }

        case 'type':
          if (this.config.humanLikeTiming) {
            await this.typeHumanLike(value);
          } else {
            await computer.typeText(value);
          }
          break;

        case 'press':
          await computer.pressKey(value || 'Return');
          break;

        case 'keycombo':
        case 'keyCombo': {
          const keys = value.split('+').map(k => k.trim().toLowerCase());
          await computer.keyCombo(keys);
          break;
        }

        case 'scroll':
          const amount = value.toLowerCase().includes('up') ? 3 : -3;
          await computer.scrollMouse(amount);
          break;

        case 'navigate': {
          const browser = await import('../services/browser.js');
          const url = value.startsWith('http') ? value : `https://${value}`;
          await browser.openUrl(url);
          break;
        }

        case 'moveto':
        case 'moveTo': {
          const [mx, my] = value.split(',').map(n => parseInt(n.trim()));
          if (!isNaN(mx) && !isNaN(my)) {
            if (this.config.humanLikeTiming) {
              await this.moveMouseSmooth(mx, my);
            } else {
              await computer.moveMouse(mx, my);
            }
          }
          break;
        }

        case 'wait': {
          const seconds = parseFloat(value) || 2;
          await this.sleep(seconds * 1000);
          break;
        }

        case 'done':
        case 'stuck':
          // These are handled in the main loop
          break;

        default:
          record.result = 'failure';
          this.state.actionHistory.push(record);
          return { success: false, error: `Unknown action: ${action}` };
      }

      record.result = 'success';
      this.state.actionHistory.push(record);
      this.emit('executed', { action, value, success: true });
      return { success: true };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      record.result = 'failure';
      this.state.actionHistory.push(record);
      this.emit('executed', { action, value, success: false, error: errorMsg });
      return { success: false, error: errorMsg };
    } finally {
      this.state.currentAction = null;
    }
  }

  /**
   * Type text with human-like timing
   */
  private async typeHumanLike(text: string): Promise<void> {
    const baseDelay = 50; // ~60 WPM

    for (const char of text) {
      await computer.typeText(char);

      // Variable delay
      const delay = baseDelay + (Math.random() * 30);
      await this.sleep(delay);

      // Occasional longer pause (simulating thinking)
      if (Math.random() < 0.05) {
        await this.sleep(200 + Math.random() * 300);
      }
    }
  }

  /**
   * Move mouse smoothly (basic linear interpolation)
   */
  private async moveMouseSmooth(targetX: number, targetY: number): Promise<void> {
    const currentPos = await computer.getMousePosition();
    const match = currentPos.output.match(/(\d+),\s*(\d+)/);
    if (!match) {
      await computer.moveMouse(targetX, targetY);
      return;
    }

    const startX = parseInt(match[1]);
    const startY = parseInt(match[2]);

    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(startX + (targetX - startX) * t);
      const y = Math.round(startY + (targetY - startY) * t);
      await computer.moveMouse(x, y);
      await this.sleep(20);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Get action history
   */
  getHistory(): ActionRecord[] {
    return [...this.state.actionHistory];
  }
}

// Singleton instance
let agentInstance: AutonomousAgent | null = null;

export function getAutonomousAgent(config?: Partial<AgentConfig>): AutonomousAgent {
  if (!agentInstance) {
    agentInstance = new AutonomousAgent(config);
  }
  return agentInstance;
}

export default AutonomousAgent;
