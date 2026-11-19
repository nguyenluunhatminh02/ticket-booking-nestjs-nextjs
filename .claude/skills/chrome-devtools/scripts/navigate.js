#!/usr/bin/env node
/**
 * Navigate to a URL using Puppeteer
 *
 * PURPOSE:
 * Opens a browser and navigates to a specified URL. Returns page metadata
 * (URL, title) after navigation completes. Used as a foundation for other
 * browser automation scripts.
 *
 * WHY THIS SCRIPT:
 * - Provides reusable navigation logic for all Chrome DevTools scripts
 * - Handles browser lifecycle (launch, navigate, close)
 * - Supports configurable wait strategies for different page types
 *
 * COMMAND LINE ARGUMENTS:
 *   --url <url>           URL to navigate to (required)
 *   --wait-until <event>  When to consider navigation complete:
 *                         - 'load' (default): 'load' event fires
 *                         - 'domcontentloaded': DOM ready
 *                         - 'networkidle0': No network activity for 500ms
 *                         - 'networkidle2': No more than 2 network requests for 500ms
 *   --timeout <ms>        Navigation timeout in milliseconds (default: 30000)
 *   --headless <bool>     Run in headless mode (default: true)
 *   --close <bool>        Close browser after completion (default: true)
 *
 * OUTPUT FORMAT:
 *   JSON to stdout:
 *   {
 *     "success": true,
 *     "url": "https://example.com",
 *     "title": "Example Domain"
 *   }
 *
 * EXIT CODES:
 *   0 - Navigation successful
 *   1 - Navigation failed or error occurred
 *
 * USAGE EXAMPLES:
 *   # Basic navigation
 *   node navigate.js --url https://example.com
 *
 *   # Wait for DOM content loaded (faster for SPAs)
 *   node navigate.js --url https://example.com --wait-until domcontentloaded
 *
 *   # Custom timeout (60 seconds)
 *   node navigate.js --url https://example.com --timeout 60000
 *
 *   # Keep browser open for debugging
 *   node navigate.js --url https://example.com --close false --headless false
 *
 * ERROR HANDLING:
 *   - Timeout: Page didn't load within specified time
 *   - Network error: DNS failure, connection refused
 *   - Invalid URL: Malformed URL provided
 *
 * NOTES:
 *   - Uses shared browser utilities from ./lib/browser.js
 *   - Automatically closes browser unless --close false is specified
 *   - Headless mode is default for CI/CD environments
 */
import { getBrowser, getPage, closeBrowser, parseArgs, outputJSON, outputError } from './lib/browser.js';

async function navigate() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.url) {
    outputError(new Error('--url is required'));
    return;
  }

  try {
    const browser = await getBrowser({
      headless: args.headless !== 'false'
    });

    const page = await getPage(browser);

    const options = {
      waitUntil: args['wait-until'] || 'networkidle2',
      timeout: parseInt(args.timeout || '30000')
    };

    await page.goto(args.url, options);

    const result = {
      success: true,
      url: page.url(),
      title: await page.title()
    };

    outputJSON(result);

    if (args.close !== 'false') {
      await closeBrowser();
    }
  } catch (error) {
    outputError(error);
  }
}

navigate();
