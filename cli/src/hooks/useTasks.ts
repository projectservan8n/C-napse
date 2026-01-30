/**
 * Tasks Hook - Multi-step task automation
 */

import { useState, useCallback } from 'react';
import { parseTask, executeTask, formatTask, Task, TaskStep } from '../lib/tasks.js';

export interface UseTasksResult {
  isRunning: boolean;
  currentTask: Task | null;
  currentStep: TaskStep | null;
  error: string | null;
  run: (description: string) => Promise<Task>;
  format: (task: Task) => string;
}

export function useTasks(onProgress?: (task: Task, step: TaskStep) => void): UseTasksResult {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [currentStep, setCurrentStep] = useState<TaskStep | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (description: string): Promise<Task> => {
    setIsRunning(true);
    setError(null);

    try {
      // Parse the task
      const task = await parseTask(description);
      setCurrentTask(task);

      // Execute with progress callback
      const result = await executeTask(task, (updatedTask, step) => {
        setCurrentTask({ ...updatedTask });
        setCurrentStep(step);
        onProgress?.(updatedTask, step);
      });

      setCurrentTask(result);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Task failed';
      setError(errorMsg);
      throw err;
    } finally {
      setIsRunning(false);
      setCurrentStep(null);
    }
  }, [onProgress]);

  return {
    isRunning,
    currentTask,
    currentStep,
    error,
    run,
    format: formatTask,
  };
}
