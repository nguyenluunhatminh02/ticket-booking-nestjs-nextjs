/**
 * Shared selector parsing and validation library
 *
 * PURPOSE:
 * Provides unified selector handling for CSS and XPath selectors with automatic
 * detection, security validation, and Puppeteer v24+ locator API integration.
 *
 * WHY THIS MODULE:
 * - Eliminates selector parsing duplication across all automation scripts
 * - Provides security validation for XPath (prevents injection attacks)
 * - Abstracts Puppeteer API differences between CSS and XPath
 * - Centralizes error handling and troubleshooting tips
 *
 * EXPORTED FUNCTIONS:
 *
 * 1. parseSelector(selector)
 *    - Detects selector type (CSS or XPath)
 *    - Validates XPath for security (injection prevention)
 *    - Returns: {type: 'css'|'xpath', selector: string}
 *    - Throws: Error if selector is invalid or contains injection patterns
 *
 * 2. waitForElement(page, parsed, options)
 *    - Waits for element to appear based on selector type
 *    - CSS: Uses page.waitForSelector()
 *    - XPath: Uses Puppeteer v24+ locator API with ::-p-xpath() pseudo-class
 *    - Options:
 *      * visible: Wait for element to be visible (default: true)
 *      * timeout: Wait timeout in milliseconds (default: 5000)
 *
 * 3. clickElement(page, parsed)
 *    - Clicks element based on selector type
 *    - CSS: Uses page.click()
 *    - XPath: Uses locator.click()
 *
 * 4. typeIntoElement(page, parsed, value, options)
 *    - Types text into form field based on selector type
 *    - CSS: Uses page.type() with optional delay
 *    - XPath: Uses locator.fill() (replaces content, faster)
 *    - Options:
 *      * clear: Clear existing content before typing (default: false)
 *      * delay: Delay between keystrokes in ms (CSS only, default: 0)
 *
 * 5. getElement(page, parsed)
 *    - Gets element handle based on selector type
 *    - CSS: Uses page.$()
 *    - XPath: Uses page.evaluateHandle() with document.evaluate()
 *    - Returns: ElementHandle or null
 *
 * 6. enhanceError(error, selector)
 *    - Adds troubleshooting tips to selector-related errors
 *    - Detects: "waiting for selector", "waiting for XPath", "No node found"
 *    - Appends: 5-step troubleshooting guide
 *    - Returns: Enhanced error object
 *
 * SELECTOR DETECTION LOGIC:
 *   - Starts with "/" or "(//" → XPath selector
 *   - Otherwise → CSS selector
 *   - WHY: XPath always starts with / or (//, CSS never does
 *
 * XPATH SECURITY VALIDATION:
 *   Blocks dangerous patterns:
 *   - javascript: (code execution)
 *   - <script (XSS injection)
 *   - onerror=, onload=, onclick=, onmouseover= (event handler injection)
 *   - eval(, Function(, constructor( (code execution)
 *   - Selectors > 1000 characters (DoS prevention)
 *   WHY: XPath expressions can be exploited for code injection if not validated
 *
 * PUPPETEER V24+ LOCATOR API:
 *   - XPath uses ::-p-xpath() pseudo-class with locator API
 *   - Example: page.locator('::-p-xpath(//button[text()="Submit"])')
 *   - Benefits: Better error messages, automatic waiting, chaining
 *   - CSS still uses traditional page.waitForSelector() for compatibility
 *
 * USAGE:
 *   import { parseSelector, waitForElement, clickElement } from './lib/selector.js';
 *
 *   const parsed = parseSelector('//button[text()="Submit"]');
 *   // {type: 'xpath', selector: '//button[text()="Submit"]'}
 *
 *   await waitForElement(page, parsed, {visible: true, timeout: 5000});
 *   await clickElement(page, parsed);
 *
 * ERROR HANDLING:
 *   - Invalid selector: Throws descriptive error
 *   - XPath injection: Throws security error with pattern details
 *   - Element not found: enhanceError() adds troubleshooting tips
 *   - Timeout: Suggests increasing timeout or checking visibility
 *
 * TROUBLESHOOTING TIPS (added by enhanceError):
 *   1. Use snapshot.js to find correct selector
 *   2. Try XPath selector for text-based matching
 *   3. Check element is visible (not display:none or hidden)
 *   4. Increase --timeout value
 *   5. Change wait strategy (--wait-until load or domcontentloaded)
 *
 * NOTES:
 *   - All scripts should use parseSelector() before interacting with elements
 *   - XPath selectors are automatically validated for security
 *   - Locator API provides better error messages than traditional methods
 *   - CSS selectors support full CSS3 syntax
 *   - XPath selectors support XPath 1.0 (browser standard)
 */

/**
 * Parse and validate selector
 * @param {string} selector - CSS or XPath selector
 * @returns {{type: 'css'|'xpath', selector: string}}
 * @throws {Error} If XPath contains injection patterns
 */
export function parseSelector(selector) {
  if (!selector || typeof selector !== 'string') {
    throw new Error('Selector must be a non-empty string');
  }

  // Detect XPath selectors
  if (selector.startsWith('/') || selector.startsWith('(//')) {
    // XPath injection prevention
    validateXPath(selector);
    return { type: 'xpath', selector };
  }

  // CSS selector
  return { type: 'css', selector };
}

/**
 * Validate XPath selector for security
 * @param {string} xpath - XPath expression to validate
 * @throws {Error} If XPath contains dangerous patterns
 */
function validateXPath(xpath) {
  const dangerous = [
    'javascript:',
    '<script',
    'onerror=',
    'onload=',
    'onclick=',
    'onmouseover=',
    'eval(',
    'Function(',
    'constructor(',
  ];

  const lower = xpath.toLowerCase();
  for (const pattern of dangerous) {
    if (lower.includes(pattern.toLowerCase())) {
      throw new Error(`Potential XPath injection detected: ${pattern}`);
    }
  }

  // Additional validation: check for extremely long selectors (potential DoS)
  if (xpath.length > 1000) {
    throw new Error('XPath selector too long (max 1000 characters)');
  }
}

/**
 * Wait for element based on selector type
 * @param {Object} page - Puppeteer page instance
 * @param {{type: string, selector: string}} parsed - Parsed selector
 * @param {Object} options - Wait options (visible, timeout)
 * @returns {Promise<void>}
 */
export async function waitForElement(page, parsed, options = {}) {
  const defaultOptions = {
    visible: true,
    timeout: 5000,
    ...options
  };

  if (parsed.type === 'xpath') {
    // Use locator API for XPath (Puppeteer v24+)
    const locator = page.locator(`::-p-xpath(${parsed.selector})`);
    // setVisibility and setTimeout are the locator options
    await locator
      .setVisibility(defaultOptions.visible ? 'visible' : null)
      .setTimeout(defaultOptions.timeout)
      .wait();
  } else {
    await page.waitForSelector(parsed.selector, defaultOptions);
  }
}

/**
 * Click element based on selector type
 * @param {Object} page - Puppeteer page instance
 * @param {{type: string, selector: string}} parsed - Parsed selector
 * @returns {Promise<void>}
 */
export async function clickElement(page, parsed) {
  if (parsed.type === 'xpath') {
    // Use locator API for XPath (Puppeteer v24+)
    const locator = page.locator(`::-p-xpath(${parsed.selector})`);
    await locator.click();
  } else {
    await page.click(parsed.selector);
  }
}

/**
 * Type into element based on selector type
 * @param {Object} page - Puppeteer page instance
 * @param {{type: string, selector: string}} parsed - Parsed selector
 * @param {string} value - Text to type
 * @param {Object} options - Type options (delay, clear)
 * @returns {Promise<void>}
 */
export async function typeIntoElement(page, parsed, value, options = {}) {
  if (parsed.type === 'xpath') {
    // Use locator API for XPath (Puppeteer v24+)
    const locator = page.locator(`::-p-xpath(${parsed.selector})`);

    // Clear if requested
    if (options.clear) {
      await locator.fill('');
    }

    await locator.fill(value);
  } else {
    // CSS selector
    if (options.clear) {
      await page.$eval(parsed.selector, el => el.value = '');
    }

    await page.type(parsed.selector, value, { delay: options.delay || 0 });
  }
}

/**
 * Get element handle based on selector type
 * @param {Object} page - Puppeteer page instance
 * @param {{type: string, selector: string}} parsed - Parsed selector
 * @returns {Promise<ElementHandle|null>}
 */
export async function getElement(page, parsed) {
  if (parsed.type === 'xpath') {
    // For XPath, use page.evaluate with XPath evaluation
    // This returns the first matching element
    const element = await page.evaluateHandle((xpath) => {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue;
    }, parsed.selector);

    // Convert JSHandle to ElementHandle
    const elementHandle = element.asElement();
    return elementHandle;
  } else {
    return await page.$(parsed.selector);
  }
}

/**
 * Get enhanced error message for selector failures
 * @param {Error} error - Original error
 * @param {string} selector - Selector that failed
 * @returns {Error} Enhanced error with troubleshooting tips
 */
export function enhanceError(error, selector) {
  if (error.message.includes('waiting for selector') ||
      error.message.includes('waiting for XPath') ||
      error.message.includes('No node found')) {
    error.message += '\n\nTroubleshooting:\n' +
      '1. Use snapshot.js to find correct selector: node snapshot.js --url <url>\n' +
      '2. Try XPath selector: //button[text()="Click"] or //button[contains(text(),"Click")]\n' +
      '3. Check element is visible on page (not display:none or hidden)\n' +
      '4. Increase --timeout value: --timeout 10000\n' +
      '5. Change wait strategy: --wait-until load or --wait-until domcontentloaded';
  }
  return error;
}
