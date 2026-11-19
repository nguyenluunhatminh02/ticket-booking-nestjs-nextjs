#!/usr/bin/env node
/**
 * Monitor network requests and responses
 *
 * PURPOSE:
 * Captures all network requests made by a page, including headers, POST data,
 * and response details. Useful for API debugging, performance analysis, and
 * understanding page behavior.
 *
 * WHY THIS SCRIPT:
 * - Debug API calls and responses
 * - Analyze network performance
 * - Identify failed requests
 * - Capture request/response headers
 * - Monitor XHR/fetch calls
 *
 * COMMAND LINE ARGUMENTS:
 *   --url <url>            URL to monitor (required)
 *   --types <list>         Filter by resource types (comma-separated, optional)
 *                          Types: document, stylesheet, image, media, font,
 *                                 script, xhr, fetch, websocket, other
 *                          Example: --types xhr,fetch
 *   --output <path>        Save requests to JSON file (optional)
 *   --wait-until <event>   When to consider navigation complete (default: networkidle2)
 *   --headless <bool>      Run in headless mode (default: true)
 *   --close <bool>         Close browser after completion (default: true)
 *
 * OUTPUT FORMAT:
 *   JSON to stdout (or file if --output specified):
 *   {
 *     "success": true,
 *     "url": "https://example.com",
 *     "requestCount": 42,
 *     "requests": [
 *       {
 *         "id": "12345",
 *         "url": "https://api.example.com/data",
 *         "method": "GET",
 *         "resourceType": "xhr",
 *         "headers": {
 *           "accept": "application/json",
 *           "authorization": "Bearer token..."
 *         },
 *         "postData": null,
 *         "timestamp": 1234567890,
 *         "response": {
 *           "status": 200,
 *           "statusText": "OK",
 *           "headers": {
 *             "content-type": "application/json"
 *           },
 *           "fromCache": false,
 *           "timing": {...}
 *         }
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
 *   # Monitor all requests
 *   node network.js --url https://example.com
 *
 *   # Monitor only XHR and fetch requests
 *   node network.js --url https://example.com --types xhr,fetch
 *
 *   # Save to file for analysis
 *   node network.js --url https://example.com --output requests.json
 *
 *   # Monitor API calls only
 *   node network.js --url https://example.com --types xhr,fetch --output api-calls.json
 *
 * RESOURCE TYPES:
 *   - document: HTML documents
 *   - stylesheet: CSS files
 *   - image: Images (png, jpg, gif, etc.)
 *   - media: Audio/video files
 *   - font: Font files
 *   - script: JavaScript files
 *   - xhr: XMLHttpRequest calls
 *   - fetch: Fetch API calls
 *   - websocket: WebSocket connections
 *   - other: Other resource types
 *
 * REQUEST DATA CAPTURED:
 *   - id: Unique request identifier
 *   - url: Full request URL
 *   - method: HTTP method (GET, POST, etc.)
 *   - resourceType: Type of resource
 *   - headers: Request headers (includes auth tokens)
 *   - postData: POST body (for POST/PUT requests)
 *   - timestamp: When request was made
 *
 * RESPONSE DATA CAPTURED:
 *   - status: HTTP status code (200, 404, etc.)
 *   - statusText: Status text (OK, Not Found, etc.)
 *   - headers: Response headers
 *   - fromCache: Whether response was cached
 *   - timing: Detailed timing information
 *
 * NOTES:
 *   - Requests and responses are matched by ID or URL
 *   - Some response data may be unavailable (e.g., failed requests)
 *   - Large responses are not captured (only headers and metadata)
 *   - Automatically closes browser unless --close false is specified
 *   - Use --types filter to reduce output size
 *   - Timestamps are in milliseconds since epoch
 */
import { getBrowser, getPage, closeBrowser, parseArgs, outputJSON, outputError } from './lib/browser.js';
import fs from 'fs/promises';

async function monitorNetwork() {
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

    const requests = [];
    const filterTypes = args.types ? args.types.split(',').map(t => t.toLowerCase()) : null;

    // Monitor requests
    page.on('request', (request) => {
      const resourceType = request.resourceType().toLowerCase();

      if (!filterTypes || filterTypes.includes(resourceType)) {
        requests.push({
          id: request._requestId || requests.length,
          url: request.url(),
          method: request.method(),
          resourceType: resourceType,
          headers: request.headers(),
          postData: request.postData(),
          timestamp: Date.now()
        });
      }
    });

    // Monitor responses
    const responses = new Map();
    page.on('response', async (response) => {
      const request = response.request();
      const resourceType = request.resourceType().toLowerCase();

      if (!filterTypes || filterTypes.includes(resourceType)) {
        try {
          responses.set(request._requestId || request.url(), {
            status: response.status(),
            statusText: response.statusText(),
            headers: response.headers(),
            fromCache: response.fromCache(),
            timing: response.timing()
          });
        } catch (e) {
          // Ignore errors for some response types
        }
      }
    });

    // Navigate
    await page.goto(args.url, {
      waitUntil: args['wait-until'] || 'networkidle2'
    });

    // Merge requests with responses
    const combined = requests.map(req => ({
      ...req,
      response: responses.get(req.id) || responses.get(req.url) || null
    }));

    const result = {
      success: true,
      url: page.url(),
      requestCount: combined.length,
      requests: combined
    };

    if (args.output) {
      await fs.writeFile(args.output, JSON.stringify(result, null, 2));
      outputJSON({
        success: true,
        output: args.output,
        requestCount: combined.length
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

monitorNetwork();
