import Conf from 'conf';

interface ConfigSchema {
  provider: 'openrouter' | 'ollama' | 'anthropic' | 'openai';
  model: string;
  apiKeys: {
    openrouter?: string;
    anthropic?: string;
    openai?: string;
    telegram?: string;
  };
  ollamaHost: string;
  openrouter: {
    siteUrl: string;
    appName: string;
  };
  telegram: {
    chatId?: number;
    enabled: boolean;
  };
}

const config = new Conf<ConfigSchema>({
  projectName: 'cnapse',
  defaults: {
    provider: 'ollama',
    model: 'qwen2.5:0.5b',
    apiKeys: {},
    ollamaHost: 'http://localhost:11434',
    openrouter: {
      siteUrl: 'https://github.com/projectservan8n/C-napse',
      appName: 'C-napse',
    },
    telegram: {
      enabled: false,
    },
  },
});

export function getConfig() {
  return {
    provider: config.get('provider'),
    model: config.get('model'),
    apiKeys: config.get('apiKeys'),
    ollamaHost: config.get('ollamaHost'),
    openrouter: config.get('openrouter'),
    telegram: config.get('telegram'),
  };
}

export function setProvider(provider: ConfigSchema['provider']) {
  config.set('provider', provider);
}

export function setModel(model: string) {
  config.set('model', model);
}

export function setApiKey(provider: keyof ConfigSchema['apiKeys'], key: string) {
  const keys = config.get('apiKeys');
  keys[provider] = key;
  config.set('apiKeys', keys);
}

export function getApiKey(provider: keyof ConfigSchema['apiKeys']): string | undefined {
  return config.get('apiKeys')[provider];
}

export function setTelegramChatId(chatId: number) {
  const telegram = config.get('telegram');
  telegram.chatId = chatId;
  config.set('telegram', telegram);
}

export function setTelegramEnabled(enabled: boolean) {
  const telegram = config.get('telegram');
  telegram.enabled = enabled;
  config.set('telegram', telegram);
}

export { config };
