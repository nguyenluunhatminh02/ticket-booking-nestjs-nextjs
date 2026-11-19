#!/usr/bin/env node
/**
 * Monitor console messages and page errors
 *
 * PURPOSE:
 * Captures all console output (log, warn, error, etc.) and JavaScript errors
 * from a page. Useful for debugging, error tracking, and understanding
 * application behavior.
 *
 * WHY THIS SCRIPT:
 * - Capture console.log/warn/error messages
 * - Track JavaScript errors and exceptions
 * - Debug client-side issues
 * - Monitor application logging
 *
 * COMMAND LINE ARGUMENTS:
 *   --url <url>            URL to monitor (required)
 *   --types <list>         Filter by message types (comma-separated, optional)
 *                          Types: log, warn, error, info, debug, pageerror
 *                          Example: --types error,warn
 *   --duration <ms>        Continue monitoring after page load (optional)
 *                          Useful for capturing delayed messages
 *   --wait-until <event>   When to consider navigation complete (default: networkidle2)
 *   --headless <bool>      Run in headless mode (default: true)
 *   --close <bool>         Close browser after completion (default: true)
 *
 * OUTPUT FORMAT:
 *   JSON to stdout:
 *   {
 *     "success": true,
 *     "url": "https://example.com",
 *     "messageCount": 15,
 *     "messages": [
 *       {
 *         "type": "error",
 *         "text": "Failed to load resource: 404",
 *         "location": {
 *           "url": "https://example.com/app.js",
 *           "lineNumber": 42,
 *           "columnNumber": 10
 *         },
 *         "timestamp": 1234567890
 *       },
 *       {
 *         "type": "pageerror",
 *         "text": "Uncaught TypeError: Cannot read property 'x' of undefined",
 *         "stack": "TypeError: Cannot read property...",
 *         "timestamp": 1234567891
 *       },
 *       ...
 *     ]
 *   }
 *
 * EXIT CODES:
 *   0 - Monitoring successful
 *   1 - Error occurred
 *
 * USAGE EXAMPLES:
 *   # Monitor all console messages
 *   node console.js --url https://example.com
 *
 *   # Monitor only errors and warnings
 *   node console.js --url https://example.com --types error,warn
 *
 *   # Monitor for 10 seconds after page load
 *   node console.js --url https://example.com --duration 10000
 *
 *   # Capture errors from SPA with delayed initialization
 *   node console.js --url https://example.com --types error --duration 5000
 *
 * MESSAGE TYPES:
 *   - log: console.log() messages
 *   - warn: console.warn() messages
 *   - error: console.error() messages
 *   - info: console.info() messages
 *   - debug: console.debug() messages
 *   - pageerror: Uncaught JavaScript exceptions
 *
 * MESSAGE DATA CAPTURED:
 *   - type: Message type (log, warn, error, etc.)
 *   - text: Message content
 *   - location: Source location (url, line, column) - for console messages
 *   - stack: Stack trace - for page errors only
 *   - timestamp: When message was logged (milliseconds since epoch)
 *
 * PAGE ERRORS vs CONSOLE ERRORS:
 *   - pageerror: Uncaught exceptions (TypeError, ReferenceError, etc.)
 *     * Has stack trace
 *     * No location (use stack instead)
 *   - console error: console.error() calls
 *     * Has location (file, line, column)
 *     * No stack trace
 *
 * NOTES:
 *   - Messages are captured in chronological order
 *   - --duration extends monitoring after page load completes
 *   - Useful for SPAs that initialize asynchronously
 *   - Automatically closes browser unless --close false is specified
 *   - Use --types filter to focus on specific message types
 *   - Timestamps are in milliseconds since epoch
 */
import { getBrowser, getPage, closeBrowser, parseArgs, outputJSON, outputError } from './lib/browser.js';

async function monitorConsole() {
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

    const messages = [];
    const filterTypes = args.types ? args.types.split(',') : null;

    // Listen for console messages
    page.on('console', (msg) => {
      const type = msg.type();

      if (!filterTypes || filterTypes.includes(type)) {
        messages.push({
          type: type,
          text: msg.text(),
          location: msg.location(),
          timestamp: Date.now()
        });
      }
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      messages.push({
        type: 'pageerror',
        text: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    });

    // Navigate
    await page.goto(args.url, {
      waitUntil: args['wait-until'] || 'networkidle2'
    });

    // Wait for additional time if specified
    if (args.duration) {
      await new Promise(resolve => setTimeout(resolve, parseInt(args.duration)));
    }

    outputJSON({
      success: true,
      url: page.url(),
      messageCount: messages.length,
      messages: messages
    });

    if (args.close !== 'false') {
      await closeBrowser();
    }
  } catch (error) {
    outputError(error);
  }
}

monitorConsole();
