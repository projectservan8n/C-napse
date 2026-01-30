import { exec } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, unlink } from 'fs/promises';

const execAsync = promisify(exec);

let lastScreenHash: string | null = null;
let isCapturing = false;

/**
 * Capture screenshot and return base64 encoded image
 * Uses platform-specific tools
 */
export async function captureScreen(): Promise<string | null> {
  if (isCapturing) return null;
  isCapturing = true;

  const tempFile = join(tmpdir(), `cnapse-screen-${Date.now()}.png`);

  try {
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: Use PowerShell to capture screen
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
      // macOS: Use screencapture
      await execAsync(`screencapture -x "${tempFile}"`);
    } else {
      // Linux: Try various tools
      try {
        await execAsync(`gnome-screenshot -f "${tempFile}" 2>/dev/null || scrot "${tempFile}" 2>/dev/null || import -window root "${tempFile}"`);
      } catch {
        return null;
      }
    }

    // Read the file and convert to base64
    const imageBuffer = await readFile(tempFile);
    const base64 = imageBuffer.toString('base64');

    // Clean up
    await unlink(tempFile).catch(() => {});

    return base64;
  } catch (error) {
    return null;
  } finally {
    isCapturing = false;
  }
}

/**
 * Simple hash function for change detection
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i += 100) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Check if screen has changed since last capture
 */
export async function checkScreenChange(): Promise<{ changed: boolean; image: string | null }> {
  const image = await captureScreen();

  if (!image) {
    return { changed: false, image: null };
  }

  const currentHash = simpleHash(image);
  const changed = lastScreenHash !== null && lastScreenHash !== currentHash;
  lastScreenHash = currentHash;

  return { changed, image };
}

/**
 * Get screen description for context (simplified - just dimensions)
 */
export async function getScreenDescription(): Promise<string | null> {
  try {
    const platform = process.platform;

    if (platform === 'win32') {
      const { stdout } = await execAsync(`
        Add-Type -AssemblyName System.Windows.Forms
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        Write-Output "$($screen.Width)x$($screen.Height)"
      `, { shell: 'powershell.exe' });
      return `Screen ${stdout.trim()} captured`;
    } else if (platform === 'darwin') {
      const { stdout } = await execAsync(`system_profiler SPDisplaysDataType | grep Resolution | head -1`);
      return `Screen ${stdout.trim()}`;
    } else {
      const { stdout } = await execAsync(`xdpyinfo | grep dimensions | awk '{print $2}'`);
      return `Screen ${stdout.trim()} captured`;
    }
  } catch {
    return null;
  }
}
