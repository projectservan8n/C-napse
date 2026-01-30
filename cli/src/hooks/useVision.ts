/**
 * Vision Hook - Screenshot capture and AI description
 */

import { useState, useCallback } from 'react';
import { describeScreen } from '../lib/vision.js';

export interface UseVisionResult {
  isAnalyzing: boolean;
  lastDescription: string | null;
  lastScreenshot: string | null;
  error: string | null;
  analyze: () => Promise<string>;
}

export function useVision(): UseVisionResult {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastDescription, setLastDescription] = useState<string | null>(null);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (): Promise<string> => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await describeScreen();
      setLastDescription(result.description);
      setLastScreenshot(result.screenshot);
      return result.description;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Vision analysis failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return {
    isAnalyzing,
    lastDescription,
    lastScreenshot,
    error,
    analyze,
  };
}
