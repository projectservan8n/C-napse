import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getConfig, setProvider, setModel } from '../lib/config.js';

interface ProviderSelectorProps {
  onClose: () => void;
  onSelect: (provider: string, model: string) => void;
}

interface ProviderOption {
  id: 'ollama' | 'openrouter' | 'anthropic' | 'openai';
  name: string;
  description: string;
  defaultModel: string;
  models: string[];
}

const PROVIDERS: ProviderOption[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local AI - Free, private, no API key',
    defaultModel: 'qwen2.5:0.5b',
    models: ['qwen2.5:0.5b', 'qwen2.5:1.5b', 'qwen2.5:7b', 'llama3.2:1b', 'llama3.2:3b', 'mistral:7b', 'codellama:7b', 'llava:7b'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Many models, pay-per-use',
    defaultModel: 'qwen/qwen-2.5-coder-32b-instruct',
    models: [
      'qwen/qwen-2.5-coder-32b-instruct',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'google/gemini-pro-1.5',
      'meta-llama/llama-3.1-70b-instruct',
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models - Best for coding',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
];

type SelectionMode = 'provider' | 'model';

export function ProviderSelector({ onClose, onSelect }: ProviderSelectorProps) {
  const config = getConfig();
  const [mode, setMode] = useState<SelectionMode>('provider');
  const [providerIndex, setProviderIndex] = useState(() => {
    const idx = PROVIDERS.findIndex(p => p.id === config.provider);
    return idx >= 0 ? idx : 0;
  });
  const [modelIndex, setModelIndex] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption | null>(null);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (mode === 'provider') {
      if (key.upArrow) {
        setProviderIndex(prev => (prev > 0 ? prev - 1 : PROVIDERS.length - 1));
      } else if (key.downArrow) {
        setProviderIndex(prev => (prev < PROVIDERS.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        const provider = PROVIDERS[providerIndex]!;
        setSelectedProvider(provider);
        // Find current model index if it exists in the provider's models
        const currentModelIdx = provider.models.findIndex(m => m === config.model);
        setModelIndex(currentModelIdx >= 0 ? currentModelIdx : 0);
        setMode('model');
      }
    } else if (mode === 'model' && selectedProvider) {
      if (key.upArrow) {
        setModelIndex(prev => (prev > 0 ? prev - 1 : selectedProvider.models.length - 1));
      } else if (key.downArrow) {
        setModelIndex(prev => (prev < selectedProvider.models.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        const model = selectedProvider.models[modelIndex]!;
        // Save to config
        setProvider(selectedProvider.id);
        setModel(model);
        onSelect(selectedProvider.id, model);
        onClose();
      } else if (key.leftArrow || input === 'b') {
        setMode('provider');
      }
    }
  });

  if (mode === 'provider') {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">Select Provider</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="gray">Use arrows to navigate, Enter to select, Esc to cancel</Text>
        </Box>

        {PROVIDERS.map((provider, index) => {
          const isSelected = index === providerIndex;
          const isCurrent = provider.id === config.provider;

          return (
            <Box key={provider.id} marginY={0}>
              <Text color={isSelected ? 'cyan' : 'white'}>
                {isSelected ? '❯ ' : '  '}
                {provider.name}
                {isCurrent && <Text color="green"> (current)</Text>}
              </Text>
              {isSelected && (
                <Text color="gray"> - {provider.description}</Text>
              )}
            </Box>
          );
        })}

        <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text color="gray">
            Current: {config.provider} / {config.model}
          </Text>
        </Box>
      </Box>
    );
  }

  // Model selection mode
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Select Model for {selectedProvider?.name}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="gray">Arrows to navigate, Enter to select, B/Left to go back</Text>
      </Box>

      {selectedProvider?.models.map((model, index) => {
        const isSelected = index === modelIndex;
        const isCurrent = model === config.model && selectedProvider.id === config.provider;
        const isDefault = model === selectedProvider.defaultModel;

        return (
          <Box key={model} marginY={0}>
            <Text color={isSelected ? 'cyan' : 'white'}>
              {isSelected ? '❯ ' : '  '}
              {model}
              {isCurrent && <Text color="green"> (current)</Text>}
              {isDefault && !isCurrent && <Text color="yellow"> (default)</Text>}
            </Text>
          </Box>
        );
      })}

      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">
          Provider: {selectedProvider?.name}
        </Text>
      </Box>
    </Box>
  );
}
