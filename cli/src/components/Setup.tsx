import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { setApiKey, setProvider, setModel, getConfig } from '../lib/config.js';

type Step = 'provider' | 'apiKey' | 'model' | 'done';

const PROVIDERS = [
  { id: 'ollama', name: 'Ollama', desc: 'Local AI (free, no API key needed)' },
  { id: 'openrouter', name: 'OpenRouter', desc: 'Many models, pay per use' },
  { id: 'anthropic', name: 'Anthropic', desc: 'Claude models' },
  { id: 'openai', name: 'OpenAI', desc: 'GPT models' },
] as const;

const DEFAULT_MODELS: Record<string, string[]> = {
  ollama: ['qwen2.5:0.5b', 'qwen2.5:7b', 'llama3.2:3b', 'codellama:7b'],
  openrouter: [
    'qwen/qwen-2.5-coder-32b-instruct',  // $0.07/1M - Best value!
    'qwen/qwen-2-vl-7b-instruct',         // FREE - Vision model
    'meta-llama/llama-3.3-70b-instruct',  // $0.10/1M
    'google/gemini-2.0-flash-001',        // Free tier
  ],
  anthropic: [
    'claude-3-5-sonnet-20241022',
    'claude-3-haiku-20240307',
  ],
  openai: ['gpt-4o-mini', 'gpt-3.5-turbo'],
};

export function Setup() {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('provider');
  const [selectedProvider, setSelectedProvider] = useState(0);
  const [selectedModel, setSelectedModel] = useState(0);
  const [apiKey, setApiKeyInput] = useState('');
  const [provider, setProviderState] = useState<string>('ollama');

  useInput((input, key) => {
    if (key.escape) {
      exit();
      return;
    }

    if (step === 'provider') {
      if (key.upArrow) {
        setSelectedProvider((prev) => (prev > 0 ? prev - 1 : PROVIDERS.length - 1));
      } else if (key.downArrow) {
        setSelectedProvider((prev) => (prev < PROVIDERS.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        const selected = PROVIDERS[selectedProvider]!;
        setProviderState(selected.id);
        setProvider(selected.id as any);

        if (selected.id === 'ollama') {
          setStep('model');
        } else {
          setStep('apiKey');
        }
      }
    } else if (step === 'model') {
      const models = DEFAULT_MODELS[provider] || [];
      if (key.upArrow) {
        setSelectedModel((prev) => (prev > 0 ? prev - 1 : models.length - 1));
      } else if (key.downArrow) {
        setSelectedModel((prev) => (prev < models.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        const model = models[selectedModel]!;
        setModel(model);
        setStep('done');
        setTimeout(() => exit(), 1500);
      }
    }
  });

  const handleApiKeySubmit = (value: string) => {
    if (value.trim()) {
      setApiKey(provider as any, value.trim());
      setApiKeyInput(value);
      setStep('model');
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🚀 C-napse Setup
        </Text>
      </Box>

      {step === 'provider' && (
        <Box flexDirection="column">
          <Text bold>Select AI Provider:</Text>
          <Text color="gray" dimColor>
            (Use ↑↓ arrows, Enter to select)
          </Text>
          <Box marginTop={1} flexDirection="column">
            {PROVIDERS.map((p, i) => (
              <Box key={p.id}>
                <Text color={i === selectedProvider ? 'cyan' : 'white'}>
                  {i === selectedProvider ? '❯ ' : '  '}
                  <Text bold={i === selectedProvider}>{p.name}</Text>
                  <Text color="gray"> - {p.desc}</Text>
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {step === 'apiKey' && (
        <Box flexDirection="column">
          <Text>
            <Text color="green">✓</Text> Provider: <Text bold>{provider}</Text>
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text bold>Enter your {provider} API key:</Text>
            <Text color="gray" dimColor>
              (Paste with Ctrl+V or right-click, then Enter)
            </Text>
            <Box marginTop={1}>
              <Text color="cyan">❯ </Text>
              <TextInput
                value={apiKey}
                onChange={setApiKeyInput}
                onSubmit={handleApiKeySubmit}
                mask="*"
              />
            </Box>
          </Box>
        </Box>
      )}

      {step === 'model' && (
        <Box flexDirection="column">
          <Text>
            <Text color="green">✓</Text> Provider: <Text bold>{provider}</Text>
          </Text>
          {provider !== 'ollama' && (
            <Text>
              <Text color="green">✓</Text> API Key: <Text bold>saved</Text>
            </Text>
          )}
          <Box marginTop={1} flexDirection="column">
            <Text bold>Select Model:</Text>
            <Text color="gray" dimColor>
              (Use ↑↓ arrows, Enter to select)
            </Text>
            <Box marginTop={1} flexDirection="column">
              {(DEFAULT_MODELS[provider] || []).map((model, i) => (
                <Box key={model}>
                  <Text color={i === selectedModel ? 'cyan' : 'white'}>
                    {i === selectedModel ? '❯ ' : '  '}
                    <Text bold={i === selectedModel}>{model}</Text>
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {step === 'done' && (
        <Box flexDirection="column">
          <Text>
            <Text color="green">✓</Text> Provider: <Text bold>{provider}</Text>
          </Text>
          {provider !== 'ollama' && (
            <Text>
              <Text color="green">✓</Text> API Key: <Text bold>saved</Text>
            </Text>
          )}
          <Text>
            <Text color="green">✓</Text> Model:{' '}
            <Text bold>{DEFAULT_MODELS[provider]?.[selectedModel]}</Text>
          </Text>
          <Box marginTop={1}>
            <Text color="green" bold>
              ✅ Setup complete! Run `cnapse` to start chatting.
            </Text>
          </Box>
          {provider === 'ollama' && (
            <Box marginTop={1} flexDirection="column">
              <Text color="yellow">
                Note: Make sure the model is downloaded. Run:
              </Text>
              <Text color="cyan">
                {'  '}ollama pull {DEFAULT_MODELS[provider]?.[selectedModel]}
              </Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={2}>
        <Text color="gray" dimColor>
          Press Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}
