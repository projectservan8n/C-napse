/**
 * System information utilities
 */

import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SystemInfo {
  platform: string;
  osName: string;
  osVersion: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryGB: number;
  freeMemoryGB: number;
  username: string;
  hostname: string;
  homeDir: string;
  shell: string;
}

let cachedSystemInfo: SystemInfo | null = null;

/**
 * Get detailed system information
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  if (cachedSystemInfo) return cachedSystemInfo;

  const platform = os.platform();
  const cpus = os.cpus();

  let osName: string = platform;
  const osVersion = os.release();

  // Get friendly OS name
  if (platform === 'win32') {
    try {
      const { stdout } = await execAsync('wmic os get Caption /value', { timeout: 5000 });
      const match = stdout.match(/Caption=(.+)/);
      if (match) osName = match[1].trim();
    } catch {
      osName = `Windows ${osVersion}`;
    }
  } else if (platform === 'darwin') {
    try {
      const { stdout } = await execAsync('sw_vers -productName && sw_vers -productVersion', { timeout: 5000 });
      const lines = stdout.trim().split('\n');
      osName = `${lines[0]} ${lines[1]}`;
    } catch {
      osName = `macOS ${osVersion}`;
    }
  } else if (platform === 'linux') {
    try {
      const { stdout } = await execAsync('cat /etc/os-release | grep PRETTY_NAME', { timeout: 5000 });
      const match = stdout.match(/PRETTY_NAME="(.+)"/);
      if (match) osName = match[1];
    } catch {
      osName = `Linux ${osVersion}`;
    }
  }

  cachedSystemInfo = {
    platform,
    osName,
    osVersion,
    arch: os.arch(),
    cpuModel: cpus[0]?.model || 'Unknown CPU',
    cpuCores: cpus.length,
    totalMemoryGB: Math.round(os.totalmem() / (1024 ** 3) * 10) / 10,
    freeMemoryGB: Math.round(os.freemem() / (1024 ** 3) * 10) / 10,
    username: os.userInfo().username,
    hostname: os.hostname(),
    homeDir: os.homedir(),
    shell: process.env.SHELL || process.env.COMSPEC || 'unknown',
  };

  return cachedSystemInfo;
}

/**
 * Get a formatted system context string for AI prompts
 */
export async function getSystemContext(): Promise<string> {
  const info = await getSystemInfo();

  return `SYSTEM INFO:
- OS: ${info.osName} (${info.arch})
- CPU: ${info.cpuModel} (${info.cpuCores} cores)
- RAM: ${info.totalMemoryGB}GB total, ${info.freeMemoryGB}GB free
- User: ${info.username}@${info.hostname}
- Home: ${info.homeDir}
- Shell: ${info.shell}`;
}

/**
 * Get current working directory
 */
export function getCwd(): string {
  return process.cwd();
}
