#!/usr/bin/env node
/**
 * Click an element using CSS or XPath selectors
 *
 * PURPOSE:
 * Finds and clicks a DOM element on a web page. Supports both CSS and XPath
 * selectors with automatic detection. Handles navigation that may occur after
 * clicking (e.g., form submissions, link clicks).
 *
 * WHY THIS SCRIPT:
 * - Automates user interactions for testing and scraping
 * - Supports both CSS and XPath for maximum flexibility
 * - Handles post-click navigation automatically
 * - Provides enhanced error messages with troubleshooting tips
 *
 * COMMAND LINE ARGUMENTS:
 *   --selector <selector>  CSS or XPath selector (required)
 *                          CSS: "button.submit", "#login-btn"
 *                          XPath: "//button[text()='Submit']"
 *   --url <url>            Navigate to URL before clicking (optional)
 *   --wait-for <selector>  Wait for this selector after clicking (optional)
 *   --wait-until <event>   When to consider navigation complete (default: networkidle2)
 *   --timeout <ms>         Element wait timeout in milliseconds (default: 5000)
 *   --headless <bool>      Run in headless mode (default: true)
 *   --close <bool>         Close browser after completion (default: true)
 *
 * OUTPUT FORMAT:
 *   JSON to stdout:
 *   {
 *     "success": true,
 *     "url": "https://example.com/result",
 *     "title": "Result Page"
 *   }
 *
 * EXIT CODES:
 *   0 - Click successful
 *   1 - Element not found, timeout, or error occurred
 *
 * USAGE EXAMPLES:
 *   # Click a button by CSS selector
 *   node click.js --selector "button.submit" --url https://example.com
 *
 *   # Click using XPath (find button by text)
 *   node click.js --selector "//button[contains(text(),'Submit')]"
 *
 *   # Click and wait for result element
 *   node click.js --selector "#login-btn" --wait-for ".dashboard"
 *
 *   # Click with custom timeout (10 seconds)
 *   node click.js --selector ".button" --timeout 10000
 *
 * SELECTOR DETECTION:
 *   - Starts with "/" or "(//" → XPath selector
 *   - Otherwise → CSS selector
 *   - XPath selectors are validated for security (injection prevention)
 *
 * NAVIGATION HANDLING:
 *   - Sets up navigation promise BEFORE clicking (race condition prevention)
 *   - If --wait-for is specified, waits for that selector instead
 *   - If no --wait-for, waits for navigation or times out silently
 *   - WHY: Clicking may trigger immediate navigation; promise must be ready
 *
 * ERROR HANDLING:
 *   - Element not found: Provides troubleshooting tips
 *   - Timeout: Suggests increasing --timeout or checking visibility
 *   - Navigation failed: Continues if navigation doesn't occur
 *
 * NOTES:
 *   - Uses shared selector utilities from ./lib/selector.js
 *   - Enhances error messages with actionable troubleshooting steps
 *   - Automatically closes browser unless --close false is specified
 */
import { getBrowser, getPage, closeBrowser, parseArgs, outputJSON, outputError } from './lib/browser.js';
import { parseSelector, waitForElement, clickElement, enhanceError } from './lib/selector.js';

async function click() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.selector) {
    outputError(new Error('--selector is required'));
    return;
  }

  try {
    const browser = await getBrowser({
      headless: args.headless !== 'false'
    });

    const page = await getPage(browser);

    // Navigate if URL provided
    if (args.url) {
      await page.goto(args.url, {
        waitUntil: args['wait-until'] || 'networkidle2'
      });
    }

    // Parse and validate selector
    const parsed = parseSelector(args.selector);

    // Wait for element based on selector type
    await waitForElement(page, parsed, {
      visible: true,
      timeout: parseInt(args.timeout || '5000')
    });

    // Set up navigation promise BEFORE clicking (in case click triggers immediate navigation)
    const navigationPromise = page.waitForNavigation({
      waitUntil: 'load',
      timeout: 5000
    }).catch(() => null); // Catch timeout - navigation may not occur

    // Click element
    await clickElement(page, parsed);

    // Wait for optional selector after click
    if (args['wait-for']) {
      await page.waitForSelector(args['wait-for'], {
        timeout: parseInt(args.timeout || '5000')
      });
    } else {
      // Wait for navigation to complete (or timeout if no navigation)
      await navigationPromise;
    }

    outputJSON({
      success: true,
      url: page.url(),
      title: await page.title()
    });

    if (args.close !== 'false') {
      await closeBrowser();
    }
  } catch (error) {
    // Enhance error message with troubleshooting tips
    const enhanced = enhanceError(error, args.selector);
    outputError(enhanced);
    process.exit(1);
  }
}

click();
