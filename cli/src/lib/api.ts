import { getConfig, getApiKey } from './config.js';
import { getSystemContext, getCwd } from './system.js';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  model: string;
}

const BASE_PROMPT = `You are C-napse, an AI assistant for PC automation running on the user's desktop.
You have access to their system and can help with coding, file management, shell commands, and more.

When responding:
- Be direct and practical
- Use markdown formatting for code blocks
- If asked to do something, explain what you'll do first
- Give commands specific to the user's OS (use the system info below)
- Be aware of the user's current working directory`;

// Cache system context to avoid repeated calls
let systemContextCache: string | null = null;

async function getSystemPrompt(): Promise<string> {
  if (!systemContextCache) {
    systemContextCache = await getSystemContext();
  }
  const cwd = getCwd();
  return `${BASE_PROMPT}

${systemContextCache}
- Current directory: ${cwd}`;
}

export async function chat(messages: Message[], systemPrompt?: string): Promise<ChatResponse> {
  const config = getConfig();
  const finalPrompt = systemPrompt || await getSystemPrompt();

  const allMessages: Message[] = [
    { role: 'system', content: finalPrompt },
    ...messages,
  ];

  switch (config.provider) {
    case 'openrouter':
      return chatOpenRouter(allMessages, config.model);
    case 'ollama':
      return chatOllama(allMessages, config.model);
    case 'anthropic':
      return chatAnthropic(allMessages, config.model);
    case 'openai':
      return chatOpenAI(allMessages, config.model);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

async function chatOpenRouter(messages: Message[], model: string): Promise<ChatResponse> {
  const apiKey = getApiKey('openrouter');
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured. Run: cnapse auth openrouter <key>');
  }

  const config = getConfig();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': config.openrouter.siteUrl,
      'X-Title': config.openrouter.appName,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${error}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content || '';

  return { content, model };
}

async function chatOllama(messages: Message[], model: string): Promise<ChatResponse> {
  const config = getConfig();

  const response = await fetch(`${config.ollamaHost}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama error: ${response.status} - ${error}`);
  }

  const data = await response.json() as any;
  const content = data.message?.content || '';

  return { content, model };
}

async function chatAnthropic(messages: Message[], model: string): Promise<ChatResponse> {
  const apiKey = getApiKey('anthropic');
  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Run: cnapse auth anthropic <key>');
  }

  // Extract system message
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemMsg?.content || '',
      messages: chatMessages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic error: ${response.status} - ${error}`);
  }

  const data = await response.json() as any;
  const content = data.content?.[0]?.text || '';

  return { content, model };
}

async function chatOpenAI(messages: Message[], model: string): Promise<ChatResponse> {
  const apiKey = getApiKey('openai');
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Run: cnapse auth openai <key>');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${response.status} - ${error}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content || '';

  return { content, model };
}

export async function testConnection(): Promise<boolean> {
  try {
    await chat([{ role: 'user', content: 'hi' }]);
    return true;
  } catch {
    return false;
  }
}
