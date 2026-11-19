#!/usr/bin/env node
/**
 * Fill form fields with text using CSS or XPath selectors
 *
 * PURPOSE:
 * Finds a form input element and types text into it. Supports both CSS and
 * XPath selectors with automatic detection. Can optionally clear existing
 * content before typing.
 *
 * WHY THIS SCRIPT:
 * - Automates form filling for testing and data entry
 * - Supports both CSS and XPath for maximum flexibility
 * - Handles input clearing and typing delays
 * - Provides enhanced error messages with troubleshooting tips
 *
 * COMMAND LINE ARGUMENTS:
 *   --selector <selector>  CSS or XPath selector (required)
 *                          CSS: "#email", "input[name='username']"
 *                          XPath: "//input[@type='email']"
 *   --value <text>         Text to type into the field (required)
 *   --url <url>            Navigate to URL before filling (optional)
 *   --clear <bool>         Clear existing content before typing (default: false)
 *   --delay <ms>           Delay between keystrokes in milliseconds (default: 0)
 *   --timeout <ms>         Element wait timeout in milliseconds (default: 5000)
 *   --headless <bool>      Run in headless mode (default: true)
 *   --close <bool>         Close browser after completion (default: true)
 *
 * OUTPUT FORMAT:
 *   JSON to stdout:
 *   {
 *     "success": true,
 *     "selector": "#email",
 *     "value": "user@example.com",
 *     "url": "https://example.com/form"
 *   }
 *
 * EXIT CODES:
 *   0 - Fill successful
 *   1 - Element not found, timeout, or error occurred
 *
 * USAGE EXAMPLES:
 *   # Fill an email field
 *   node fill.js --selector "#email" --value "user@example.com" --url https://example.com
 *
 *   # Fill using XPath and clear existing content
 *   node fill.js --selector "//input[@name='username']" --value "john_doe" --clear true
 *
 *   # Fill with typing delay (simulates human typing)
 *   node fill.js --selector "#search" --value "query" --delay 100
 *
 *   # Fill password field (XPath)
 *   node fill.js --selector "//input[@type='password']" --value "secret123"
 *
 * SELECTOR DETECTION:
 *   - Starts with "/" or "(//" → XPath selector
 *   - Otherwise → CSS selector
 *   - XPath selectors are validated for security (injection prevention)
 *
 * TYPING BEHAVIOR:
 *   - XPath: Uses locator.fill() (replaces content, fast)
 *   - CSS: Uses page.type() (simulates keystrokes, supports delay)
 *   - Clear option: Empties field before typing (XPath: fill(''), CSS: $eval)
 *
 * ERROR HANDLING:
 *   - Element not found: Provides troubleshooting tips
 *   - Timeout: Suggests increasing --timeout or checking visibility
 *   - Element not interactable: May be hidden or disabled
 *
 * NOTES:
 *   - Uses shared selector utilities from ./lib/selector.js
 *   - Enhances error messages with actionable troubleshooting steps
 *   - Automatically closes browser unless --close false is specified
 *   - For XPath, fill() is used instead of type() for reliability
 */
import { getBrowser, getPage, closeBrowser, parseArgs, outputJSON, outputError } from './lib/browser.js';
import { parseSelector, waitForElement, typeIntoElement, enhanceError } from './lib/selector.js';

async function fill() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.selector) {
    outputError(new Error('--selector is required'));
    return;
  }

  if (!args.value) {
    outputError(new Error('--value is required'));
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

    // Type into element
    await typeIntoElement(page, parsed, args.value, {
      clear: args.clear === 'true',
      delay: parseInt(args.delay || '0')
    });

    outputJSON({
      success: true,
      selector: args.selector,
      value: args.value,
      url: page.url()
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

fill();
