/**
 * Ollama utilities - Check status, list models, pull/run models
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface OllamaModel {
  name: string;
  size: string;
  modified: string;
}

export interface OllamaStatus {
  installed: boolean;
  running: boolean;
  models: OllamaModel[];
  error?: string;
}

/**
 * Check if Ollama is installed and running, list available models
 */
export async function checkOllamaStatus(): Promise<OllamaStatus> {
  try {
    // Try to list models - this checks both installation and if it's running
    const { stdout } = await execAsync('ollama list', { timeout: 10000 });

    // Parse the output
    const lines = stdout.trim().split('\n');
    const models: OllamaModel[] = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line?.trim()) continue;

      // Parse: NAME    ID    SIZE    MODIFIED
      const parts = line.split(/\s{2,}/);
      if (parts.length >= 3) {
        models.push({
          name: parts[0]?.trim() || '',
          size: parts[2]?.trim() || '',
          modified: parts[3]?.trim() || '',
        });
      }
    }

    return {
      installed: true,
      running: true,
      models,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';

    // Check if Ollama is installed but not running
    if (errorMsg.includes('connect') || errorMsg.includes('refused')) {
      return {
        installed: true,
        running: false,
        models: [],
        error: 'Ollama is not running. Start it with: ollama serve',
      };
    }

    // Ollama not installed
    if (errorMsg.includes('not found') || errorMsg.includes('not recognized')) {
      return {
        installed: false,
        running: false,
        models: [],
        error: 'Ollama not installed. Get it at: https://ollama.ai',
      };
    }

    return {
      installed: false,
      running: false,
      models: [],
      error: errorMsg,
    };
  }
}

/**
 * Check if a specific model is available
 */
export function hasModel(status: OllamaStatus, modelId: string): boolean {
  const modelName = modelId.split(':')[0]?.toLowerCase() || '';
  return status.models.some(m => m.name.toLowerCase().startsWith(modelName));
}

/**
 * Pull a model (download it)
 */
export async function pullModel(modelId: string, onProgress?: (msg: string) => void): Promise<boolean> {
  try {
    onProgress?.(`Downloading ${modelId}...`);

    // Pull with a long timeout (models can be large)
    await execAsync(`ollama pull ${modelId}`, { timeout: 600000 }); // 10 min

    onProgress?.(`Downloaded ${modelId}`);
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    onProgress?.(`Failed to download: ${errorMsg}`);
    return false;
  }
}

/**
 * Run a model to load it into memory
 */
export async function runModel(modelId: string): Promise<boolean> {
  try {
    // Send a simple prompt to load the model
    await execAsync(`ollama run ${modelId} "Hi" --nowordwrap`, { timeout: 120000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get model size in human-readable format
 */
export function getModelInfo(status: OllamaStatus, modelId: string): { available: boolean; size?: string } {
  const modelName = modelId.split(':')[0]?.toLowerCase() || '';
  const model = status.models.find(m => m.name.toLowerCase().startsWith(modelName));

  if (model) {
    return { available: true, size: model.size };
  }

  return { available: false };
}
