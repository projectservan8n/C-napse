/**
 * Network utilities
 */

import { createServer, Socket } from 'net';
import { networkInterfaces } from 'os';
import { ToolResult, ok, err } from './index.js';

/**
 * Check if a port is in use
 */
export function checkPort(port: number): Promise<ToolResult> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', () => {
      resolve(ok(`Port ${port} is in use`));
    });

    server.once('listening', () => {
      server.close();
      resolve(ok(`Port ${port} is available`));
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find available port in range
 */
export async function findAvailablePort(start: number, end: number): Promise<ToolResult> {
  for (let port = start; port <= end; port++) {
    const result = await checkPort(port);
    if (result.output.includes('available')) {
      return ok(port.toString());
    }
  }
  return err(`No available ports in range ${start}-${end}`);
}

/**
 * Check if a host:port is reachable
 */
export function checkConnection(
  host: string,
  port: number,
  timeoutMs = 5000
): Promise<ToolResult> {
  return new Promise((resolve) => {
    const socket = new Socket();
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
      }
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      cleanup();
      resolve(ok(`Connection to ${host}:${port} successful`));
    });

    socket.on('timeout', () => {
      cleanup();
      resolve(err(`Connection to ${host}:${port} timed out`));
    });

    socket.on('error', (error: any) => {
      cleanup();
      resolve(err(`Connection to ${host}:${port} failed: ${error.message}`));
    });

    socket.connect(port, host);
  });
}

/**
 * Get local IP addresses
 */
export function getLocalIp(): ToolResult {
  const interfaces = networkInterfaces();
  const addresses: string[] = [];

  for (const [name, nets] of Object.entries(interfaces)) {
    if (!nets) continue;
    for (const net of nets) {
      if (!net.internal && net.family === 'IPv4') {
        addresses.push(`${name}: ${net.address}`);
      }
    }
  }

  if (addresses.length === 0) {
    return err('No external IP addresses found');
  }
  return ok(addresses.join('\n'));
}

/**
 * List all network interfaces
 */
export function listInterfaces(): ToolResult {
  const interfaces = networkInterfaces();
  const info: string[] = [];

  for (const [name, nets] of Object.entries(interfaces)) {
    if (!nets) continue;
    for (const net of nets) {
      info.push(`${name}: ${net.address} (${net.family}${net.internal ? ', internal' : ''})`);
    }
  }

  return ok(info.join('\n'));
}

/**
 * Fetch URL content
 */
export async function fetchUrl(url: string): Promise<ToolResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }
    const text = await response.text();
    return ok(text);
  } catch (error: any) {
    return err(`Failed to fetch: ${error.message}`);
  }
}

/**
 * Network tool definitions for agents
 */
export const networkTools = [
  {
    name: 'check_port',
    description: 'Check if a port is in use',
    parameters: {
      type: 'object',
      properties: {
        port: { type: 'number', description: 'Port number' },
      },
      required: ['port'],
    },
  },
  {
    name: 'find_available_port',
    description: 'Find available port in range',
    parameters: {
      type: 'object',
      properties: {
        start: { type: 'number', description: 'Start port' },
        end: { type: 'number', description: 'End port' },
      },
      required: ['start', 'end'],
    },
  },
  {
    name: 'check_connection',
    description: 'Check if host:port is reachable',
    parameters: {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'Hostname' },
        port: { type: 'number', description: 'Port number' },
        timeout: { type: 'number', description: 'Timeout in ms' },
      },
      required: ['host', 'port'],
    },
  },
  {
    name: 'get_local_ip',
    description: 'Get local IP addresses',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_interfaces',
    description: 'List network interfaces',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'fetch_url',
    description: 'Fetch content from URL',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  },
];
