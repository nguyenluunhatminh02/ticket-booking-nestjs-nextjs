/**
 * Shared browser utilities for Chrome DevTools scripts
 *
 * PURPOSE:
 * Provides reusable browser lifecycle management and utility functions for all
 * Chrome DevTools automation scripts. Handles browser launch, page management,
 * argument parsing, and standardized output formatting.
 *
 * WHY THIS MODULE:
 * - Eliminates code duplication across all automation scripts
 * - Centralizes browser configuration and error handling
 * - Provides consistent CLI argument parsing
 * - Standardizes JSON output format for all scripts
 *
 * EXPORTED FUNCTIONS:
 *
 * 1. getBrowser(options)
 *    - Launches new browser or connects to existing one
 *    - Reuses existing instance if already connected
 *    - Options:
 *      * headless: Run in headless mode (default: true)
 *      * browserUrl: Connect to existing browser via URL
 *      * wsEndpoint: Connect via WebSocket endpoint
 *      * viewport: Browser viewport size (default: 1920x1080)
 *      * args: Additional Chrome launch arguments
 *    - Returns: Puppeteer Browser instance
 *
 * 2. getPage(browser)
 *    - Gets existing page or creates new one
 *    - Reuses first available page if browser has multiple tabs
 *    - Returns: Puppeteer Page instance
 *
 * 3. closeBrowser()
 *    - Closes browser and resets global instances
 *    - Safe to call multiple times
 *    - WHY: Ensures clean shutdown and prevents resource leaks
 *
 * 4. parseArgs(argv, options)
 *    - Parses command-line arguments into key-value object
 *    - Supports: --key value, --flag (boolean)
 *    - Example: ["--url", "https://example.com", "--headless"]
 *      → {url: "https://example.com", headless: true}
 *    - Returns: Parsed arguments object
 *
 * 5. outputJSON(data)
 *    - Outputs data as formatted JSON to stdout
 *    - Used for all script results
 *    - Format: Pretty-printed with 2-space indentation
 *
 * 6. outputError(error)
 *    - Outputs error as JSON to stderr
 *    - Includes error message and stack trace
 *    - Exits process with code 1
 *    - Format: {success: false, error: "...", stack: "..."}
 *
 * GLOBAL STATE:
 *   - browserInstance: Singleton browser instance
 *   - pageInstance: Singleton page instance
 *   WHY: Allows scripts to reuse browser across multiple operations
 *
 * BROWSER LAUNCH CONFIGURATION:
 *   - Default args: --no-sandbox, --disable-setuid-sandbox, --disable-dev-shm-usage
 *   - WHY: Required for running in Docker/CI environments
 *   - Default viewport: 1920x1080 (Full HD)
 *
 * USAGE:
 *   import { getBrowser, getPage, closeBrowser, parseArgs, outputJSON } from './lib/browser.js';
 *
 *   const args = parseArgs(process.argv.slice(2));
 *   const browser = await getBrowser({headless: args.headless !== 'false'});
 *   const page = await getPage(browser);
 *
 *   // ... do work ...
 *
 *   outputJSON({success: true, result: data});
 *   if (args.close !== 'false') await closeBrowser();
 *
 * DEBUGGING:
 *   - Set DEBUG=chrome-devtools:* to enable debug logging
 *   - Logs browser launch, connection, and page creation
 *
 * NOTES:
 *   - Uses Puppeteer v24+ with locator API
 *   - Automatically handles browser reuse for efficiency
 *   - All scripts should call closeBrowser() unless --close false is specified
 *   - Error output includes stack trace for debugging
 */
import puppeteer from 'puppeteer';
import debug from 'debug';

const log = debug('chrome-devtools:browser');

let browserInstance = null;
let pageInstance = null;

/**
 * Launch or connect to browser
 */
export async function getBrowser(options = {}) {
  if (browserInstance && browserInstance.isConnected()) {
    log('Reusing existing browser instance');
    return browserInstance;
  }

  const launchOptions = {
    headless: options.headless !== false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      ...(options.args || [])
    ],
    defaultViewport: options.viewport || {
      width: 1920,
      height: 1080
    },
    ...options
  };

  if (options.browserUrl || options.wsEndpoint) {
    log('Connecting to existing browser');
    browserInstance = await puppeteer.connect({
      browserURL: options.browserUrl,
      browserWSEndpoint: options.wsEndpoint
    });
  } else {
    log('Launching new browser');
    browserInstance = await puppeteer.launch(launchOptions);
  }

  return browserInstance;
}

/**
 * Get current page or create new one
 */
export async function getPage(browser) {
  if (pageInstance && !pageInstance.isClosed()) {
    log('Reusing existing page');
    return pageInstance;
  }

  const pages = await browser.pages();
  if (pages.length > 0) {
    pageInstance = pages[0];
  } else {
    pageInstance = await browser.newPage();
  }

  return pageInstance;
}

/**
 * Close browser
 */
export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    pageInstance = null;
  }
}

/**
 * Parse command line arguments
 */
export function parseArgs(argv, options = {}) {
  const args = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];

      if (nextArg && !nextArg.startsWith('--')) {
        args[key] = nextArg;
        i++;
      } else {
        args[key] = true;
      }
    }
  }

  return args;
}

/**
 * Output JSON result
 */
export function outputJSON(data) {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Output error
 */
export function outputError(error) {
  console.error(JSON.stringify({
    success: false,
    error: error.message,
    stack: error.stack
  }, null, 2));
  process.exit(1);
}
