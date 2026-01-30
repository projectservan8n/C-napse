/**
 * Interactive Configuration UI
 * - Select provider
 * - Enter API key (for non-Ollama)
 * - Select model from recommended list
 * - For Ollama: runs the model to ensure it's ready
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { getConfig, setProvider, setModel, setApiKey } from '../lib/config.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

type Step = 'provider' | 'apiKey' | 'model' | 'ollamaCheck' | 'done';

interface ProviderConfig {
  id: 'ollama' | 'openrouter' | 'anthropic' | 'openai';
  name: string;
  description: string;
  needsApiKey: boolean;
  models: Array<{
    id: string;
    name: string;
    description: string;
    recommended?: boolean;
  }>;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local AI - Free, private, runs on your PC',
    needsApiKey: false,
    models: [
      { id: 'qwen2.5:0.5b', name: 'Qwen 2.5 0.5B', description: 'Ultra fast, good for tasks', recommended: true },
      { id: 'qwen2.5:1.5b', name: 'Qwen 2.5 1.5B', description: 'Fast, better quality' },
      { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', description: 'Best quality, needs 8GB+ RAM' },
      { id: 'llama3.2:1b', name: 'Llama 3.2 1B', description: 'Fast, good general use' },
      { id: 'llama3.2:3b', name: 'Llama 3.2 3B', description: 'Balanced speed/quality' },
      { id: 'codellama:7b', name: 'Code Llama 7B', description: 'Best for coding tasks' },
      { id: 'llava:7b', name: 'LLaVA 7B', description: 'Vision model - can see images' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Many models, pay-per-use, great value',
    needsApiKey: true,
    models: [
      { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', description: 'Best value! $0.07/1M tokens', recommended: true },
      { id: 'qwen/qwen-2-vl-7b-instruct', name: 'Qwen 2 VL 7B', description: 'FREE! Vision model' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', description: 'Powerful, $0.10/1M tokens' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast, $0.15/1M tokens' },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', description: 'Free tier available' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', description: 'Cheap, $0.14/1M tokens' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models - Best for complex reasoning',
    needsApiKey: true,
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best balance of speed/quality', recommended: true },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable, slower' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest, cheapest' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models - Well-known, reliable',
    needsApiKey: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Latest, multimodal', recommended: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and cheap' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous best' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Legacy, very cheap' },
    ],
  },
];

export function ConfigUI() {
  const { exit } = useApp();
  const config = getConfig();

  const [step, setStep] = useState<Step>('provider');
  const [providerIndex, setProviderIndex] = useState(() => {
    const idx = PROVIDERS.findIndex(p => p.id === config.provider);
    return idx >= 0 ? idx : 0;
  });
  const [modelIndex, setModelIndex] = useState(0);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'pulling' | 'running' | 'ready' | 'error'>('checking');
  const [ollamaMessage, setOllamaMessage] = useState('');

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape) {
      exit();
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
        setProvider(provider.id);

        // Find recommended model index
        const recommendedIdx = provider.models.findIndex(m => m.recommended);
        setModelIndex(recommendedIdx >= 0 ? recommendedIdx : 0);

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
        setModel(model.id);

        if (selectedProvider.id === 'ollama') {
          setStep('ollamaCheck');
        } else {
          setStep('done');
          setTimeout(() => exit(), 2000);
        }
      } else if (key.leftArrow || input === 'b') {
        setStep('provider');
      }
    }
  });

  // Handle API key submission
  const handleApiKeySubmit = (value: string) => {
    if (value.trim() && selectedProvider) {
      setApiKey(selectedProvider.id as 'openrouter' | 'anthropic' | 'openai', value.trim());
      setStep('model');
    }
  };

  // Ollama model check and run
  useEffect(() => {
    if (step !== 'ollamaCheck' || !selectedProvider) return;

    const modelId = selectedProvider.models[modelIndex]!.id;

    async function checkAndRunOllama() {
      try {
        // Check if Ollama is running
        setOllamaStatus('checking');
        setOllamaMessage('Checking Ollama...');

        try {
          await execAsync('ollama list', { timeout: 5000 });
        } catch {
          setOllamaStatus('error');
          setOllamaMessage('Ollama not found. Install from https://ollama.ai');
          setTimeout(() => exit(), 3000);
          return;
        }

        // Check if model exists
        const { stdout } = await execAsync('ollama list');
        const modelName = modelId.split(':')[0];
        const hasModel = stdout.toLowerCase().includes(modelName!.toLowerCase());

        if (!hasModel) {
          setOllamaStatus('pulling');
          setOllamaMessage(`Downloading ${modelId}... (this may take a few minutes)`);

          // Pull the model
          await execAsync(`ollama pull ${modelId}`, { timeout: 600000 }); // 10 min timeout
        }

        // Run the model to load it into memory
        setOllamaStatus('running');
        setOllamaMessage(`Starting ${modelId}...`);

        // Send a simple request to load the model
        await execAsync(`ollama run ${modelId} "Hello" --nowordwrap`, { timeout: 120000 });

        setOllamaStatus('ready');
        setOllamaMessage(`${modelId} is ready!`);
        setStep('done');
        setTimeout(() => exit(), 2000);

      } catch (err) {
        setOllamaStatus('error');
        setOllamaMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setTimeout(() => exit(), 3000);
      }
    }

    checkAndRunOllama();
  }, [step, selectedProvider, modelIndex, exit]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">C-napse Configuration</Text>
      </Box>

      {/* Provider Selection */}
      {step === 'provider' && (
        <Box flexDirection="column">
          <Text bold>Select AI Provider:</Text>
          <Text color="gray" dimColor>(Use arrows, Enter to select, Esc to cancel)</Text>
          <Box marginTop={1} flexDirection="column">
            {PROVIDERS.map((p, i) => {
              const isSelected = i === providerIndex;
              const isCurrent = p.id === config.provider;
              return (
                <Box key={p.id} flexDirection="column">
                  <Text color={isSelected ? 'cyan' : 'white'}>
                    {isSelected ? '❯ ' : '  '}
                    <Text bold={isSelected}>{p.name}</Text>
                    {isCurrent && <Text color="green"> (current)</Text>}
                    {p.needsApiKey && p.id !== 'ollama' && config.apiKeys[p.id as 'openrouter' | 'anthropic' | 'openai'] && <Text color="yellow"> (key saved)</Text>}
                  </Text>
                  {isSelected && (
                    <Text color="gray">    {p.description}</Text>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* API Key Input */}
      {step === 'apiKey' && selectedProvider && (
        <Box flexDirection="column">
          <Text><Text color="green">✓</Text> Provider: <Text bold>{selectedProvider.name}</Text></Text>
          <Box marginTop={1} flexDirection="column">
            <Text bold>Enter your {selectedProvider.name} API key:</Text>
            <Text color="gray" dimColor>
              {selectedProvider.id === 'openrouter' && 'Get key at: https://openrouter.ai/keys'}
              {selectedProvider.id === 'anthropic' && 'Get key at: https://console.anthropic.com'}
              {selectedProvider.id === 'openai' && 'Get key at: https://platform.openai.com/api-keys'}
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
        </Box>
      )}

      {/* Model Selection */}
      {step === 'model' && selectedProvider && (
        <Box flexDirection="column">
          <Text><Text color="green">✓</Text> Provider: <Text bold>{selectedProvider.name}</Text></Text>
          {selectedProvider.needsApiKey && (
            <Text><Text color="green">✓</Text> API Key: <Text bold>configured</Text></Text>
          )}
          <Box marginTop={1} flexDirection="column">
            <Text bold>Select Model:</Text>
            <Text color="gray" dimColor>(Arrows to navigate, Enter to select, B to go back)</Text>
            <Box marginTop={1} flexDirection="column">
              {selectedProvider.models.map((model, i) => {
                const isSelected = i === modelIndex;
                const isCurrent = model.id === config.model && selectedProvider.id === config.provider;
                return (
                  <Box key={model.id} flexDirection="column">
                    <Text color={isSelected ? 'cyan' : 'white'}>
                      {isSelected ? '❯ ' : '  '}
                      <Text bold={isSelected}>{model.name}</Text>
                      {model.recommended && <Text color="yellow"> *</Text>}
                      {isCurrent && <Text color="green"> (current)</Text>}
                    </Text>
                    {isSelected && (
                      <Text color="gray">    {model.description}</Text>
                    )}
                  </Box>
                );
              })}
            </Box>
            <Box marginTop={1}>
              <Text color="gray" dimColor>* = Recommended for C-napse</Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Ollama Check */}
      {step === 'ollamaCheck' && selectedProvider && (
        <Box flexDirection="column">
          <Text><Text color="green">✓</Text> Provider: <Text bold>{selectedProvider.name}</Text></Text>
          <Text><Text color="green">✓</Text> Model: <Text bold>{selectedProvider.models[modelIndex]?.name}</Text></Text>
          <Box marginTop={1}>
            {ollamaStatus === 'error' ? (
              <Text color="red">✗ {ollamaMessage}</Text>
            ) : ollamaStatus === 'ready' ? (
              <Text color="green">✓ {ollamaMessage}</Text>
            ) : (
              <Text>
                <Text color="cyan"><Spinner type="dots" /></Text>
                {' '}{ollamaMessage}
              </Text>
            )}
          </Box>
        </Box>
      )}

      {/* Done */}
      {step === 'done' && selectedProvider && (
        <Box flexDirection="column">
          <Text><Text color="green">✓</Text> Provider: <Text bold>{selectedProvider.name}</Text></Text>
          {selectedProvider.needsApiKey && (
            <Text><Text color="green">✓</Text> API Key: <Text bold>configured</Text></Text>
          )}
          <Text><Text color="green">✓</Text> Model: <Text bold>{selectedProvider.models[modelIndex]?.name}</Text></Text>
          <Box marginTop={1}>
            <Text color="green" bold>Configuration saved! Run `cnapse` to start.</Text>
          </Box>
        </Box>
      )}

      <Box marginTop={2}>
        <Text color="gray" dimColor>Press Esc to cancel</Text>
      </Box>
    </Box>
  );
}
