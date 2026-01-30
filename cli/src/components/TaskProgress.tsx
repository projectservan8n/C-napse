import React from 'react';
import { Box, Text } from 'ink';
import type { Task, TaskStep } from '../lib/tasks.js';

interface TaskProgressProps {
  task: Task;
}

const statusEmoji: Record<Task['status'], string> = {
  pending: '⏳',
  running: '🔄',
  completed: '✅',
  failed: '❌',
};

const stepStatusEmoji: Record<TaskStep['status'], string> = {
  pending: '○',
  running: '◐',
  completed: '●',
  failed: '✗',
  skipped: '◌',
};

const stepStatusColor: Record<TaskStep['status'], string> = {
  pending: 'gray',
  running: 'yellow',
  completed: 'green',
  failed: 'red',
  skipped: 'gray',
};

export function TaskProgress({ task }: TaskProgressProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1} marginY={1}>
      <Box marginBottom={1}>
        <Text bold>
          {statusEmoji[task.status]} Task: {task.description}
        </Text>
      </Box>

      {task.steps.map((step, index) => (
        <Box key={step.id} marginLeft={2}>
          <Text color={stepStatusColor[step.status]}>
            {stepStatusEmoji[step.status]} {step.description}
          </Text>
          {step.result && (
            <Text color="gray" dimColor> → {step.result}</Text>
          )}
          {step.error && (
            <Text color="red"> (Error: {step.error})</Text>
          )}
        </Box>
      ))}

      {task.status === 'completed' && (
        <Box marginTop={1}>
          <Text color="green">✓ Task completed</Text>
        </Box>
      )}

      {task.status === 'failed' && (
        <Box marginTop={1}>
          <Text color="red">✗ Task failed</Text>
        </Box>
      )}
    </Box>
  );
}
