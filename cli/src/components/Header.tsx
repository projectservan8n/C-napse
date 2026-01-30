import React from 'react';
import { Box, Text } from 'ink';
import { getConfig } from '../lib/config.js';

const ASCII_BANNER = `
  ██████╗      ███╗   ██╗ █████╗ ██████╗ ███████╗███████╗
 ██╔════╝      ████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝
 ██║     █████╗██╔██╗ ██║███████║██████╔╝███████╗█████╗
 ██║     ╚════╝██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝
 ╚██████╗      ██║ ╚████║██║  ██║██║     ███████║███████╗
  ╚═════╝      ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝
`.trim();

export function Header() {
  const config = getConfig();

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan">{ASCII_BANNER}</Text>
      <Box justifyContent="center">
        <Text color="gray">
          {config.provider} │ {config.model}
        </Text>
      </Box>
    </Box>
  );
}
