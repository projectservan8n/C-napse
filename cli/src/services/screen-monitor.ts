/**
 * Screen Monitor Service - Continuous background screen capture
 * with change detection for the autonomous agent
 */

import { EventEmitter } from 'events';
import { captureScreenshot, describeScreen } from '../lib/vision.js';
import * as crypto from 'crypto';

export interface ScreenFrame {
  timestamp: number;
  screenshot: string;  // base64
  hash: string;
  description?: string;
}

export interface MonitorConfig {
  captureInterval: number;    // ms between captures (default 1000)
  analyzeInterval: number;    // ms between AI analysis (default 5000)
  changeThreshold: number;    // min hash difference to trigger change event (default 5)
  maxHistory: number;         // frames to keep in memory (default 20)
  autoAnalyze: boolean;       // automatically analyze on change (default false)
}

const DEFAULT_CONFIG: MonitorConfig = {
  captureInterval: 1000,
  analyzeInterval: 5000,
  changeThreshold: 5,
  maxHistory: 20,
  autoAnalyze: false,
};

export class ScreenMonitor extends EventEmitter {
  private config: MonitorConfig;
  private isRunning: boolean = false;
  private captureTimer: NodeJS.Timeout | null = null;
  private analyzeTimer: NodeJS.Timeout | null = null;
  private frameHistory: ScreenFrame[] = [];
  private lastHash: string = '';
  private lastAnalysis: string = '';
  private lastAnalysisTime: number = 0;

  constructor(config: Partial<MonitorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start monitoring the screen
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.emit('started');

    // Start capture loop
    this.captureLoop();

    // Start analysis loop if auto-analyze is enabled
    if (this.config.autoAnalyze) {
      this.analyzeLoop();
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;

    if (this.captureTimer) {
      clearTimeout(this.captureTimer);
      this.captureTimer = null;
    }

    if (this.analyzeTimer) {
      clearTimeout(this.analyzeTimer);
      this.analyzeTimer = null;
    }

    this.emit('stopped');
  }

  /**
   * Main capture loop
   */
  private async captureLoop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const screenshot = await captureScreenshot();
      if (screenshot) {
        const hash = this.hashScreenshot(screenshot);
        const frame: ScreenFrame = {
          timestamp: Date.now(),
          screenshot,
          hash,
        };

        // Check for changes
        const hasChanged = this.detectChange(hash);

        // Add to history
        this.addToHistory(frame);

        // Emit frame event
        this.emit('frame', frame);

        if (hasChanged) {
          this.emit('change', frame);

          // Auto-analyze on significant change
          if (this.config.autoAnalyze) {
            this.analyzeNow(frame);
          }
        }

        this.lastHash = hash;
      }
    } catch (error) {
      this.emit('error', { error });
    }

    // Schedule next capture
    this.captureTimer = setTimeout(() => this.captureLoop(), this.config.captureInterval);
  }

  /**
   * Analysis loop (runs less frequently than capture)
   */
  private async analyzeLoop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const latestFrame = this.getLatestFrame();
      if (latestFrame) {
        await this.analyzeNow(latestFrame);
      }
    } catch (error) {
      this.emit('error', { error });
    }

    // Schedule next analysis
    this.analyzeTimer = setTimeout(() => this.analyzeLoop(), this.config.analyzeInterval);
  }

  /**
   * Analyze a frame with AI vision
   */
  private async analyzeNow(frame: ScreenFrame): Promise<void> {
    // Rate limit analysis
    const now = Date.now();
    if (now - this.lastAnalysisTime < 2000) return;

    this.lastAnalysisTime = now;

    try {
      const result = await describeScreen();
      frame.description = result.description;
      this.lastAnalysis = result.description;
      this.emit('analyzed', { frame, description: result.description });
    } catch (error) {
      this.emit('analyze_error', { error });
    }
  }

  /**
   * Create a simple hash of the screenshot for change detection
   */
  private hashScreenshot(base64: string): string {
    // Use first 10KB of the image for quick hashing
    const sample = base64.slice(0, 10000);
    return crypto.createHash('md5').update(sample).digest('hex');
  }

  /**
   * Detect if screen has changed significantly
   */
  private detectChange(newHash: string): boolean {
    if (!this.lastHash) return true;
    return newHash !== this.lastHash;
  }

  /**
   * Add frame to history with size limit
   */
  private addToHistory(frame: ScreenFrame): void {
    this.frameHistory.push(frame);

    // Prune old frames
    while (this.frameHistory.length > this.config.maxHistory) {
      this.frameHistory.shift();
    }
  }

  /**
   * Get the latest captured frame
   */
  getLatestFrame(): ScreenFrame | null {
    return this.frameHistory[this.frameHistory.length - 1] || null;
  }

  /**
   * Get recent frame history
   */
  getHistory(count?: number): ScreenFrame[] {
    const frames = [...this.frameHistory];
    if (count) {
      return frames.slice(-count);
    }
    return frames;
  }

  /**
   * Get last AI analysis
   */
  getLastAnalysis(): string {
    return this.lastAnalysis;
  }

  /**
   * Force an immediate capture and analysis
   */
  async captureNow(): Promise<ScreenFrame | null> {
    try {
      const screenshot = await captureScreenshot();
      if (!screenshot) return null;

      const hash = this.hashScreenshot(screenshot);
      const result = await describeScreen();

      const frame: ScreenFrame = {
        timestamp: Date.now(),
        screenshot,
        hash,
        description: result.description,
      };

      this.addToHistory(frame);
      this.lastHash = hash;
      this.lastAnalysis = result.description;

      this.emit('frame', frame);
      this.emit('analyzed', { frame, description: result.description });

      return frame;
    } catch (error) {
      this.emit('error', { error });
      return null;
    }
  }

  /**
   * Check if monitor is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MonitorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.frameHistory = [];
    this.lastHash = '';
    this.lastAnalysis = '';
  }
}

// Singleton instance
let monitorInstance: ScreenMonitor | null = null;

export function getScreenMonitor(config?: Partial<MonitorConfig>): ScreenMonitor {
  if (!monitorInstance) {
    monitorInstance = new ScreenMonitor(config);
  }
  return monitorInstance;
}

export default ScreenMonitor;
