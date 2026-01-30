import React from 'react';
import { Box, Text } from 'ink';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, timestamp, isStreaming }: ChatMessageProps) {
  const time = timestamp ? timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

  const roleConfig = {
    user: { label: 'You', color: 'green' as const },
    assistant: { label: 'C-napse', color: 'cyan' as const },
    system: { label: 'System', color: 'yellow' as const },
  };

  const { label, color } = roleConfig[role];

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={color}>{label}</Text>
        <Text color="gray"> {time}</Text>
        {isStreaming && <Text color="yellow"> ●</Text>}
      </Box>
      <Box marginLeft={2}>
        <Text wrap="wrap">{content || (isStreaming ? 'Thinking...' : '')}</Text>
      </Box>
    </Box>
  );
}
