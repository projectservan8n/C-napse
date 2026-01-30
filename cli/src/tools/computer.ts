/**
 * Computer Control Tools - Mouse, keyboard, and window automation
 * Uses native platform APIs via shell commands
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolResult, ok, err } from './index.js';

const execAsync = promisify(exec);

/**
 * Move mouse to coordinates
 */
export async function moveMouse(x: number, y: number): Promise<ToolResult> {
  try {
    if (process.platform === 'win32') {
      await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})"`, { shell: 'cmd.exe' });
    } else if (process.platform === 'darwin') {
      // macOS - use cliclick if available
      await execAsync(`cliclick m:${x},${y}`);
    } else {
      // Linux - use xdotool
      await execAsync(`xdotool mousemove ${x} ${y}`);
    }
    return ok(`Mouse moved to (${x}, ${y})`);
  } catch (error) {
    return err(`Failed to move mouse: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Click mouse button
 */
export async function clickMouse(button: 'left' | 'right' | 'middle' = 'left'): Promise<ToolResult> {
  try {
    if (process.platform === 'win32') {
      const script = `
Add-Type -MemberDefinition @"
[DllImport("user32.dll",CharSet=CharSet.Auto,CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
"@ -Name Mouse -Namespace Win32
${button === 'left' ? '[Win32.Mouse]::mouse_event(0x02, 0, 0, 0, 0); [Win32.Mouse]::mouse_event(0x04, 0, 0, 0, 0)' :
  button === 'right' ? '[Win32.Mouse]::mouse_event(0x08, 0, 0, 0, 0); [Win32.Mouse]::mouse_event(0x10, 0, 0, 0, 0)' :
  '[Win32.Mouse]::mouse_event(0x20, 0, 0, 0, 0); [Win32.Mouse]::mouse_event(0x40, 0, 0, 0, 0)'}`;
      await execAsync(`powershell -Command "${script.replace(/\n/g, ' ')}"`, { shell: 'cmd.exe' });
    } else if (process.platform === 'darwin') {
      await execAsync(`cliclick c:.`);
    } else {
      const btn = button === 'left' ? '1' : button === 'right' ? '3' : '2';
      await execAsync(`xdotool click ${btn}`);
    }
    return ok(`Clicked ${button} button`);
  } catch (error) {
    return err(`Failed to click: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Double click
 */
export async function doubleClick(): Promise<ToolResult> {
  try {
    if (process.platform === 'win32') {
      const script = `
Add-Type -MemberDefinition @"
[DllImport("user32.dll",CharSet=CharSet.Auto,CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
"@ -Name Mouse -Namespace Win32
[Win32.Mouse]::mouse_event(0x02, 0, 0, 0, 0); [Win32.Mouse]::mouse_event(0x04, 0, 0, 0, 0)
Start-Sleep -Milliseconds 50
[Win32.Mouse]::mouse_event(0x02, 0, 0, 0, 0); [Win32.Mouse]::mouse_event(0x04, 0, 0, 0, 0)`;
      await execAsync(`powershell -Command "${script.replace(/\n/g, ' ')}"`, { shell: 'cmd.exe' });
    } else if (process.platform === 'darwin') {
      await execAsync(`cliclick dc:.`);
    } else {
      await execAsync(`xdotool click --repeat 2 --delay 50 1`);
    }
    return ok('Double clicked');
  } catch (error) {
    return err(`Failed to double click: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Type text
 */
export async function typeText(text: string): Promise<ToolResult> {
  try {
    if (process.platform === 'win32') {
      // Use PowerShell SendKeys
      const escapedText = text.replace(/'/g, "''").replace(/[+^%~(){}[\]]/g, '{$&}');
      await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escapedText}')"`, { shell: 'cmd.exe' });
    } else if (process.platform === 'darwin') {
      const escaped = text.replace(/'/g, "'\\''");
      await execAsync(`osascript -e 'tell application "System Events" to keystroke "${escaped}"'`);
    } else {
      const escaped = text.replace(/'/g, "'\\''");
      await execAsync(`xdotool type '${escaped}'`);
    }
    return ok(`Typed: ${text}`);
  } catch (error) {
    return err(`Failed to type: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Press a key
 */
export async function pressKey(key: string): Promise<ToolResult> {
  try {
    if (process.platform === 'win32') {
      // Windows SendKeys format
      const winKeyMap: Record<string, string> = {
        'enter': '{ENTER}', 'return': '{ENTER}',
        'escape': '{ESC}', 'esc': '{ESC}',
        'tab': '{TAB}',
        'space': ' ',
        'backspace': '{BACKSPACE}',
        'delete': '{DELETE}',
        'up': '{UP}',
        'down': '{DOWN}',
        'left': '{LEFT}',
        'right': '{RIGHT}',
        'home': '{HOME}',
        'end': '{END}',
        'pageup': '{PGUP}',
        'pagedown': '{PGDN}',
        'f1': '{F1}', 'f2': '{F2}', 'f3': '{F3}', 'f4': '{F4}',
        'f5': '{F5}', 'f6': '{F6}', 'f7': '{F7}', 'f8': '{F8}',
        'f9': '{F9}', 'f10': '{F10}', 'f11': '{F11}', 'f12': '{F12}',
      };
      const winKey = winKeyMap[key.toLowerCase()] || key;
      await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${winKey}')"`, { shell: 'cmd.exe' });
    } else if (process.platform === 'darwin') {
      const macKeyMap: Record<string, number> = {
        'return': 36, 'enter': 36, 'escape': 53, 'esc': 53,
        'tab': 48, 'space': 49, 'backspace': 51, 'delete': 117,
        'up': 126, 'down': 125, 'left': 123, 'right': 124,
      };
      const keyCode = macKeyMap[key.toLowerCase()];
      if (keyCode) {
        await execAsync(`osascript -e 'tell application "System Events" to key code ${keyCode}'`);
      } else {
        await execAsync(`osascript -e 'tell application "System Events" to keystroke "${key}"'`);
      }
    } else {
      await execAsync(`xdotool key ${key}`);
    }
    return ok(`Pressed: ${key}`);
  } catch (error) {
    return err(`Failed to press key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Press key combination
 */
export async function keyCombo(keys: string[]): Promise<ToolResult> {
  try {
    if (process.platform === 'win32') {
      // Handle Win+R specially for opening Run dialog
      const hasWin = keys.some(k => k.toLowerCase() === 'meta' || k.toLowerCase() === 'win');
      const hasR = keys.some(k => k.toLowerCase() === 'r');

      if (hasWin && hasR) {
        // Use PowerShell to open Run dialog
        await execAsync(`powershell -Command "$shell = New-Object -ComObject WScript.Shell; $shell.Run('explorer shell:::{2559a1f3-21d7-11d4-bdaf-00c04f60b9f0}')"`, { shell: 'cmd.exe' });
        return ok(`Pressed: ${keys.join('+')}`);
      }

      // Build SendKeys combo
      const modifierMap: Record<string, string> = {
        'control': '^', 'ctrl': '^',
        'alt': '%',
        'shift': '+',
      };

      let combo = '';
      const regularKeys: string[] = [];

      for (const key of keys) {
        const lower = key.toLowerCase();
        if (modifierMap[lower]) {
          combo += modifierMap[lower];
        } else if (lower !== 'meta' && lower !== 'win') {
          regularKeys.push(key.toLowerCase());
        }
      }

      combo += regularKeys.join('');
      await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${combo}')"`, { shell: 'cmd.exe' });
    } else if (process.platform === 'darwin') {
      const modifiers = keys.filter(k => ['control', 'ctrl', 'alt', 'shift', 'command', 'meta'].includes(k.toLowerCase()));
      const regular = keys.filter(k => !['control', 'ctrl', 'alt', 'shift', 'command', 'meta'].includes(k.toLowerCase()));

      let cmd = 'tell application "System Events" to keystroke "' + regular.join('') + '"';
      if (modifiers.length > 0) {
        const modMap: Record<string, string> = {
          'control': 'control down', 'ctrl': 'control down',
          'alt': 'option down', 'shift': 'shift down',
          'command': 'command down', 'meta': 'command down',
        };
        cmd += ' using {' + modifiers.map(m => modMap[m.toLowerCase()]).join(', ') + '}';
      }
      await execAsync(`osascript -e '${cmd}'`);
    } else {
      await execAsync(`xdotool key ${keys.join('+')}`);
    }
    return ok(`Pressed: ${keys.join('+')}`);
  } catch (error) {
    return err(`Failed to press combo: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get active window info
 */
export async function getActiveWindow(): Promise<ToolResult> {
  try {
    if (process.platform === 'win32') {
      const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@
$hwnd = [Win32]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[Win32]::GetWindowText($hwnd, $sb, 256)
$sb.ToString()`;
      const { stdout } = await execAsync(`powershell -Command "${script.replace(/\n/g, ' ')}"`, { shell: 'cmd.exe' });
      return ok(stdout.trim() || 'Unknown window');
    } else if (process.platform === 'darwin') {
      const { stdout } = await execAsync(`osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`);
      return ok(stdout.trim());
    } else {
      const { stdout } = await execAsync(`xdotool getactivewindow getwindowname`);
      return ok(stdout.trim());
    }
  } catch (error) {
    return err(`Failed to get active window: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * List all windows
 */
export async function listWindows(): Promise<ToolResult> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(`powershell -Command "Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object ProcessName, MainWindowTitle | Format-Table -AutoSize"`, { shell: 'cmd.exe' });
      return ok(stdout);
    } else if (process.platform === 'darwin') {
      const { stdout } = await execAsync(`osascript -e 'tell application "System Events" to get name of every application process whose visible is true'`);
      return ok(stdout);
    } else {
      const { stdout } = await execAsync(`wmctrl -l`);
      return ok(stdout);
    }
  } catch (error) {
    return err(`Failed to list windows: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Focus a window by title
 */
export async function focusWindow(title: string): Promise<ToolResult> {
  try {
    if (process.platform === 'win32') {
      const escaped = title.replace(/'/g, "''");
      await execAsync(`powershell -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.AppActivate('${escaped}')"`, { shell: 'cmd.exe' });
    } else if (process.platform === 'darwin') {
      await execAsync(`osascript -e 'tell application "${title}" to activate'`);
    } else {
      await execAsync(`wmctrl -a "${title}"`);
    }
    return ok(`Focused window: ${title}`);
  } catch (error) {
    return err(`Failed to focus window: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Scroll mouse wheel
 */
export async function scrollMouse(amount: number): Promise<ToolResult> {
  try {
    if (process.platform === 'win32') {
      const direction = amount > 0 ? 120 * Math.abs(amount) : -120 * Math.abs(amount);
      const script = `
Add-Type -MemberDefinition @"
[DllImport("user32.dll",CharSet=CharSet.Auto,CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
"@ -Name Mouse -Namespace Win32
[Win32.Mouse]::mouse_event(0x0800, 0, 0, ${direction}, 0)`;
      await execAsync(`powershell -Command "${script.replace(/\n/g, ' ')}"`, { shell: 'cmd.exe' });
    } else if (process.platform === 'darwin') {
      const dir = amount > 0 ? 'u' : 'd';
      await execAsync(`cliclick -r ${dir}:${Math.abs(amount)}`);
    } else {
      const btn = amount > 0 ? '4' : '5';
      await execAsync(`xdotool click --repeat ${Math.abs(amount)} ${btn}`);
    }
    return ok(`Scrolled ${amount > 0 ? 'up' : 'down'} by ${Math.abs(amount)}`);
  } catch (error) {
    return err(`Failed to scroll: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Drag mouse from one point to another
 */
export async function dragMouse(startX: number, startY: number, endX: number, endY: number): Promise<ToolResult> {
  try {
    await moveMouse(startX, startY);
    await new Promise(r => setTimeout(r, 100));

    if (process.platform === 'win32') {
      // Mouse down
      await execAsync(`powershell -Command "Add-Type -MemberDefinition @'
[DllImport(\\"user32.dll\\",CharSet=CharSet.Auto,CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
'@ -Name Mouse -Namespace Win32; [Win32.Mouse]::mouse_event(0x02, 0, 0, 0, 0)"`, { shell: 'cmd.exe' });

      await moveMouse(endX, endY);
      await new Promise(r => setTimeout(r, 100));

      // Mouse up
      await execAsync(`powershell -Command "Add-Type -MemberDefinition @'
[DllImport(\\"user32.dll\\",CharSet=CharSet.Auto,CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
'@ -Name Mouse -Namespace Win32; [Win32.Mouse]::mouse_event(0x04, 0, 0, 0, 0)"`, { shell: 'cmd.exe' });
    } else if (process.platform === 'darwin') {
      await execAsync(`cliclick dd:${startX},${startY} du:${endX},${endY}`);
    } else {
      await execAsync(`xdotool mousemove ${startX} ${startY} mousedown 1 mousemove ${endX} ${endY} mouseup 1`);
    }
    return ok(`Dragged from (${startX},${startY}) to (${endX},${endY})`);
  } catch (error) {
    return err(`Failed to drag: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get mouse position
 */
export async function getMousePosition(): Promise<ToolResult> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $p = [System.Windows.Forms.Cursor]::Position; Write-Output \\"$($p.X),$($p.Y)\\""`, { shell: 'cmd.exe' });
      return ok(`Mouse position: ${stdout.trim()}`);
    } else if (process.platform === 'darwin') {
      const { stdout } = await execAsync(`cliclick p`);
      return ok(`Mouse position: ${stdout.trim()}`);
    } else {
      const { stdout } = await execAsync(`xdotool getmouselocation --shell`);
      return ok(stdout);
    }
  } catch (error) {
    return err(`Failed to get mouse position: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all computer control tools
 */
export function getComputerTools() {
  return {
    moveMouse,
    clickMouse,
    doubleClick,
    typeText,
    pressKey,
    keyCombo,
    getActiveWindow,
    listWindows,
    focusWindow,
    scrollMouse,
    dragMouse,
    getMousePosition,
  };
}

// Tool definitions for executor
export const computerTools = [
  {
    name: 'moveMouse',
    description: 'Move mouse to screen coordinates',
    parameters: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
  },
  {
    name: 'clickMouse',
    description: 'Click mouse button',
    parameters: { type: 'object', properties: { button: { type: 'string', enum: ['left', 'right', 'middle'] } } },
  },
  {
    name: 'doubleClick',
    description: 'Double click at current position',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'typeText',
    description: 'Type text using keyboard',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'pressKey',
    description: 'Press a single key',
    parameters: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
  },
  {
    name: 'keyCombo',
    description: 'Press key combination',
    parameters: { type: 'object', properties: { keys: { type: 'array', items: { type: 'string' } } }, required: ['keys'] },
  },
  {
    name: 'getActiveWindow',
    description: 'Get active window info',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'listWindows',
    description: 'List all open windows',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'focusWindow',
    description: 'Focus a window by title',
    parameters: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
  },
  {
    name: 'scrollMouse',
    description: 'Scroll mouse wheel (positive=up, negative=down)',
    parameters: { type: 'object', properties: { amount: { type: 'number' } }, required: ['amount'] },
  },
  {
    name: 'dragMouse',
    description: 'Drag mouse from one point to another',
    parameters: { type: 'object', properties: { startX: { type: 'number' }, startY: { type: 'number' }, endX: { type: 'number' }, endY: { type: 'number' } }, required: ['startX', 'startY', 'endX', 'endY'] },
  },
  {
    name: 'getMousePosition',
    description: 'Get current mouse position',
    parameters: { type: 'object', properties: {} },
  },
];
