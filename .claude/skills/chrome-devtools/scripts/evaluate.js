#!/usr/bin/env node
/**
 * Execute JavaScript in page context
 *
 * PURPOSE:
 * Runs arbitrary JavaScript code in the browser's page context and returns
 * the result. Useful for extracting data, manipulating DOM, or testing
 * page behavior programmatically.
 *
 * WHY THIS SCRIPT:
 * - Extract data from pages that can't be captured by selectors
 * - Execute custom logic in browser context
 * - Test page functionality programmatically
 * - Access browser APIs (localStorage, cookies, etc.)
 *
 * COMMAND LINE ARGUMENTS:
 *   --script <code>        JavaScript code to execute (required)
 *                          Can be expression or statement block
 *   --url <url>            Navigate to URL before execution (optional)
 *   --wait-until <event>   When to consider navigation complete (default: networkidle2)
 *   --headless <bool>      Run in headless mode (default: true)
 *   --close <bool>         Close browser after completion (default: true)
 *
 * OUTPUT FORMAT:
 *   JSON to stdout:
 *   {
 *     "success": true,
 *     "result": <evaluated_result>,  // Can be any JSON-serializable value
 *     "url": "https://example.com"
 *   }
 *
 * EXIT CODES:
 *   0 - Execution successful
 *   1 - Script error or execution failed
 *
 * USAGE EXAMPLES:
 *   # Get page title
 *   node evaluate.js --script "document.title"
 *
 *   # Extract data from DOM
 *   node evaluate.js --script "Array.from(document.querySelectorAll('a')).map(a => a.href)"
 *
 *   # Access localStorage
 *   node evaluate.js --script "localStorage.getItem('token')"
 *
 *   # Complex data extraction
 *   node evaluate.js --script "
 *     const items = document.querySelectorAll('.item');
 *     return Array.from(items).map(item => ({
 *       text: item.textContent,
 *       id: item.id
 *     }));
 *   "
 *
 *   # Navigate and execute
 *   node evaluate.js --url https://example.com --script "document.querySelectorAll('button').length"
 *
 *   # Check if element exists
 *   node evaluate.js --script "document.querySelector('#login-form') !== null"
 *
 * SECURITY WARNING - CRITICAL:
 *   - This function uses eval() to execute arbitrary JavaScript code
 *   - Script runs with FULL page context access (cookies, localStorage, DOM, etc.)
 *   - NEVER execute untrusted or user-supplied code without thorough validation
 *   - Script can make network requests, access sensitive data, and modify page state
 *   - Input validation is applied to block obviously dangerous patterns, but this is NOT foolproof
 *   - Only use this script with trusted, reviewed code in controlled environments
 *   - Consider using snapshot.js for safer data extraction when possible
 *
 * MITIGATION MEASURES:
 *   - Script length is limited to prevent abuse (max 10,000 characters)
 *   - Dangerous patterns are blocked (require(), import(), process., etc.)
 *   - All input is validated before execution
 *   - Despite these measures, eval() is inherently risky - use with extreme caution
 *
 * EXECUTION CONTEXT:
 *   - Runs in page's JavaScript context (not Node.js)
 *   - Has access to: document, window, localStorage, etc.
 *   - Can use: DOM APIs, fetch, XMLHttpRequest
 *   - Cannot use: Node.js APIs (fs, path, etc.)
 *   - Return value must be JSON-serializable
 *
 * ERROR HANDLING:
 *   - Syntax errors: Script fails to parse
 *   - Runtime errors: Script throws exception
 *   - Serialization errors: Return value not JSON-serializable
 *   - Timeout: Script runs too long (browser default timeout)
 *
 * NOTES:
 *   - Uses eval() internally (necessary for dynamic code execution)
 *   - Return value is automatically serialized to JSON
 *   - Complex objects (functions, undefined) become null
 *   - Automatically closes browser unless --close false is specified
 *   - For complex scraping, consider using snapshot.js instead
 */
import { getBrowser, getPage, closeBrowser, parseArgs, outputJSON, outputError } from './lib/browser.js';

/**
 * Validates script input for security before eval() execution
 * @param {string} script - The JavaScript code to validate
 * @throws {Error} If script contains dangerous patterns or exceeds length limits
 */
function validateScript(script) {
  // Length limit to prevent abuse
  const MAX_SCRIPT_LENGTH = 10000;
  if (script.length > MAX_SCRIPT_LENGTH) {
    throw new Error(`Script exceeds maximum length of ${MAX_SCRIPT_LENGTH} characters`);
  }

  // Block dangerous patterns that could access Node.js APIs or system resources
  const dangerousPatterns = [
    /\brequire\s*\(/i,           // Node.js require()
    /\bimport\s*\(/i,           // Dynamic import()
    /\bprocess\b/i,             // Node.js process object
    /\bglobal\b/i,              // Node.js global object
    /\b__dirname\b/,            // Node.js __dirname
    /\b__filename\b/,           // Node.js __filename
    /\bmodule\b/i,              // Node.js module
    /\bexports\b/i,             // Node.js exports
    /\bfs\b/i,                  // File system module
    /\bpath\b/i,                // Path module
    /\bchild_process\b/i,       // Child process module
    /\bexec\s*\(/i,             // exec() calls
    /\bexecSync\s*\(/i,         // execSync() calls
    /\bspawn\s*\(/i,            // spawn() calls
    /\beval\s*\(/i,             // Nested eval() calls
    /\bFunction\s*\(/i,         // Function constructor
    /\bsetTimeout\s*\(/i,       // setTimeout with string
    /\bsetInterval\s*\(/i,      // setInterval with string
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(script)) {
      throw new Error(`Script contains dangerous pattern: ${pattern.source}`);
    }
  }
}

async function evaluate() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.script) {
    outputError(new Error('--script is required'));
    return;
  }

  // Validate script for security before execution
  try {
    validateScript(args.script);
  } catch (validationError) {
    outputError(new Error(`Script validation failed: ${validationError.message}`));
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

    /**
     * SECURITY CRITICAL: eval() execution in browser context
     *
     * WHY eval() IS NECESSARY HERE:
     * - This script's purpose is to execute arbitrary JavaScript in the browser
     * - The script parameter contains dynamic code that cannot be statically analyzed
     * - Alternative approaches (Function constructor, new Function()) have the same risks
     * - The validation above blocks obvious dangerous patterns, but eval() remains inherently risky
     *
     * SECURITY MEASURES IN PLACE:
     * - Input validation blocks Node.js APIs (require, process, fs, etc.)
     * - Script length is limited to 10,000 characters
     * - Dangerous patterns (exec, spawn, nested eval) are blocked
     * - Script runs in browser context, not Node.js context
     *
     * REMAINING RISKS:
     * - Can still access browser APIs (cookies, localStorage, DOM)
     * - Can make network requests on behalf of the page
     * - Validation can be bypassed with obfuscated code
     * - NEVER use with untrusted input in production
     */
    const result = await page.evaluate((script) => {
      // eslint-disable-next-line no-eval
      return eval(script);
    }, args.script);

    outputJSON({
      success: true,
      result: result,
      url: page.url()
    });

    if (args.close !== 'false') {
      await closeBrowser();
    }
  } catch (error) {
    outputError(error);
  }
}

evaluate();
