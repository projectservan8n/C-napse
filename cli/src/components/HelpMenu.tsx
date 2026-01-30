import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface MenuItem {
  command: string;
  shortcut?: string;
  description: string;
  category: 'navigation' | 'actions' | 'settings';
}

const MENU_ITEMS: MenuItem[] = [
  // Navigation
  { command: '/help', shortcut: 'Ctrl+H', description: 'Show this help menu', category: 'navigation' },
  { command: '/clear', shortcut: 'Ctrl+L', description: 'Clear chat history', category: 'navigation' },
  { command: '/quit', shortcut: 'Ctrl+C', description: 'Exit C-napse', category: 'navigation' },

  // Actions
  { command: '/screen', shortcut: 'Ctrl+S', description: 'Take screenshot and describe', category: 'actions' },
  { command: '/task', description: 'Run multi-step task', category: 'actions' },
  { command: '/telegram', shortcut: 'Ctrl+T', description: 'Toggle Telegram bot', category: 'actions' },

  // Settings
  { command: '/config', description: 'Show/edit configuration', category: 'settings' },
  { command: '/watch', shortcut: 'Ctrl+W', description: 'Toggle screen watching', category: 'settings' },
  { command: '/model', description: 'Change AI model', category: 'settings' },
  { command: '/provider', description: 'Change AI provider', category: 'settings' },
];

interface HelpMenuProps {
  onClose: () => void;
  onSelect: (command: string) => void;
}

export function HelpMenu({ onClose, onSelect }: HelpMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<'all' | MenuItem['category']>('all');

  const filteredItems = selectedCategory === 'all'
    ? MENU_ITEMS
    : MENU_ITEMS.filter(item => item.category === selectedCategory);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    }

    if (key.downArrow) {
      setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    }

    if (key.leftArrow || key.rightArrow) {
      const categories: Array<'all' | MenuItem['category']> = ['all', 'navigation', 'actions', 'settings'];
      const currentIdx = categories.indexOf(selectedCategory);
      if (key.leftArrow) {
        setSelectedCategory(categories[currentIdx > 0 ? currentIdx - 1 : categories.length - 1]!);
      } else {
        setSelectedCategory(categories[currentIdx < categories.length - 1 ? currentIdx + 1 : 0]!);
      }
      setSelectedIndex(0);
    }

    if (key.return) {
      const item = filteredItems[selectedIndex];
      if (item) {
        onSelect(item.command);
        onClose();
      }
    }
  });

  const categories: Array<{ key: 'all' | MenuItem['category']; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'navigation', label: 'Navigation' },
    { key: 'actions', label: 'Actions' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      width={60}
    >
      {/* Header */}
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">C-napse Help</Text>
      </Box>

      {/* Category Tabs */}
      <Box justifyContent="center" marginBottom={1}>
        {categories.map((cat, idx) => (
          <React.Fragment key={cat.key}>
            <Text
              color={selectedCategory === cat.key ? 'cyan' : 'gray'}
              bold={selectedCategory === cat.key}
            >
              {cat.label}
            </Text>
            {idx < categories.length - 1 && <Text color="gray"> │ </Text>}
          </React.Fragment>
        ))}
      </Box>

      <Box marginBottom={1}>
        <Text color="gray" dimColor>Use ←→ to switch tabs, ↑↓ to navigate, Enter to select</Text>
      </Box>

      {/* Menu Items */}
      <Box flexDirection="column">
        {filteredItems.map((item, index) => (
          <Box key={item.command}>
            <Text color={index === selectedIndex ? 'cyan' : 'white'}>
              {index === selectedIndex ? '❯ ' : '  '}
            </Text>
            <Box width={12}>
              <Text bold={index === selectedIndex} color={index === selectedIndex ? 'cyan' : 'white'}>
                {item.command}
              </Text>
            </Box>
            {item.shortcut && (
              <Box width={10}>
                <Text color="yellow" dimColor>{item.shortcut}</Text>
              </Box>
            )}
            <Text color="gray">{item.description}</Text>
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box marginTop={1} justifyContent="center">
        <Text color="gray" dimColor>Press Esc to close</Text>
      </Box>
    </Box>
  );
}
