/**
 * Tool implementations for C-napse agents
 */

export * from './shell.js';
export * from './filesystem.js';
export * from './clipboard.js';
export * from './network.js';
export * from './process.js';

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export function ok(output: string): ToolResult {
  return { success: true, output };
}

export function err(error: string): ToolResult {
  return { success: false, output: '', error };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}
