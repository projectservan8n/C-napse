/**
 * Agent Learner - Self-learning system that consults multiple AI sources
 * and remembers successful solutions for future use
 */

import { EventEmitter } from 'events';
import { homedir } from 'os';
import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { describeScreen, captureScreenshot } from '../lib/vision.js';
import { chat } from '../lib/api.js';
import * as computer from '../tools/computer.js';

const MEMORY_FILE = join(homedir(), '.cnapse', 'agent-memory.json');
const MAX_MEMORY_SIZE = 500; // Max learned actions to keep

export interface LearnedAction {
  id: string;
  situation: string;       // What the screen looked like
  goal: string;            // What we were trying to do
  solution: string;        // What worked (action description)
  actionType: string;      // Action type (click, type, navigate, etc.)
  actionValue: string;     // Action value/params
  source: string;          // Where we learned it (perplexity, claude, chatgpt, web, self)
  successCount: number;    // How many times this worked
  failCount: number;       // How many times this failed
  lastUsed: string;        // ISO timestamp
  created: string;         // ISO timestamp
}

export interface Suggestion {
  action: string;
  value: string;
  reasoning: string;
  source: string;
  confidence: number;
}

export interface AgentMemory {
  version: number;
  learned: LearnedAction[];
  stats: {
    totalAttempts: number;
    totalSuccesses: number;
    totalLearned: number;
    sourceCounts: Record<string, number>;
  };
}

export class AgentLearner extends EventEmitter {
  private memory: AgentMemory;
  private loaded: boolean = false;

  constructor() {
    super();
    this.memory = this.createEmptyMemory();
  }

  private createEmptyMemory(): AgentMemory {
    return {
      version: 1,
      learned: [],
      stats: {
        totalAttempts: 0,
        totalSuccesses: 0,
        totalLearned: 0,
        sourceCounts: {},
      },
    };
  }

  /**
   * Load memory from disk
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const dir = join(homedir(), '.cnapse');
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      if (existsSync(MEMORY_FILE)) {
        const data = await readFile(MEMORY_FILE, 'utf-8');
        this.memory = JSON.parse(data);
      }
      this.loaded = true;
      this.emit('loaded', this.memory.learned.length);
    } catch (error) {
      console.error('Failed to load agent memory:', error);
      this.memory = this.createEmptyMemory();
      this.loaded = true;
    }
  }

  /**
   * Save memory to disk
   */
  async save(): Promise<void> {
    try {
      const dir = join(homedir(), '.cnapse');
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      // Prune if too large (keep best performers)
      if (this.memory.learned.length > MAX_MEMORY_SIZE) {
        this.memory.learned.sort((a, b) => {
          const aScore = a.successCount - a.failCount;
          const bScore = b.successCount - b.failCount;
          return bScore - aScore;
        });
        this.memory.learned = this.memory.learned.slice(0, MAX_MEMORY_SIZE);
      }

      await writeFile(MEMORY_FILE, JSON.stringify(this.memory, null, 2));
      this.emit('saved', this.memory.learned.length);
    } catch (error) {
      console.error('Failed to save agent memory:', error);
    }
  }

  /**
   * Check if we've solved something similar before
   */
  async recall(goal: string, currentScreen: string): Promise<LearnedAction | null> {
    await this.load();

    const goalLower = goal.toLowerCase();
    const screenLower = currentScreen.toLowerCase();

    // Find candidates with similar goals and situations
    const candidates = this.memory.learned.filter(m => {
      const goalSimilarity = this.calculateSimilarity(goalLower, m.goal.toLowerCase());
      const screenSimilarity = this.calculateSimilarity(screenLower, m.situation.toLowerCase());

      // Need reasonable match on goal and some match on screen
      return goalSimilarity > 0.5 && screenSimilarity > 0.3;
    });

    if (candidates.length === 0) return null;

    // Sort by success rate and recency
    candidates.sort((a, b) => {
      const aScore = (a.successCount - a.failCount) + (a.successCount * 0.1);
      const bScore = (b.successCount - b.failCount) + (b.successCount * 0.1);
      return bScore - aScore;
    });

    const best = candidates[0];

    // Only return if it has a positive track record
    if (best.successCount > best.failCount) {
      this.emit('recalled', best);
      return best;
    }

    return null;
  }

  /**
   * Simple word-based similarity (Jaccard-like)
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let intersection = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) intersection++;
    }

    const union = wordsA.size + wordsB.size - intersection;
    return intersection / union;
  }

  /**
   * Learn from a successful action
   */
  async learn(
    situation: string,
    goal: string,
    actionType: string,
    actionValue: string,
    source: string
  ): Promise<void> {
    await this.load();

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    // Check if we already have a similar entry
    const existing = this.memory.learned.find(m =>
      m.goal.toLowerCase() === goal.toLowerCase() &&
      m.actionType === actionType &&
      m.actionValue === actionValue
    );

    if (existing) {
      existing.successCount++;
      existing.lastUsed = now;
      this.emit('reinforced', existing);
    } else {
      const learned: LearnedAction = {
        id,
        situation: situation.slice(0, 500), // Truncate long descriptions
        goal,
        solution: `${actionType}: ${actionValue}`,
        actionType,
        actionValue,
        source,
        successCount: 1,
        failCount: 0,
        lastUsed: now,
        created: now,
      };

      this.memory.learned.push(learned);
      this.memory.stats.totalLearned++;
      this.memory.stats.sourceCounts[source] = (this.memory.stats.sourceCounts[source] || 0) + 1;
      this.emit('learned', learned);
    }

    await this.save();
  }

  /**
   * Record a failed attempt
   */
  async recordFailure(goal: string, actionType: string, actionValue: string): Promise<void> {
    await this.load();

    const existing = this.memory.learned.find(m =>
      m.goal.toLowerCase() === goal.toLowerCase() &&
      m.actionType === actionType &&
      m.actionValue === actionValue
    );

    if (existing) {
      existing.failCount++;
      await this.save();
    }
  }

  /**
   * Get help from multiple AI sources when stuck
   */
  async getHelp(
    goal: string,
    currentScreen: string,
    triedActions: string[]
  ): Promise<Suggestion[]> {
    this.emit('seeking_help', { goal, triedActions: triedActions.length });

    const query = this.buildHelpQuery(goal, currentScreen, triedActions);
    const suggestions: Suggestion[] = [];

    // Try multiple sources in parallel
    const sources = await Promise.allSettled([
      this.askOwnAI(query),
      this.askPerplexity(goal, currentScreen),
      this.askWebSearch(goal),
    ]);

    for (const result of sources) {
      if (result.status === 'fulfilled' && result.value) {
        suggestions.push(result.value);
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    this.emit('got_help', suggestions.length);
    return suggestions;
  }

  private buildHelpQuery(goal: string, screen: string, tried: string[]): string {
    return `I'm trying to: ${goal}

Current screen shows: ${screen.slice(0, 500)}

Actions I've already tried:
${tried.length > 0 ? tried.slice(-5).join('\n') : 'None yet'}

What's the SINGLE next action I should take?
Be very specific - tell me exactly what to click, what to type, or what key to press.

Respond in this format:
ACTION: <click|type|press|navigate|scroll|wait>
VALUE: <what to click on / text to type / key to press / URL to navigate to>
REASONING: <brief explanation>`;
  }

  /**
   * Ask our configured AI provider for help
   */
  private async askOwnAI(query: string): Promise<Suggestion | null> {
    try {
      const response = await chat([{ role: 'user', content: query }]);
      return this.parseSuggestion(response.content, 'own_ai', 0.8);
    } catch (error) {
      return null;
    }
  }

  /**
   * Ask Perplexity by opening browser (uses existing browser.ts)
   */
  private async askPerplexity(goal: string, screen: string): Promise<Suggestion | null> {
    try {
      // Import browser module dynamically to avoid circular deps
      const browser = await import('../services/browser.js');

      const question = `How do I ${goal}? I can see ${screen.slice(0, 200)}. Give me the exact next step.`;
      const result = await browser.askAI('perplexity', question);

      if (result.response) {
        return {
          action: 'suggested',
          value: result.response.slice(0, 500),
          reasoning: 'From Perplexity web search',
          source: 'perplexity',
          confidence: 0.7,
        };
      }
    } catch (error) {
      // Perplexity might not be available
    }
    return null;
  }

  /**
   * Search Google for help
   */
  private async askWebSearch(goal: string): Promise<Suggestion | null> {
    try {
      const browser = await import('../services/browser.js');
      const searchQuery = `how to ${goal} step by step`;
      const result = await browser.webSearch(searchQuery);

      if (result) {
        return {
          action: 'suggested',
          value: result.slice(0, 500),
          reasoning: 'From web search results',
          source: 'google',
          confidence: 0.5,
        };
      }
    } catch (error) {
      // Web search might fail
    }
    return null;
  }

  /**
   * Parse AI response into structured suggestion
   */
  private parseSuggestion(content: string, source: string, baseConfidence: number): Suggestion | null {
    const actionMatch = content.match(/ACTION:\s*(\w+)/i);
    const valueMatch = content.match(/VALUE:\s*(.+?)(?:\n|$)/i);
    const reasoningMatch = content.match(/REASONING:\s*(.+?)(?:\n|$)/i);

    if (!actionMatch) return null;

    return {
      action: actionMatch[1].toLowerCase(),
      value: valueMatch?.[1]?.trim() || '',
      reasoning: reasoningMatch?.[1]?.trim() || 'No reasoning provided',
      source,
      confidence: baseConfidence,
    };
  }

  /**
   * Ask Claude.ai via browser automation
   */
  async askClaude(query: string): Promise<Suggestion | null> {
    try {
      const browser = await import('../services/browser.js');

      // Open Claude.ai
      await browser.openUrl('https://claude.ai');
      await this.sleep(3000);

      // Type the query
      await computer.typeText(query);
      await this.sleep(500);
      await computer.pressKey('Return');

      // Wait for response
      await this.sleep(8000);

      // Capture and analyze the response
      const screen = await describeScreen();

      return {
        action: 'suggested',
        value: screen.description.slice(0, 500),
        reasoning: 'From Claude.ai',
        source: 'claude_web',
        confidence: 0.75,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Ask ChatGPT via browser automation
   */
  async askChatGPT(query: string): Promise<Suggestion | null> {
    try {
      const browser = await import('../services/browser.js');

      // Open ChatGPT
      await browser.openUrl('https://chat.openai.com');
      await this.sleep(3000);

      // Type the query
      await computer.typeText(query);
      await this.sleep(500);
      await computer.pressKey('Return');

      // Wait for response
      await this.sleep(8000);

      // Capture and analyze the response
      const screen = await describeScreen();

      return {
        action: 'suggested',
        value: screen.description.slice(0, 500),
        reasoning: 'From ChatGPT',
        source: 'chatgpt_web',
        confidence: 0.75,
      };
    } catch (error) {
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get memory stats
   */
  getStats(): AgentMemory['stats'] & { memorySize: number } {
    return {
      ...this.memory.stats,
      memorySize: this.memory.learned.length,
    };
  }

  /**
   * Get all learned actions (for debugging/display)
   */
  getAllLearned(): LearnedAction[] {
    return [...this.memory.learned];
  }

  /**
   * Clear all memory (for testing)
   */
  async clearMemory(): Promise<void> {
    this.memory = this.createEmptyMemory();
    await this.save();
    this.emit('cleared');
  }
}

// Singleton instance
let learnerInstance: AgentLearner | null = null;

export function getLearner(): AgentLearner {
  if (!learnerInstance) {
    learnerInstance = new AgentLearner();
  }
  return learnerInstance;
}

export default AgentLearner;
