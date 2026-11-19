#!/usr/bin/env node
/**
 * Get DOM snapshot with interactive elements and selectors
 *
 * PURPOSE:
 * Captures a comprehensive snapshot of all interactive elements on a page,
 * including their selectors, positions, and metadata. Used to discover correct
 * selectors for click.js, fill.js, and other automation scripts.
 *
 * WHY THIS SCRIPT:
 * - Helps find correct CSS/XPath selectors for automation
 * - Provides element metadata (position, visibility, attributes)
 * - Generates unique selectors for each element
 * - Essential debugging tool for browser automation
 *
 * COMMAND LINE ARGUMENTS:
 *   --url <url>            Navigate to URL before snapshot (optional)
 *   --output <path>        Save snapshot to JSON file (optional)
 *   --wait-until <event>   When to consider navigation complete (default: networkidle2)
 *   --headless <bool>      Run in headless mode (default: true)
 *   --close <bool>         Close browser after completion (default: true)
 *
 * OUTPUT FORMAT:
 *   JSON to stdout (or file if --output specified):
 *   {
 *     "success": true,
 *     "url": "https://example.com",
 *     "title": "Example Domain",
 *     "elementCount": 42,
 *     "elements": [
 *       {
 *         "index": 0,
 *         "tagName": "button",
 *         "type": "submit",
 *         "id": "submit-btn",
 *         "className": "btn primary",
 *         "name": null,
 *         "value": null,
 *         "text": "Submit Form",
 *         "href": null,
 *         "selector": "button.btn.primary",  // Unique CSS selector
 *         "xpath": "//*[@id='submit-btn']",  // XPath (if has ID)
 *         "visible": true,
 *         "position": {
 *           "x": 100,
 *           "y": 200,
 *           "width": 120,
 *           "height": 40
 *         }
 *       },
 *       ...
 *     ]
 *   }
 *
 * EXIT CODES:
 *   0 - Snapshot successful
 *   1 - Error occurred
 *
 * USAGE EXAMPLES:
 *   # Snapshot current page (browser must be open)
 *   node snapshot.js
 *
 *   # Navigate and snapshot
 *   node snapshot.js --url https://example.com
 *
 *   # Save to file
 *   node snapshot.js --url https://example.com --output snapshot.json
 *
 * INTERACTIVE ELEMENTS CAPTURED:
 *   - a[href] - Links
 *   - button - Buttons
 *   - input - Input fields
 *   - textarea - Text areas
 *   - select - Dropdowns
 *   - [onclick] - Clickable elements
 *   - [role="button"] - ARIA buttons
 *   - [role="link"] - ARIA links
 *   - [contenteditable] - Editable elements
 *
 * SELECTOR GENERATION:
 *   - Priority: ID > className > tagName
 *   - ID: "#element-id"
 *   - Class: "tag.class1.class2"
 *   - Fallback: "tag"
 *   - XPath: Generated for elements with ID or as fallback
 *
 * METADATA PROVIDED:
 *   - tagName: HTML tag name
 *   - type: Input type (text, email, password, etc.)
 *   - id, className, name: Element attributes
 *   - value: Current input value
 *   - text: Text content (truncated to 100 chars)
 *   - href: Link URL (for anchors)
 *   - visible: Whether element has dimensions > 0
 *   - position: Bounding box (x, y, width, height)
 *
 * NOTES:
 *   - Text content is truncated to 100 characters to reduce output size
 *   - Elements without dimensions (display:none) are marked as not visible
 *   - XPath generation uses ID when available for reliability
 *   - Automatically closes browser unless --close false is specified
 *   - Use this script to find selectors before using click.js or fill.js
 */
import { getBrowser, getPage, closeBrowser, parseArgs, outputJSON, outputError } from './lib/browser.js';
import fs from 'fs/promises';

async function snapshot() {
  const args = parseArgs(process.argv.slice(2));

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

    // Get interactive elements with metadata
    const elements = await page.evaluate(() => {
      const interactiveSelectors = [
        'a[href]',
        'button',
        'input',
        'textarea',
        'select',
        '[onclick]',
        '[role="button"]',
        '[role="link"]',
        '[contenteditable]'
      ];

      const elements = [];
      const selector = interactiveSelectors.join(', ');
      const nodes = document.querySelectorAll(selector);

      nodes.forEach((el, index) => {
        const rect = el.getBoundingClientRect();

        // Generate unique selector
        let uniqueSelector = '';
        if (el.id) {
          uniqueSelector = `#${el.id}`;
        } else if (el.className) {
          const classes = Array.from(el.classList).join('.');
          uniqueSelector = `${el.tagName.toLowerCase()}.${classes}`;
        } else {
          uniqueSelector = el.tagName.toLowerCase();
        }

        elements.push({
          index: index,
          tagName: el.tagName.toLowerCase(),
          type: el.type || null,
          id: el.id || null,
          className: el.className || null,
          name: el.name || null,
          value: el.value || null,
          text: el.textContent?.trim().substring(0, 100) || null,
          href: el.href || null,
          selector: uniqueSelector,
          xpath: getXPath(el),
          visible: rect.width > 0 && rect.height > 0,
          position: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        });
      });

      function getXPath(element) {
        if (element.id) {
          return `//*[@id="${element.id}"]`;
        }
        if (element === document.body) {
          return '/html/body';
        }
        let ix = 0;
        const siblings = element.parentNode?.childNodes || [];
        for (let i = 0; i < siblings.length; i++) {
          const sibling = siblings[i];
          if (sibling === element) {
            return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
          }
          if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
          }
        }
        return '';
      }

      return elements;
    });

    const result = {
      success: true,
      url: page.url(),
      title: await page.title(),
      elementCount: elements.length,
      elements: elements
    };

    if (args.output) {
      await fs.writeFile(args.output, JSON.stringify(result, null, 2));
      outputJSON({
        success: true,
        output: args.output,
        elementCount: elements.length
      });
    } else {
      outputJSON(result);
    }

    if (args.close !== 'false') {
      await closeBrowser();
    }
  } catch (error) {
    outputError(error);
  }
}

snapshot();
