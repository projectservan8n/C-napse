/**
 * Tool Executor - Executes tool calls from agents
 */

import type { ToolCall } from './types.js';
import type { ToolResult } from '../tools/index.js';

// Import all tools
import * as shell from '../tools/shell.js';
import * as filesystem from '../tools/filesystem.js';
import * as clipboard from '../tools/clipboard.js';
import * as network from '../tools/network.js';
import * as processTools from '../tools/process.js';

/**
 * Execute a tool call and return the result
 */
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const { name, arguments: args } = call;

  try {
    switch (name) {
      // Shell tools
      case 'run_command':
        return await shell.runCommand(
          args.cmd as string,
          args.timeout as number | undefined
        );
      case 'get_env':
        return shell.getEnv(args.var as string);
      case 'set_env':
        return shell.setEnv(args.var as string, args.value as string);
      case 'get_cwd':
        return shell.getCwd();
      case 'set_cwd':
        return shell.setCwd(args.path as string);

      // Filesystem tools
      case 'read_file':
        return await filesystem.readFile(args.path as string);
      case 'write_file':
        return await filesystem.writeFile(args.path as string, args.content as string);
      case 'list_dir':
        return await filesystem.listDir(args.path as string, args.recursive as boolean);
      case 'copy_file':
        return await filesystem.copyFile(args.src as string, args.dst as string);
      case 'move_path':
        return await filesystem.movePath(args.src as string, args.dst as string);
      case 'delete_path':
        return await filesystem.deletePath(args.path as string, args.force as boolean);
      case 'file_info':
        return await filesystem.fileInfo(args.path as string);
      case 'find_files':
        return await filesystem.findFiles(
          args.directory as string,
          args.pattern as string,
          args.maxResults as number | undefined
        );

      // Clipboard tools
      case 'get_clipboard':
        return await clipboard.getClipboard();
      case 'set_clipboard':
        return await clipboard.setClipboard(args.text as string);

      // Network tools
      case 'check_port':
        return await network.checkPort(args.port as number);
      case 'find_available_port':
        return await network.findAvailablePort(args.start as number, args.end as number);
      case 'check_connection':
        return await network.checkConnection(
          args.host as string,
          args.port as number,
          args.timeout as number | undefined
        );
      case 'get_local_ip':
        return network.getLocalIp();
      case 'list_interfaces':
        return network.listInterfaces();
      case 'fetch_url':
        return await network.fetchUrl(args.url as string);

      // Process tools
      case 'list_processes':
        return await processTools.listProcesses();
      case 'process_info':
        return await processTools.processInfo(args.pid as number);
      case 'kill_process':
        return await processTools.killProcess(args.pid as number, args.force as boolean);
      case 'find_process':
        return await processTools.findProcess(args.name as string);
      case 'system_info':
        return processTools.systemInfo();

      default:
        return { success: false, output: '', error: `Unknown tool: ${name}` };
    }
  } catch (error: any) {
    return { success: false, output: '', error: `Tool error: ${error.message}` };
  }
}

/**
 * Execute multiple tool calls
 */
export async function executeTools(calls: ToolCall[]): Promise<Map<string, ToolResult>> {
  const results = new Map<string, ToolResult>();

  for (const call of calls) {
    const result = await executeTool(call);
    results.set(call.id, result);
  }

  return results;
}

/**
 * Format tool results for display
 */
export function formatToolResult(call: ToolCall, result: ToolResult): string {
  const status = result.success ? '✓' : '✗';
  const header = `[${status} ${call.name}]`;

  if (result.success) {
    return `${header}\n${result.output}`;
  } else {
    return `${header}\nError: ${result.error}`;
  }
}
