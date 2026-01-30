import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  status: string;
}

export function StatusBar({ status }: StatusBarProps) {
  return (
    <Box>
      <Text backgroundColor="gray" color="white">
        {` ${status} │ Ctrl+C: Exit │ Enter: Send `}
      </Text>
    </Box>
  );
}
