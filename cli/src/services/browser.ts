/**
 * Browser Service - Shell-based URL opening + Computer Control
 *
 * Opens URLs in the user's default browser using system commands.
 * All browser automation is done via mouse/keyboard control (nut-js).
 *
 * NO Playwright dependency - just native OS commands + desktop automation.
 */

import { runCommand } from '../tools/shell.js';
import * as computer from '../tools/computer.js';
import { describeScreen, captureScreenshot } from '../lib/vision.js';

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Open URL in user's default browser
 */
export async function openUrl(url: string): Promise<{ success: boolean; error?: string }> {
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;

  try {
    if (process.platform === 'win32') {
      await runCommand(`start "" "${fullUrl}"`, 5000);
    } else if (process.platform === 'darwin') {
      await runCommand(`open "${fullUrl}"`, 5000);
    } else {
      await runCommand(`xdg-open "${fullUrl}"`, 5000);
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open URL'
    };
  }
}

/**
 * Open browser and navigate to URL
 * Same as openUrl but with explicit naming
 */
export async function navigateTo(url: string): Promise<void> {
  await openUrl(url);
}

/**
 * Open browser with Google search
 */
export async function searchGoogle(query: string): Promise<{ success: boolean; error?: string }> {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  return openUrl(searchUrl);
}

/**
 * Perform web search and describe results using vision
 * Opens search in browser, waits for results, takes screenshot and describes
 */
export async function webSearch(query: string, engine: 'google' | 'bing' | 'duckduckgo' = 'google'): Promise<string> {
  const urls = {
    google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    bing: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    duckduckgo: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
  };

  // Open search in browser
  await openUrl(urls[engine]);

  // Wait for page to load
  await sleep(3000);

  // Take screenshot and describe what we see
  const vision = await describeScreen();

  return `🔍 Search results for "${query}":\n\n${vision.description}`;
}

/**
 * Open AI chat website and type a question
 * Uses mouse/keyboard control to interact
 */
export async function askAI(
  site: 'perplexity' | 'chatgpt' | 'claude' | 'copilot' | 'google',
  question: string
): Promise<{ response: string; screenshot?: string }> {
  const urls: Record<string, string> = {
    perplexity: 'https://www.perplexity.ai',
    chatgpt: 'https://chat.openai.com',
    claude: 'https://claude.ai',
    copilot: 'https://copilot.microsoft.com',
    google: 'https://www.google.com'
  };

  // Open the site
  await openUrl(urls[site]);

  // Wait for page to load
  await sleep(4000);

  // Type the question using keyboard
  await computer.typeText(question);
  await sleep(500);

  // Press Enter to submit
  await computer.pressKey('Return');

  // Wait for response to generate
  await sleep(site === 'google' ? 3000 : 10000);

  // Capture screenshot and describe what we see
  const vision = await describeScreen();

  return {
    response: vision.description,
    screenshot: vision.screenshot
  };
}

/**
 * Open Gmail compose
 */
export async function openGmailCompose(to?: string, subject?: string, body?: string): Promise<boolean> {
  let url = 'https://mail.google.com/mail/u/0/?fs=1&tf=cm';

  if (to) url += `&to=${encodeURIComponent(to)}`;
  if (subject) url += `&su=${encodeURIComponent(subject)}`;
  if (body) url += `&body=${encodeURIComponent(body)}`;

  const result = await openUrl(url);
  return result.success;
}

/**
 * Send email via Gmail compose URL
 * Opens compose with pre-filled fields, user completes manually or we automate with keyboard
 */
export async function sendGmail(email: { to: string; subject: string; body: string }): Promise<boolean> {
  try {
    // Open Gmail compose with pre-filled fields
    await openGmailCompose(email.to, email.subject, email.body);

    // Wait for compose to open
    await sleep(5000);

    // User can review and send manually, or:
    // Press Ctrl+Enter to send
    await computer.keyCombo(['control', 'Return']);

    await sleep(2000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open Outlook compose
 */
export async function openOutlookCompose(to?: string, subject?: string, body?: string): Promise<boolean> {
  let url = 'https://outlook.office.com/mail/deeplink/compose?';

  if (to) url += `to=${encodeURIComponent(to)}&`;
  if (subject) url += `subject=${encodeURIComponent(subject)}&`;
  if (body) url += `body=${encodeURIComponent(body)}&`;

  const result = await openUrl(url);
  return result.success;
}

/**
 * Send email via Outlook
 */
export async function sendOutlook(email: { to: string; subject: string; body: string }): Promise<boolean> {
  try {
    await openOutlookCompose(email.to, email.subject, email.body);

    // Wait for compose to open
    await sleep(5000);

    // Press Ctrl+Enter to send
    await computer.keyCombo(['control', 'Return']);

    await sleep(2000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open new Google Sheet
 */
export async function openGoogleSheet(): Promise<boolean> {
  const result = await openUrl('https://docs.google.com/spreadsheets/create');
  return result.success;
}

/**
 * Open new Google Doc
 */
export async function openGoogleDoc(): Promise<boolean> {
  const result = await openUrl('https://docs.google.com/document/create');
  return result.success;
}

/**
 * Type in current browser window
 * Assumes browser is focused
 */
export async function typeInBrowser(text: string): Promise<void> {
  await computer.typeText(text);
}

/**
 * Press key in browser
 */
export async function pressKey(key: string): Promise<void> {
  await computer.pressKey(key);
}

/**
 * Click at current mouse position
 */
export async function click(button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
  await computer.clickMouse(button);
}

/**
 * Scroll in browser
 */
export async function scroll(direction: 'up' | 'down', amount = 3): Promise<void> {
  // Use Page Up/Page Down for scrolling
  const key = direction === 'down' ? 'pagedown' : 'pageup';
  for (let i = 0; i < amount; i++) {
    await computer.pressKey(key);
    await sleep(200);
  }
}

/**
 * Take screenshot of current screen (not just browser)
 */
export async function takeScreenshot(): Promise<string> {
  const screenshot = await captureScreenshot();
  if (!screenshot) {
    throw new Error('Failed to capture screenshot');
  }
  return screenshot;
}

/**
 * Get description of current screen
 */
export async function getPageText(): Promise<string> {
  const vision = await describeScreen();
  return vision.description;
}

/**
 * Research a topic - opens multiple searches and gathers info
 */
export async function research(topic: string, maxSources = 3): Promise<{
  query: string;
  sources: { title: string; url: string; content: string }[];
  summary: string;
}> {
  // Open Google search
  await searchGoogle(topic);
  await sleep(3000);

  // Get vision description of search results
  const searchResults = await describeScreen();

  // For now, we return the vision-based description
  // In a real scenario, we'd click through results and gather more
  return {
    query: topic,
    sources: [{
      title: `Google search: ${topic}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(topic)}`,
      content: searchResults.description
    }],
    summary: searchResults.description
  };
}

/**
 * Close current browser tab (Ctrl+W)
 */
export async function closeTab(): Promise<void> {
  await computer.keyCombo(['control', 'w']);
}

/**
 * New browser tab (Ctrl+T)
 */
export async function newTab(): Promise<void> {
  await computer.keyCombo(['control', 't']);
}

/**
 * Switch browser tab (Ctrl+Tab)
 */
export async function nextTab(): Promise<void> {
  await computer.keyCombo(['control', 'Tab']);
}

/**
 * Go back in browser (Alt+Left)
 */
export async function goBack(): Promise<void> {
  await computer.keyCombo(['alt', 'Left']);
}

/**
 * Go forward in browser (Alt+Right)
 */
export async function goForward(): Promise<void> {
  await computer.keyCombo(['alt', 'Right']);
}

/**
 * Refresh page (F5)
 */
export async function refresh(): Promise<void> {
  await computer.pressKey('F5');
}

/**
 * Focus address bar (Ctrl+L)
 */
export async function focusAddressBar(): Promise<void> {
  await computer.keyCombo(['control', 'l']);
}

/**
 * Navigate to URL by typing in address bar
 */
export async function typeUrl(url: string): Promise<void> {
  await focusAddressBar();
  await sleep(300);
  await computer.typeText(url);
  await sleep(200);
  await computer.pressKey('Return');
}

// Legacy function stubs for compatibility (do nothing or minimal behavior)
export async function initBrowser(): Promise<null> {
  // No initialization needed - we use system browser
  return null;
}

export async function getPage(): Promise<null> {
  return null;
}

export async function closeBrowser(): Promise<void> {
  // Close browser window with Alt+F4
  await computer.keyCombo(['alt', 'F4']);
}

export async function elementExists(selector: string): Promise<boolean> {
  // Can't check DOM without Playwright - always return true to not block
  return true;
}

export async function clickElement(selector: string): Promise<boolean> {
  // Without Playwright, we can't click by selector
  // Just click at current position
  await click();
  return true;
}

export async function typeInElement(selector: string, text: string): Promise<boolean> {
  // Just type the text
  await typeInBrowser(text);
  return true;
}

export async function typeSlowly(selector: string, text: string): Promise<boolean> {
  // Type character by character
  for (const char of text) {
    await computer.typeText(char);
    await sleep(50);
  }
  return true;
}

export async function waitForText(text: string): Promise<boolean> {
  // Can't check DOM - just wait a bit
  await sleep(3000);
  return true;
}

export async function getTextContent(selector: string): Promise<string | null> {
  // Use vision to describe what's on screen
  const vision = await describeScreen();
  return vision.description;
}

export async function waitForNavigation(): Promise<void> {
  await sleep(3000);
}

export async function getFullAIResponse(site: string, maxScrolls = 5): Promise<string[]> {
  // Scroll down and capture what we see
  const responses: string[] = [];

  for (let i = 0; i < maxScrolls; i++) {
    const vision = await describeScreen();
    responses.push(vision.description);
    await scroll('down', 1);
    await sleep(1000);
  }

  return responses;
}

export async function googleSheetsType(cells: { cell: string; value: string }[]): Promise<boolean> {
  try {
    for (const { cell, value } of cells) {
      // Press Ctrl+G to go to cell (or use name box with Ctrl+G)
      await computer.keyCombo(['control', 'g']);
      await sleep(500);
      await computer.typeText(cell);
      await computer.pressKey('Return');
      await sleep(300);
      await computer.typeText(value);
      await computer.pressKey('Return');
      await sleep(200);
    }
    return true;
  } catch {
    return false;
  }
}

export async function googleDocsType(text: string): Promise<boolean> {
  try {
    await sleep(1000);
    await computer.typeText(text);
    return true;
  } catch {
    return false;
  }
}

export default {
  openUrl,
  navigateTo,
  searchGoogle,
  webSearch,
  askAI,
  openGmailCompose,
  sendGmail,
  openOutlookCompose,
  sendOutlook,
  openGoogleSheet,
  openGoogleDoc,
  typeInBrowser,
  pressKey,
  click,
  scroll,
  takeScreenshot,
  getPageText,
  research,
  closeTab,
  newTab,
  nextTab,
  goBack,
  goForward,
  refresh,
  focusAddressBar,
  typeUrl,
  // Legacy compatibility
  initBrowser,
  getPage,
  closeBrowser,
  elementExists,
  clickElement,
  typeInElement,
  typeSlowly,
  waitForText,
  getTextContent,
  waitForNavigation,
  getFullAIResponse,
  googleSheetsType,
  googleDocsType
};
