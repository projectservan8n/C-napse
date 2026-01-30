/**
 * File system tools
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { ToolResult, ok, err } from './index.js';

/**
 * Read file contents
 */
export async function readFile(path: string): Promise<ToolResult> {
  try {
    const content = await fs.readFile(path, 'utf-8');
    return ok(content);
  } catch (error: any) {
    return err(`Failed to read file: ${error.message}`);
  }
}

/**
 * Write file contents
 */
export async function writeFile(path: string, content: string): Promise<ToolResult> {
  try {
    // Create parent directories if needed
    const dir = dirname(path);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(path, content, 'utf-8');
    return ok(`Written ${content.length} bytes to ${path}`);
  } catch (error: any) {
    return err(`Failed to write file: ${error.message}`);
  }
}

/**
 * List directory contents
 */
export async function listDir(path: string, recursive = false): Promise<ToolResult> {
  try {
    const stat = await fs.stat(path);
    if (!stat.isDirectory()) {
      return err(`Not a directory: ${path}`);
    }

    const entries: string[] = [];

    async function walkDir(dir: string, prefix: string): Promise<void> {
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const displayPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.isDirectory()) {
          entries.push(`${displayPath}/`);
          if (recursive) {
            await walkDir(join(dir, item.name), displayPath);
          }
        } else {
          entries.push(displayPath);
        }
      }
    }

    await walkDir(path, '');
    entries.sort();
    return ok(entries.join('\n'));
  } catch (error: any) {
    return err(`Failed to list directory: ${error.message}`);
  }
}

/**
 * Copy file
 */
export async function copyFile(src: string, dst: string): Promise<ToolResult> {
  try {
    const srcStat = await fs.stat(src);
    if (!srcStat.isFile()) {
      return err('Source is not a file');
    }

    // Create parent directories
    const dir = dirname(dst);
    await fs.mkdir(dir, { recursive: true });

    await fs.copyFile(src, dst);
    return ok(`Copied ${src} to ${dst}`);
  } catch (error: any) {
    return err(`Failed to copy: ${error.message}`);
  }
}

/**
 * Move/rename file or directory
 */
export async function movePath(src: string, dst: string): Promise<ToolResult> {
  try {
    await fs.rename(src, dst);
    return ok(`Moved ${src} to ${dst}`);
  } catch (error: any) {
    return err(`Failed to move: ${error.message}`);
  }
}

/**
 * Delete file or directory
 */
export async function deletePath(path: string, force = false): Promise<ToolResult> {
  try {
    const stat = await fs.stat(path);

    if (stat.isDirectory()) {
      if (force) {
        await fs.rm(path, { recursive: true, force: true });
        return ok(`Deleted directory: ${path}`);
      } else {
        return err('Use force=true to delete directories');
      }
    } else {
      await fs.unlink(path);
      return ok(`Deleted file: ${path}`);
    }
  } catch (error: any) {
    return err(`Failed to delete: ${error.message}`);
  }
}

/**
 * Get file metadata
 */
export async function fileInfo(path: string): Promise<ToolResult> {
  try {
    const stat = await fs.stat(path);

    const fileType = stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other';
    const modified = stat.mtime.toISOString();

    return ok(
      `Type: ${fileType}\n` +
      `Size: ${stat.size} bytes\n` +
      `Modified: ${modified}\n` +
      `Read-only: ${!(stat.mode & 0o200)}`
    );
  } catch (error: any) {
    return err(`Failed to get file info: ${error.message}`);
  }
}

/**
 * Search for files by pattern
 */
export async function findFiles(
  directory: string,
  pattern: string,
  maxResults = 100
): Promise<ToolResult> {
  try {
    const { globby } = await import('globby');
    const results = await globby(pattern, {
      cwd: directory,
      gitignore: true,
    });

    const limited = results.slice(0, maxResults);
    if (results.length > maxResults) {
      return ok(limited.join('\n') + `\n... and ${results.length - maxResults} more`);
    }
    return ok(limited.join('\n') || '(no matches)');
  } catch (error: any) {
    return err(`Failed to search: ${error.message}`);
  }
}

/**
 * File system tool definitions for agents
 */
export const filesystemTools = [
  {
    name: 'read_file',
    description: 'Read file contents',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_dir',
    description: 'List directory contents',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path' },
        recursive: { type: 'boolean', description: 'Include subdirectories' },
      },
      required: ['path'],
    },
  },
  {
    name: 'copy_file',
    description: 'Copy file',
    parameters: {
      type: 'object',
      properties: {
        src: { type: 'string', description: 'Source path' },
        dst: { type: 'string', description: 'Destination path' },
      },
      required: ['src', 'dst'],
    },
  },
  {
    name: 'move_path',
    description: 'Move or rename file/directory',
    parameters: {
      type: 'object',
      properties: {
        src: { type: 'string', description: 'Source path' },
        dst: { type: 'string', description: 'Destination path' },
      },
      required: ['src', 'dst'],
    },
  },
  {
    name: 'delete_path',
    description: 'Delete file or directory',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to delete' },
        force: { type: 'boolean', description: 'Force delete directories' },
      },
      required: ['path'],
    },
  },
  {
    name: 'file_info',
    description: 'Get file metadata',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'find_files',
    description: 'Search for files by glob pattern',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Search directory' },
        pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts")' },
      },
      required: ['directory', 'pattern'],
    },
  },
];
