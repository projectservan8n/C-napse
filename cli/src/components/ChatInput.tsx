import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isProcessing: boolean;
}

export function ChatInput({ value, onChange, onSubmit, isProcessing }: ChatInputProps) {
  return (
    <Box
      borderStyle="round"
      borderColor={isProcessing ? 'yellow' : 'blue'}
      paddingX={1}
    >
      <Text color={isProcessing ? 'yellow' : 'blue'}>
        {isProcessing ? 'Processing... ' : 'Message: '}
      </Text>
      {!isProcessing && (
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder="Type your message..."
        />
      )}
    </Box>
  );
}
