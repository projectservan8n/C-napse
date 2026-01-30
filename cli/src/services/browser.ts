/**
 * Browser Service - Playwright-based web automation
 *
 * Provides reliable browser automation for:
 * - Web searches
 * - AI chat interactions (Perplexity, ChatGPT, Claude, etc.)
 * - Email (Gmail, Outlook)
 * - Google Sheets/Docs
 * - General web browsing
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';

// Singleton browser instance
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let activePage: Page | null = null;

// Browser configuration
interface BrowserConfig {
  headless: boolean;
  slowMo: number;
  viewport: { width: number; height: number };
}

const defaultConfig: BrowserConfig = {
  headless: false, // Show browser so user can see what's happening
  slowMo: 50,      // Slight delay for visibility
  viewport: { width: 1280, height: 800 }
};

/**
 * Initialize browser if not already running
 */
export async function initBrowser(config: Partial<BrowserConfig> = {}): Promise<Page> {
  const cfg = { ...defaultConfig, ...config };

  if (!browser) {
    browser = await chromium.launch({
      headless: cfg.headless,
      slowMo: cfg.slowMo,
    });
  }

  if (!context) {
    context = await browser.newContext({
      viewport: cfg.viewport,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
  }

  if (!activePage) {
    activePage = await context.newPage();
  }

  return activePage;
}

/**
 * Get current page or create one
 */
export async function getPage(): Promise<Page> {
  if (!activePage) {
    return initBrowser();
  }
  return activePage;
}

/**
 * Close browser
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
    activePage = null;
  }
}

/**
 * Navigate to URL
 */
export async function navigateTo(url: string): Promise<void> {
  const page = await getPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

/**
 * Take screenshot and return as base64
 */
export async function takeScreenshot(): Promise<string> {
  const page = await getPage();
  const buffer = await page.screenshot({ type: 'png' });
  return buffer.toString('base64');
}

/**
 * Take screenshot of specific element
 */
export async function screenshotElement(selector: string): Promise<string | null> {
  const page = await getPage();
  try {
    const element = await page.waitForSelector(selector, { timeout: 5000 });
    if (element) {
      const buffer = await element.screenshot({ type: 'png' });
      return buffer.toString('base64');
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Wait for element and click
 */
export async function clickElement(selector: string, timeout = 10000): Promise<boolean> {
  const page = await getPage();
  try {
    await page.click(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Type text into element
 */
export async function typeInElement(selector: string, text: string, timeout = 10000): Promise<boolean> {
  const page = await getPage();
  try {
    await page.fill(selector, text, { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Type text character by character (for sites that need keypresses)
 */
export async function typeSlowly(selector: string, text: string, delay = 50): Promise<boolean> {
  const page = await getPage();
  try {
    await page.click(selector);
    await page.type(selector, text, { delay });
    return true;
  } catch {
    return false;
  }
}

/**
 * Press keyboard key
 */
export async function pressKey(key: string): Promise<void> {
  const page = await getPage();
  await page.keyboard.press(key);
}

/**
 * Scroll page
 */
export async function scroll(direction: 'up' | 'down', amount = 500): Promise<void> {
  const page = await getPage();
  await page.mouse.wheel(0, direction === 'down' ? amount : -amount);
}

/**
 * Wait for text to appear on page
 */
export async function waitForText(text: string, timeout = 30000): Promise<boolean> {
  const page = await getPage();
  try {
    await page.waitForFunction(
      (searchText) => document.body.innerText.includes(searchText),
      text,
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Get text content of element
 */
export async function getTextContent(selector: string): Promise<string | null> {
  const page = await getPage();
  try {
    return await page.textContent(selector);
  } catch {
    return null;
  }
}

/**
 * Get all text from page
 */
export async function getPageText(): Promise<string> {
  const page = await getPage();
  return await page.evaluate(() => document.body.innerText);
}

/**
 * Wait for navigation
 */
export async function waitForNavigation(timeout = 30000): Promise<void> {
  const page = await getPage();
  await page.waitForLoadState('domcontentloaded', { timeout });
}

/**
 * Check if element exists
 */
export async function elementExists(selector: string): Promise<boolean> {
  const page = await getPage();
  try {
    const element = await page.$(selector);
    return element !== null;
  } catch {
    return false;
  }
}

// ========================================
// AI Chat Site Helpers
// ========================================

interface AIChatConfig {
  url: string;
  inputSelector: string;
  submitSelector?: string;
  submitKey?: string;
  responseSelector: string;
  waitForResponse: number;
}

const aiChatConfigs: Record<string, AIChatConfig> = {
  perplexity: {
    url: 'https://www.perplexity.ai',
    inputSelector: 'textarea[placeholder*="Ask"]',
    submitKey: 'Enter',
    responseSelector: '.prose, [class*="answer"], [class*="response"]',
    waitForResponse: 15000
  },
  chatgpt: {
    url: 'https://chat.openai.com',
    inputSelector: 'textarea[id="prompt-textarea"], textarea[data-id="root"]',
    submitSelector: 'button[data-testid="send-button"]',
    responseSelector: '[data-message-author-role="assistant"]',
    waitForResponse: 20000
  },
  claude: {
    url: 'https://claude.ai',
    inputSelector: '[contenteditable="true"], textarea',
    submitKey: 'Enter',
    responseSelector: '[data-testid="message-content"]',
    waitForResponse: 20000
  },
  copilot: {
    url: 'https://copilot.microsoft.com',
    inputSelector: 'textarea, [contenteditable="true"]',
    submitKey: 'Enter',
    responseSelector: '[class*="response"], [class*="message"]',
    waitForResponse: 15000
  },
  google: {
    url: 'https://www.google.com',
    inputSelector: 'textarea[name="q"], input[name="q"]',
    submitKey: 'Enter',
    responseSelector: '#search',
    waitForResponse: 5000
  }
};

/**
 * Ask AI chat and get response
 */
export async function askAI(
  site: keyof typeof aiChatConfigs,
  question: string,
  includeScreenshot = false
): Promise<{ response: string; screenshot?: string }> {
  const config = aiChatConfigs[site];
  if (!config) {
    throw new Error(`Unknown AI site: ${site}`);
  }

  const page = await getPage();

  // Navigate to site
  await page.goto(config.url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000); // Let page fully load

  // Find and fill input
  try {
    await page.waitForSelector(config.inputSelector, { timeout: 10000 });
    await page.fill(config.inputSelector, question);
  } catch {
    // Try clicking first then typing
    await page.click(config.inputSelector);
    await page.type(config.inputSelector, question, { delay: 30 });
  }

  // Submit
  if (config.submitSelector) {
    await page.click(config.submitSelector);
  } else if (config.submitKey) {
    await page.keyboard.press(config.submitKey);
  }

  // Wait for response
  await page.waitForTimeout(config.waitForResponse);

  // Try to get response text
  let response = '';
  try {
    const elements = await page.$$(config.responseSelector);
    if (elements.length > 0) {
      const lastElement = elements[elements.length - 1];
      response = await lastElement.textContent() || '';
    }
  } catch {
    // Fallback: get all page text
    response = await getPageText();
  }

  // Optional screenshot
  let screenshot: string | undefined;
  if (includeScreenshot) {
    screenshot = await takeScreenshot();
  }

  return { response: response.trim(), screenshot };
}

/**
 * Scroll and capture full response (for long answers)
 */
export async function getFullAIResponse(
  site: keyof typeof aiChatConfigs,
  maxScrolls = 5
): Promise<string[]> {
  const config = aiChatConfigs[site];
  const page = await getPage();
  const responseParts: string[] = [];

  for (let i = 0; i < maxScrolls; i++) {
    try {
      const elements = await page.$$(config.responseSelector);
      if (elements.length > 0) {
        const lastElement = elements[elements.length - 1];
        const text = await lastElement.textContent();
        if (text) {
          responseParts.push(text.trim());
        }
      }

      // Scroll down
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(1000);

      // Check if we've reached the bottom
      const atBottom = await page.evaluate(() => {
        return window.innerHeight + window.scrollY >= document.body.scrollHeight - 100;
      });
      if (atBottom) break;
    } catch {
      break;
    }
  }

  return responseParts;
}

// ========================================
// Email Helpers
// ========================================

interface EmailData {
  to: string;
  subject: string;
  body: string;
}

/**
 * Send email via Gmail web interface
 */
export async function sendGmail(email: EmailData): Promise<boolean> {
  const page = await getPage();

  try {
    // Go to Gmail compose
    await page.goto('https://mail.google.com/mail/u/0/#inbox?compose=new');
    await page.waitForTimeout(3000);

    // Wait for compose dialog
    await page.waitForSelector('input[aria-label*="To"]', { timeout: 10000 });

    // Fill To field
    await page.fill('input[aria-label*="To"]', email.to);
    await page.keyboard.press('Tab');

    // Fill Subject
    await page.fill('input[name="subjectbox"]', email.subject);
    await page.keyboard.press('Tab');

    // Fill Body
    await page.fill('[aria-label*="Message Body"], [role="textbox"]', email.body);

    // Click Send (Ctrl+Enter is faster)
    await page.keyboard.press('Control+Enter');

    await page.waitForTimeout(2000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Send email via Outlook web interface
 */
export async function sendOutlook(email: EmailData): Promise<boolean> {
  const page = await getPage();

  try {
    // Go to Outlook compose
    await page.goto('https://outlook.office.com/mail/0/inbox');
    await page.waitForTimeout(3000);

    // Click New Message
    await page.click('button[aria-label*="New mail"], button[title*="New mail"]');
    await page.waitForTimeout(2000);

    // Fill To
    await page.fill('input[aria-label*="To"]', email.to);
    await page.keyboard.press('Tab');

    // Fill Subject
    await page.fill('input[aria-label*="Subject"], input[placeholder*="Subject"]', email.subject);
    await page.keyboard.press('Tab');

    // Fill Body
    await page.fill('[aria-label*="Message body"], [role="textbox"]', email.body);

    // Click Send
    await page.click('button[aria-label*="Send"], button[title*="Send"]');

    await page.waitForTimeout(2000);
    return true;
  } catch {
    return false;
  }
}

// ========================================
// Google Apps Helpers
// ========================================

/**
 * Create new Google Sheet and type in cells
 */
export async function googleSheetsType(cellData: { cell: string; value: string }[]): Promise<boolean> {
  const page = await getPage();

  try {
    // Go to Google Sheets
    await page.goto('https://docs.google.com/spreadsheets/create');
    await page.waitForTimeout(5000);

    for (const { cell, value } of cellData) {
      // Click on name box and type cell reference
      await page.click('input#t-name-box');
      await page.fill('input#t-name-box', cell);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Type value
      await page.keyboard.type(value);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Create new Google Doc and type
 */
export async function googleDocsType(text: string): Promise<boolean> {
  const page = await getPage();

  try {
    // Go to Google Docs
    await page.goto('https://docs.google.com/document/create');
    await page.waitForTimeout(5000);

    // Click on document body
    await page.click('.kix-appview-editor');
    await page.waitForTimeout(500);

    // Type text
    await page.keyboard.type(text, { delay: 20 });

    return true;
  } catch {
    return false;
  }
}

// ========================================
// Web Search
// ========================================

/**
 * Perform web search and get results
 */
export async function webSearch(query: string, engine: 'google' | 'bing' | 'duckduckgo' = 'google'): Promise<string[]> {
  const page = await getPage();
  const results: string[] = [];

  const urls = {
    google: 'https://www.google.com',
    bing: 'https://www.bing.com',
    duckduckgo: 'https://duckduckgo.com'
  };

  const selectors = {
    google: { input: 'textarea[name="q"]', results: '#search .g h3' },
    bing: { input: 'input[name="q"]', results: '#b_results h2 a' },
    duckduckgo: { input: 'input[name="q"]', results: '[data-result] h2' }
  };

  try {
    await page.goto(urls[engine]);
    await page.waitForTimeout(2000);

    // Search
    await page.fill(selectors[engine].input, query);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Get result titles
    const elements = await page.$$(selectors[engine].results);
    for (const el of elements.slice(0, 10)) {
      const text = await el.textContent();
      if (text) results.push(text);
    }
  } catch {
    // Return empty on error
  }

  return results;
}

/**
 * Click on search result by index
 */
export async function clickSearchResult(index: number): Promise<boolean> {
  const page = await getPage();

  try {
    const results = await page.$$('#search .g h3, #b_results h2 a, [data-result] h2 a');
    if (results[index]) {
      await results[index].click();
      await page.waitForTimeout(2000);
      return true;
    }
  } catch {}

  return false;
}

// ========================================
// Research Helper (multi-step)
// ========================================

export interface ResearchResult {
  query: string;
  sources: { title: string; url: string; content: string }[];
  summary: string;
}

/**
 * Research a topic: search, visit results, gather info
 */
export async function research(topic: string, maxSources = 3): Promise<ResearchResult> {
  const page = await getPage();
  const sources: { title: string; url: string; content: string }[] = [];

  // Search
  await webSearch(topic);
  await page.waitForTimeout(2000);

  // Visit top results
  for (let i = 0; i < maxSources; i++) {
    try {
      const results = await page.$$('#search .g');
      if (results[i]) {
        // Get title and URL
        const titleEl = await results[i].$('h3');
        const linkEl = await results[i].$('a');

        const title = await titleEl?.textContent() || 'Unknown';
        const url = await linkEl?.getAttribute('href') || '';

        // Click and get content
        await titleEl?.click();
        await page.waitForTimeout(3000);

        // Get main content
        const content = await page.evaluate(() => {
          const article = document.querySelector('article, main, .content, #content');
          return article?.textContent?.slice(0, 2000) || document.body.innerText.slice(0, 2000);
        });

        sources.push({ title, url, content: content.trim() });

        // Go back
        await page.goBack();
        await page.waitForTimeout(1500);
      }
    } catch {
      continue;
    }
  }

  return {
    query: topic,
    sources,
    summary: '' // To be filled by AI
  };
}

export default {
  initBrowser,
  getPage,
  closeBrowser,
  navigateTo,
  takeScreenshot,
  screenshotElement,
  clickElement,
  typeInElement,
  typeSlowly,
  pressKey,
  scroll,
  waitForText,
  getTextContent,
  getPageText,
  waitForNavigation,
  elementExists,
  askAI,
  getFullAIResponse,
  sendGmail,
  sendOutlook,
  googleSheetsType,
  googleDocsType,
  webSearch,
  clickSearchResult,
  research
};
