/**
 * Vision capability - screenshot capture and AI description
 * Supports Ollama VLMs, OpenRouter, Anthropic, OpenAI
 */

import { getConfig, getApiKey } from './config.js';

export interface VisionResponse {
  description: string;
  screenshot: string; // base64
}

/**
 * Capture screenshot and get AI description
 */
export async function describeScreen(): Promise<VisionResponse> {
  const screenshot = await captureScreenshot();
  if (!screenshot) {
    throw new Error('Failed to capture screenshot');
  }

  const config = getConfig();
  const description = await analyzeWithVision(screenshot, config.provider);

  return { description, screenshot };
}

/**
 * Capture screenshot as base64
 */
export async function captureScreenshot(): Promise<string | null> {
  try {
    // Try screenshot-desktop first (more reliable)
    const screenshotDesktop = await import('screenshot-desktop');
    const buffer = await screenshotDesktop.default({ format: 'png' });
    return buffer.toString('base64');
  } catch {
    // Fallback to platform-specific methods
    return captureScreenFallback();
  }
}

async function captureScreenFallback(): Promise<string | null> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  const { readFile, unlink } = await import('fs/promises');

  const execAsync = promisify(exec);
  const tempFile = join(tmpdir(), `cnapse-screen-${Date.now()}.png`);

  try {
    const platform = process.platform;

    if (platform === 'win32') {
      await execAsync(`
        Add-Type -AssemblyName System.Windows.Forms
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
        $bitmap.Save("${tempFile.replace(/\\/g, '\\\\')}")
        $graphics.Dispose()
        $bitmap.Dispose()
      `, { shell: 'powershell.exe' });
    } else if (platform === 'darwin') {
      await execAsync(`screencapture -x "${tempFile}"`);
    } else {
      await execAsync(`gnome-screenshot -f "${tempFile}" 2>/dev/null || scrot "${tempFile}" 2>/dev/null || import -window root "${tempFile}"`);
    }

    const imageBuffer = await readFile(tempFile);
    await unlink(tempFile).catch(() => {});
    return imageBuffer.toString('base64');
  } catch {
    return null;
  }
}

/**
 * Analyze screenshot with vision-capable AI
 */
async function analyzeWithVision(base64Image: string, provider: string): Promise<string> {
  const prompt = `Look at this screenshot and describe:
1. What application or window is visible
2. Key UI elements you can see (buttons, text fields, menus)
3. What the user appears to be doing or could do next
4. Any notable content or state

Be concise but helpful.`;

  switch (provider) {
    case 'ollama':
      return analyzeWithOllama(base64Image, prompt);
    case 'openrouter':
      return analyzeWithOpenRouter(base64Image, prompt);
    case 'anthropic':
      return analyzeWithAnthropic(base64Image, prompt);
    case 'openai':
      return analyzeWithOpenAI(base64Image, prompt);
    default:
      throw new Error(`Vision not supported for provider: ${provider}`);
  }
}

async function analyzeWithOllama(base64Image: string, prompt: string): Promise<string> {
  const config = getConfig();
  const ollamaHost = config.ollamaHost || 'http://localhost:11434';

  // Use a vision-capable model (llava, llama3.2-vision, bakllava)
  const visionModels = ['llava', 'llama3.2-vision', 'bakllava', 'llava-llama3'];
  const model = visionModels.find(m => config.model.includes(m)) || 'llava';

  const response = await fetch(`${ollamaHost}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      images: [base64Image],
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama vision error: ${text}`);
  }

  const data = await response.json() as { response: string };
  return data.response || 'Unable to analyze image';
}

async function analyzeWithOpenRouter(base64Image: string, prompt: string): Promise<string> {
  const apiKey = getApiKey('openrouter');
  if (!apiKey) throw new Error('OpenRouter API key not configured');

  // Use a vision-capable model
  const model = 'anthropic/claude-3-5-sonnet'; // or 'openai/gpt-4-vision-preview'

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://c-napse.up.railway.app',
      'X-Title': 'C-napse',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter vision error: ${text}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content || 'Unable to analyze image';
}

async function analyzeWithAnthropic(base64Image: string, prompt: string): Promise<string> {
  const apiKey = getApiKey('anthropic');
  if (!apiKey) throw new Error('Anthropic API key not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Image,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic vision error: ${text}`);
  }

  const data = await response.json() as { content: Array<{ text: string }> };
  return data.content?.[0]?.text || 'Unable to analyze image';
}

async function analyzeWithOpenAI(base64Image: string, prompt: string): Promise<string> {
  const apiKey = getApiKey('openai');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI vision error: ${text}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices?.[0]?.message?.content || 'Unable to analyze image';
}

/**
 * Find element coordinates on screen by description
 * Returns approximate center coordinates where AI thinks the element is
 */
export async function findElementCoordinates(
  screenshot: string,
  description: string
): Promise<{ x: number; y: number } | null> {
  const config = getConfig();

  const prompt = `Look at this screenshot carefully. Find the UI element described as: "${description}"

Your task is to estimate the CENTER coordinates (x, y) of this element.

IMPORTANT:
- Assume the screen is approximately 1920x1080 pixels (adjust if you see indicators of different resolution)
- Give coordinates as integers
- If the element is clearly visible, give your best estimate
- If you absolutely cannot find it, respond with NOT_FOUND

Respond in EXACTLY this format (numbers only, no units):
X: <number>
Y: <number>

Or if not found:
NOT_FOUND`;

  try {
    const response = await analyzeWithVisionCustom(screenshot, config.provider, prompt);

    // Parse coordinates from response
    const xMatch = response.match(/X:\s*(\d+)/i);
    const yMatch = response.match(/Y:\s*(\d+)/i);

    if (xMatch && yMatch) {
      return {
        x: parseInt(xMatch[1]),
        y: parseInt(yMatch[1]),
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Analyze with vision using a custom prompt (internal helper)
 */
async function analyzeWithVisionCustom(base64Image: string, provider: string, prompt: string): Promise<string> {
  switch (provider) {
    case 'ollama':
      return analyzeWithOllama(base64Image, prompt);
    case 'openrouter':
      return analyzeWithOpenRouter(base64Image, prompt);
    case 'anthropic':
      return analyzeWithAnthropic(base64Image, prompt);
    case 'openai':
      return analyzeWithOpenAI(base64Image, prompt);
    default:
      throw new Error(`Vision not supported for provider: ${provider}`);
  }
}

/**
 * Quick hash for change detection (uses simple sampling)
 */
export function getScreenHash(base64Screenshot: string): string {
  // Sample every 1000th character for quick comparison
  let sample = '';
  for (let i = 0; i < base64Screenshot.length; i += 1000) {
    sample += base64Screenshot[i];
  }

  // Simple hash using character codes
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    const char = sample.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(16);
}

/**
 * Compare two screenshots for significant changes
 */
export function screensChanged(screenshotA: string, screenshotB: string): boolean {
  if (!screenshotA || !screenshotB) return true;
  if (screenshotA.length !== screenshotB.length) return true;

  // Quick hash comparison
  const hashA = getScreenHash(screenshotA);
  const hashB = getScreenHash(screenshotB);

  return hashA !== hashB;
}

/**
 * Analyze a specific region of the screen (for focused analysis)
 */
export async function analyzeScreenRegion(
  screenshot: string,
  region: { x: number; y: number; width: number; height: number },
  question: string
): Promise<string> {
  const config = getConfig();

  const prompt = `Look at this screenshot. Focus on the region approximately at:
- Position: (${region.x}, ${region.y})
- Size: ${region.width}x${region.height} pixels

Question: ${question}

Be specific and concise in your answer.`;

  return analyzeWithVisionCustom(screenshot, config.provider, prompt);
}

/**
 * Get current screen description with caching
 */
let lastDescription: { text: string; timestamp: number } | null = null;
const DESCRIPTION_CACHE_MS = 2000;

export async function getCurrentDescription(): Promise<string> {
  const now = Date.now();

  if (lastDescription && (now - lastDescription.timestamp) < DESCRIPTION_CACHE_MS) {
    return lastDescription.text;
  }

  const result = await describeScreen();
  lastDescription = { text: result.description, timestamp: now };
  return result.description;
}
