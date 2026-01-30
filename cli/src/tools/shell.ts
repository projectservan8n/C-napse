/**
 * Shell command execution tools
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolResult, ok, err } from './index.js';

const execAsync = promisify(exec);

/**
 * Run a shell command
 */
export async function runCommand(cmd: string, timeout = 30000): Promise<ToolResult> {
  try {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/sh';
    const shellArg = isWindows ? '/C' : '-c';

    const { stdout, stderr } = await execAsync(cmd, {
      shell,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    if (stderr && stderr.trim()) {
      return ok(`${stdout}\n[stderr]: ${stderr}`);
    }
    return ok(stdout || '(no output)');
  } catch (error: any) {
    if (error.killed) {
      return err(`Command timed out after ${timeout}ms`);
    }
    const stderr = error.stderr || '';
    const stdout = error.stdout || '';
    return {
      success: false,
      output: stdout,
      error: `Exit code: ${error.code || -1}\n${stderr}`,
    };
  }
}

/**
 * Get environment variable
 */
export function getEnv(varName: string): ToolResult {
  const value = process.env[varName];
  if (value !== undefined) {
    return ok(value);
  }
  return err(`Environment variable not set: ${varName}`);
}

/**
 * Set environment variable (for current process)
 */
export function setEnv(varName: string, value: string): ToolResult {
  process.env[varName] = value;
  return ok(`Set ${varName}=${value}`);
}

/**
 * Get current working directory
 */
export function getCwd(): ToolResult {
  return ok(process.cwd());
}

/**
 * Change current working directory
 */
export function setCwd(path: string): ToolResult {
  try {
    process.chdir(path);
    return ok(`Changed directory to: ${path}`);
  } catch (error: any) {
    return err(`Failed to change directory: ${error.message}`);
  }
}

/**
 * Shell tool definitions for agents
 */
export const shellTools = [
  {
    name: 'run_command',
    description: 'Execute shell command',
    parameters: {
      type: 'object',
      properties: {
        cmd: { type: 'string', description: 'Command to execute' },
        timeout: { type: 'number', description: 'Timeout in ms (default 30000)' },
      },
      required: ['cmd'],
    },
  },
  {
    name: 'get_env',
    description: 'Get environment variable',
    parameters: {
      type: 'object',
      properties: {
        var: { type: 'string', description: 'Variable name' },
      },
      required: ['var'],
    },
  },
  {
    name: 'set_env',
    description: 'Set environment variable',
    parameters: {
      type: 'object',
      properties: {
        var: { type: 'string', description: 'Variable name' },
        value: { type: 'string', description: 'Value to set' },
      },
      required: ['var', 'value'],
    },
  },
  {
    name: 'get_cwd',
    description: 'Get current working directory',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'set_cwd',
    description: 'Change working directory',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path' },
      },
      required: ['path'],
    },
  },
];
