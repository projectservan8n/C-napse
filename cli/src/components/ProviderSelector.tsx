/**
 * Provider Selector - Used in TUI for /provider command
 * - Shows provider list with API key status
 * - Prompts for API key if needed
 * - Shows model list with recommendations
 * - For Ollama: shows model availability status
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { getConfig, setProvider, setModel, setApiKey } from '../lib/config.js';
import { checkOllamaStatus, hasModel, OllamaStatus } from '../lib/ollama.js';

interface ProviderSelectorProps {
  onClose: () => void;
  onSelect: (provider: string, model: string) => void;
}

interface ModelConfig {
  id: string;
  name: string;
  recommended?: boolean;
}

interface ProviderConfig {
  id: 'ollama' | 'openrouter' | 'anthropic' | 'openai';
  name: string;
  description: string;
  needsApiKey: boolean;
  models: ModelConfig[];
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local AI - Free, private',
    needsApiKey: false,
    models: [
      { id: 'qwen2.5:0.5b', name: 'Qwen 2.5 0.5B (fast)', recommended: true },
      { id: 'qwen2.5:1.5b', name: 'Qwen 2.5 1.5B' },
      { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B (quality)' },
      { id: 'llama3.2:1b', name: 'Llama 3.2 1B' },
      { id: 'llama3.2:3b', name: 'Llama 3.2 3B' },
      { id: 'codellama:7b', name: 'Code Llama 7B' },
      { id: 'llava:7b', name: 'LLaVA 7B (vision)' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Many models, pay-per-use',
    needsApiKey: true,
    models: [
      { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen Coder 32B', recommended: true },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude - Best reasoning',
    needsApiKey: true,
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', recommended: true },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models',
    needsApiKey: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', recommended: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    ],
  },
];

type Step = 'provider' | 'apiKey' | 'model' | 'ollamaError' | 'done';

export function ProviderSelector({ onClose, onSelect }: ProviderSelectorProps) {
  const config = getConfig();
  const [step, setStep] = useState<Step>('provider');
  const [providerIndex, setProviderIndex] = useState(() => {
    const idx = PROVIDERS.findIndex(p => p.id === config.provider);
    return idx >= 0 ? idx : 0;
  });
  const [modelIndex, setModelIndex] = useState(0);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);

  // Ollama status
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(false);

  // Check Ollama status when selecting Ollama provider
  useEffect(() => {
    if (step === 'model' && selectedProvider?.id === 'ollama' && !ollamaStatus) {
      setCheckingOllama(true);
      checkOllamaStatus().then(status => {
        setOllamaStatus(status);
        setCheckingOllama(false);

        // If Ollama isn't running, show error
        if (!status.running) {
          setStep('ollamaError');
        }
      });
    }
  }, [step, selectedProvider, ollamaStatus]);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (step === 'provider') {
      if (key.upArrow) {
        setProviderIndex(prev => (prev > 0 ? prev - 1 : PROVIDERS.length - 1));
      } else if (key.downArrow) {
        setProviderIndex(prev => (prev < PROVIDERS.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        const provider = PROVIDERS[providerIndex]!;
        setSelectedProvider(provider);

        // Find recommended or current model
        const currentIdx = provider.models.findIndex(m => m.id === config.model);
        const recommendedIdx = provider.models.findIndex(m => m.recommended);
        setModelIndex(currentIdx >= 0 ? currentIdx : (recommendedIdx >= 0 ? recommendedIdx : 0));

        // Check if we need API key
        if (provider.needsApiKey) {
          const apiKeyProvider = provider.id as 'openrouter' | 'anthropic' | 'openai';
          if (!config.apiKeys[apiKeyProvider]) {
            setStep('apiKey');
          } else {
            setStep('model');
          }
        } else {
          setStep('model');
        }
      }
    } else if (step === 'model' && selectedProvider) {
      if (key.upArrow) {
        setModelIndex(prev => (prev > 0 ? prev - 1 : selectedProvider.models.length - 1));
      } else if (key.downArrow) {
        setModelIndex(prev => (prev < selectedProvider.models.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        const model = selectedProvider.models[modelIndex]!;

        // For Ollama, warn if model not available
        if (selectedProvider.id === 'ollama' && ollamaStatus && !hasModel(ollamaStatus, model.id)) {
          // Still allow selection, but they'll need to pull it
        }

        setProvider(selectedProvider.id);
        setModel(model.id);
        setStep('done');
        onSelect(selectedProvider.id, model.id);

        // Brief delay to show confirmation
        setTimeout(() => onClose(), 1500);
      } else if (key.leftArrow || input === 'b') {
        setStep('provider');
        setOllamaStatus(null); // Reset Ollama status
      }
    } else if (step === 'ollamaError') {
      if (key.return || input === 'b') {
        setStep('provider');
        setOllamaStatus(null);
      }
    }
  });

  const handleApiKeySubmit = (value: string) => {
    if (value.trim() && selectedProvider) {
      setApiKey(selectedProvider.id as 'openrouter' | 'anthropic' | 'openai', value.trim());
      setStep('model');
    }
  };

  // Provider selection
  if (step === 'provider') {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1} width={60}>
        <Box marginBottom={1}>
          <Text bold color="cyan">Select Provider</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="gray" dimColor>Arrows to navigate, Enter to select</Text>
        </Box>

        {PROVIDERS.map((provider, index) => {
          const isSelected = index === providerIndex;
          const isCurrent = provider.id === config.provider;
          const hasKey = provider.needsApiKey && provider.id !== 'ollama'
            ? !!config.apiKeys[provider.id as 'openrouter' | 'anthropic' | 'openai']
            : true;

          return (
            <Box key={provider.id} flexDirection="column">
              <Text color={isSelected ? 'cyan' : 'white'}>
                {isSelected ? '❯ ' : '  '}
                {provider.name}
                {isCurrent && <Text color="green"> (current)</Text>}
                {provider.needsApiKey && !hasKey && <Text color="red"> (needs key)</Text>}
                {provider.needsApiKey && hasKey && !isCurrent && <Text color="yellow"> (key saved)</Text>}
              </Text>
              {isSelected && (
                <Text color="gray">    {provider.description}</Text>
              )}
            </Box>
          );
        })}

        <Box marginTop={1}>
          <Text color="gray" dimColor>Press Esc to cancel</Text>
        </Box>
      </Box>
    );
  }

  // API Key input
  if (step === 'apiKey' && selectedProvider) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1} width={60}>
        <Box marginBottom={1}>
          <Text bold color="cyan">Enter API Key</Text>
        </Box>
        <Text><Text color="green">✓</Text> Provider: {selectedProvider.name}</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="gray" dimColor>
            {selectedProvider.id === 'openrouter' && 'Get key: openrouter.ai/keys'}
            {selectedProvider.id === 'anthropic' && 'Get key: console.anthropic.com'}
            {selectedProvider.id === 'openai' && 'Get key: platform.openai.com/api-keys'}
          </Text>
          <Box marginTop={1}>
            <Text color="cyan">❯ </Text>
            <TextInput
              value={apiKeyInput}
              onChange={setApiKeyInput}
              onSubmit={handleApiKeySubmit}
              mask="*"
            />
          </Box>
        </Box>
        <Box marginTop={1}>
          <Text color="gray" dimColor>Press Esc to cancel</Text>
        </Box>
      </Box>
    );
  }

  // Ollama error
  if (step === 'ollamaError' && ollamaStatus) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="red" padding={1} width={60}>
        <Box marginBottom={1}>
          <Text bold color="red">Ollama Not Available</Text>
        </Box>
        <Text color="red">{ollamaStatus.error}</Text>
        <Box marginTop={1} flexDirection="column">
          {!ollamaStatus.installed && (
            <>
              <Text>1. Install Ollama from https://ollama.ai</Text>
              <Text>2. Run: ollama pull qwen2.5:0.5b</Text>
              <Text>3. Try again</Text>
            </>
          )}
          {ollamaStatus.installed && !ollamaStatus.running && (
            <>
              <Text>1. Start Ollama: ollama serve</Text>
              <Text>2. Or run any model: ollama run qwen2.5:0.5b</Text>
              <Text>3. Try again</Text>
            </>
          )}
        </Box>
        <Box marginTop={1}>
          <Text color="gray" dimColor>Press Enter or B to go back</Text>
        </Box>
      </Box>
    );
  }

  // Model selection
  if (step === 'model' && selectedProvider) {
    const isOllama = selectedProvider.id === 'ollama';

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1} width={60}>
        <Box marginBottom={1}>
          <Text bold color="cyan">Select Model</Text>
        </Box>
        <Text><Text color="green">✓</Text> Provider: {selectedProvider.name}</Text>

        {isOllama && checkingOllama && (
          <Box marginY={1}>
            <Text color="cyan"><Spinner type="dots" /></Text>
            <Text> Checking Ollama status...</Text>
          </Box>
        )}

        {isOllama && ollamaStatus && ollamaStatus.running && (
          <Text color="green">✓ Ollama running ({ollamaStatus.models.length} models installed)</Text>
        )}

        <Box marginTop={1} marginBottom={1}>
          <Text color="gray" dimColor>Arrows to navigate, Enter to select, B to go back</Text>
        </Box>

        {selectedProvider.models.map((model, index) => {
          const isSelected = index === modelIndex;
          const isCurrent = model.id === config.model && selectedProvider.id === config.provider;

          // Check if Ollama model is available
          let modelStatus = '';
          if (isOllama && ollamaStatus) {
            const available = hasModel(ollamaStatus, model.id);
            modelStatus = available ? ' (installed)' : ' (not installed)';
          }

          return (
            <Text key={model.id} color={isSelected ? 'cyan' : 'white'}>
              {isSelected ? '❯ ' : '  '}
              {model.name}
              {model.recommended && <Text color="yellow"> *</Text>}
              {isCurrent && <Text color="green"> (current)</Text>}
              {isOllama && ollamaStatus && (
                hasModel(ollamaStatus, model.id)
                  ? <Text color="green">{modelStatus}</Text>
                  : <Text color="red">{modelStatus}</Text>
              )}
            </Text>
          );
        })}

        {isOllama && (
          <Box marginTop={1} flexDirection="column">
            <Text color="gray" dimColor>* = Recommended</Text>
            {ollamaStatus && !hasModel(ollamaStatus, selectedProvider.models[modelIndex]?.id || '') && (
              <Text color="yellow">Run: ollama pull {selectedProvider.models[modelIndex]?.id}</Text>
            )}
          </Box>
        )}

        <Box marginTop={1}>
          <Text color="gray" dimColor>Press Esc to cancel</Text>
        </Box>
      </Box>
    );
  }

  // Done
  if (step === 'done' && selectedProvider) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="green" padding={1} width={60}>
        <Text color="green" bold>Configuration Updated!</Text>
        <Text><Text color="green">✓</Text> Provider: {selectedProvider.name}</Text>
        <Text><Text color="green">✓</Text> Model: {selectedProvider.models[modelIndex]?.name}</Text>
        {selectedProvider.id === 'ollama' && ollamaStatus && !hasModel(ollamaStatus, selectedProvider.models[modelIndex]?.id || '') && (
          <Text color="yellow">Remember to run: ollama pull {selectedProvider.models[modelIndex]?.id}</Text>
        )}
      </Box>
    );
  }

  return null;
}
