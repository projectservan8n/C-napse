/**
 * Process management tools
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { platform, cpus, totalmem, freemem, hostname, version } from 'os';
import { ToolResult, ok, err } from './index.js';

const execAsync = promisify(exec);

/**
 * List running processes
 */
export async function listProcesses(): Promise<ToolResult> {
  try {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      const { stdout } = await execAsync(
        'tasklist /FO CSV /NH',
        { maxBuffer: 10 * 1024 * 1024 }
      );

      const lines = stdout.trim().split('\n').slice(0, 50);
      const header = 'Name\tPID\tMemory';
      const processes = lines.map(line => {
        const parts = line.split('","').map(p => p.replace(/"/g, ''));
        return `${parts[0]}\t${parts[1]}\t${parts[4]}`;
      });

      return ok(`${header}\n${processes.join('\n')}`);
    } else {
      const { stdout } = await execAsync(
        'ps aux --sort=-%mem | head -50',
        { maxBuffer: 10 * 1024 * 1024 }
      );
      return ok(stdout);
    }
  } catch (error: any) {
    return err(`Failed to list processes: ${error.message}`);
  }
}

/**
 * Get information about a specific process
 */
export async function processInfo(pid: number): Promise<ToolResult> {
  try {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      const { stdout } = await execAsync(
        `tasklist /FI "PID eq ${pid}" /FO LIST`
      );
      return ok(stdout || `No process found with PID ${pid}`);
    } else {
      const { stdout } = await execAsync(
        `ps -p ${pid} -o pid,ppid,user,%cpu,%mem,stat,start,command`
      );
      return ok(stdout || `No process found with PID ${pid}`);
    }
  } catch (error: any) {
    return err(`Failed to get process info: ${error.message}`);
  }
}

/**
 * Kill a process
 */
export async function killProcess(pid: number, force = false): Promise<ToolResult> {
  try {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      const flag = force ? '/F' : '';
      await execAsync(`taskkill /PID ${pid} ${flag}`);
    } else {
      const signal = force ? '-9' : '-15';
      await execAsync(`kill ${signal} ${pid}`);
    }

    return ok(`Killed process: ${pid}`);
  } catch (error: any) {
    return err(`Failed to kill process: ${error.message}`);
  }
}

/**
 * Find processes by name
 */
export async function findProcess(name: string): Promise<ToolResult> {
  try {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      const { stdout } = await execAsync(
        `tasklist /FI "IMAGENAME eq *${name}*" /FO CSV /NH`
      );
      if (!stdout.trim() || stdout.includes('No tasks')) {
        return err(`No processes found matching: ${name}`);
      }
      return ok(stdout);
    } else {
      const { stdout } = await execAsync(
        `pgrep -l -i "${name}" || echo "No processes found"`
      );
      if (stdout.includes('No processes')) {
        return err(`No processes found matching: ${name}`);
      }
      return ok(stdout);
    }
  } catch (error: any) {
    return err(`No processes found matching: ${name}`);
  }
}

/**
 * Get system information
 */
export function systemInfo(): ToolResult {
  const totalMemGB = (totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const freeMemGB = (freemem() / 1024 / 1024 / 1024).toFixed(1);
  const usedMemGB = ((totalmem() - freemem()) / 1024 / 1024 / 1024).toFixed(1);

  const info = [
    `OS: ${platform()} ${version()}`,
    `Hostname: ${hostname()}`,
    `CPUs: ${cpus().length}`,
    `CPU Model: ${cpus()[0]?.model || 'Unknown'}`,
    `Total Memory: ${totalMemGB} GB`,
    `Used Memory: ${usedMemGB} GB`,
    `Free Memory: ${freeMemGB} GB`,
    `Node Version: ${process.version}`,
  ].join('\n');

  return ok(info);
}

/**
 * Process management tool definitions for agents
 */
export const processTools = [
  {
    name: 'list_processes',
    description: 'List running processes',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'process_info',
    description: 'Get info about specific process',
    parameters: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Process ID' },
      },
      required: ['pid'],
    },
  },
  {
    name: 'kill_process',
    description: 'Kill a process',
    parameters: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Process ID' },
        force: { type: 'boolean', description: 'Force kill' },
      },
      required: ['pid'],
    },
  },
  {
    name: 'find_process',
    description: 'Find processes by name',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Process name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'system_info',
    description: 'Get system information',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];
