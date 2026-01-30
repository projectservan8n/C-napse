/**
 * Vision tools - Screenshot capture and AI description
 */

import { describeScreen, captureScreenshot } from '../lib/vision.js';

export interface ScreenshotResult {
  success: boolean;
  screenshot?: string; // base64
  error?: string;
}

export interface VisionResult {
  success: boolean;
  description?: string;
  screenshot?: string; // base64
  error?: string;
}

/**
 * Take a screenshot and return as base64
 */
export async function takeScreenshot(): Promise<ScreenshotResult> {
  try {
    const screenshot = await captureScreenshot();
    if (!screenshot) {
      return { success: false, error: 'Failed to capture screenshot' };
    }
    return { success: true, screenshot };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Screenshot failed',
    };
  }
}

/**
 * Capture screen and get AI description of what's visible
 */
export async function describeCurrentScreen(): Promise<VisionResult> {
  try {
    const result = await describeScreen();
    return {
      success: true,
      description: result.description,
      screenshot: result.screenshot,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Vision analysis failed',
    };
  }
}

/**
 * Get all vision tools for the executor
 */
export function getVisionTools() {
  return {
    takeScreenshot,
    describeCurrentScreen,
  };
}
