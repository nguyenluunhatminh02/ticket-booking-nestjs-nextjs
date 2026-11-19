#!/usr/bin/env node
/**
 * Measure performance metrics and record trace
 *
 * PURPOSE:
 * Captures comprehensive performance data including Core Web Vitals, resource
 * timing, and Chrome DevTools traces. Used for performance auditing and
 * optimization analysis.
 *
 * WHY THIS SCRIPT:
 * - Measure Core Web Vitals (LCP, FID, CLS, FCP, TTFB)
 * - Analyze resource loading performance
 * - Generate Chrome DevTools traces for detailed analysis
 * - Identify performance bottlenecks
 *
 * COMMAND LINE ARGUMENTS:
 *   --url <url>            URL to measure (required)
 *   --trace <path>         Save Chrome trace to file (optional)
 *                          Open in chrome://tracing or DevTools
 *   --resources <bool>     Include detailed resource list (default: false)
 *   --headless <bool>      Run in headless mode (default: true)
 *   --close <bool>         Close browser after completion (default: true)
 *
 * OUTPUT FORMAT:
 *   JSON to stdout:
 *   {
 *     "success": true,
 *     "url": "https://example.com",
 *     "metrics": {
 *       "JSHeapUsedSizeMB": "45.23",
 *       "JSHeapTotalSizeMB": "64.00",
 *       ...
 *     },
 *     "vitals": {
 *       "LCP": 2500,        // Largest Contentful Paint (ms)
 *       "FID": 100,         // First Input Delay (ms)
 *       "CLS": 0.1,         // Cumulative Layout Shift
 *       "FCP": 1500,        // First Contentful Paint (ms)
 *       "TTFB": 200         // Time to First Byte (ms)
 *     },
 *     "resources": {
 *       "count": 42,
 *       "totalDuration": 5000,
 *       "items": [...]      // Only if --resources true
 *     },
 *     "trace": "trace.json" // Only if --trace specified
 *   }
 *
 * EXIT CODES:
 *   0 - Measurement successful
 *   1 - Error occurred
 *
 * USAGE EXAMPLES:
 *   # Basic performance measurement
 *   node performance.js --url https://example.com
 *
 *   # Save Chrome trace for detailed analysis
 *   node performance.js --url https://example.com --trace trace.json
 *
 *   # Include detailed resource list
 *   node performance.js --url https://example.com --resources true
 *
 *   # Full analysis with trace and resources
 *   node performance.js --url https://example.com --trace trace.json --resources true
 *
 * CORE WEB VITALS:
 *   - LCP (Largest Contentful Paint): Loading performance
 *     Good: < 2.5s, Needs improvement: 2.5-4s, Poor: > 4s
 *   - FID (First Input Delay): Interactivity
 *     Good: < 100ms, Needs improvement: 100-300ms, Poor: > 300ms
 *   - CLS (Cumulative Layout Shift): Visual stability
 *     Good: < 0.1, Needs improvement: 0.1-0.25, Poor: > 0.25
 *   - FCP (First Contentful Paint): Initial render
 *     Good: < 1.8s, Needs improvement: 1.8-3s, Poor: > 3s
 *   - TTFB (Time to First Byte): Server response
 *     Good: < 200ms, Needs improvement: 200-500ms, Poor: > 500ms
 *
 * METRICS CAPTURED:
 *   - JSHeapUsedSize: Memory used by JavaScript
 *   - JSHeapTotalSize: Total JavaScript heap allocated
 *   - DOM nodes, listeners, etc. (from page.metrics())
 *
 * RESOURCE TIMING:
 *   - name: Resource URL
 *   - type: Initiator type (script, css, img, etc.)
 *   - duration: Load time in milliseconds
 *   - size: Transfer size in bytes
 *   - startTime: When resource loading started
 *
 * CHROME TRACE:
 *   - Captures detailed timeline of all browser activities
 *   - Includes: rendering, scripting, painting, network
 *   - Open in: chrome://tracing or DevTools Performance tab
 *   - Categories: devtools.timeline, frame timing
 *
 * NOTES:
 *   - Metrics are captured after page load completes
 *   - Core Web Vitals use PerformanceObserver for accuracy
 *   - 1-second delay before capturing vitals (allows stabilization)
 *   - Trace files can be large (10-100 MB)
 *   - Automatically closes browser unless --close false is specified
 */
import { getBrowser, getPage, closeBrowser, parseArgs, outputJSON, outputError } from './lib/browser.js';
import fs from 'fs/promises';

async function measurePerformance() {
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

    // Start tracing if requested
    if (args.trace) {
      await page.tracing.start({
        path: args.trace,
        categories: [
          'devtools.timeline',
          'disabled-by-default-devtools.timeline',
          'disabled-by-default-devtools.timeline.frame'
        ]
      });
    }

    // Navigate
    await page.goto(args.url, {
      waitUntil: 'networkidle2'
    });

    // Stop tracing
    if (args.trace) {
      await page.tracing.stop();
    }

    // Get performance metrics
    const metrics = await page.metrics();

    // Get Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {
          LCP: null,
          FID: null,
          CLS: 0,
          FCP: null,
          TTFB: null
        };

        // LCP
        try {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) {
              const lastEntry = entries[entries.length - 1];
              vitals.LCP = lastEntry.renderTime || lastEntry.loadTime;
            }
          }).observe({ entryTypes: ['largest-contentful-paint'], buffered: true });
        } catch (e) {
          console.debug('LCP measurement failed:', e.message);
        }

        // CLS
        try {
          new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              if (!entry.hadRecentInput) {
                vitals.CLS += entry.value;
              }
            });
          }).observe({ entryTypes: ['layout-shift'], buffered: true });
        } catch (e) {
          console.debug('CLS measurement failed:', e.message);
        }

        // FCP
        try {
          const paintEntries = performance.getEntriesByType('paint');
          const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
          if (fcpEntry) {
            vitals.FCP = fcpEntry.startTime;
          }
        } catch (e) {
          console.debug('FCP measurement failed:', e.message);
        }

        // TTFB
        try {
          const [navigationEntry] = performance.getEntriesByType('navigation');
          if (navigationEntry) {
            vitals.TTFB = navigationEntry.responseStart - navigationEntry.requestStart;
          }
        } catch (e) {
          console.debug('TTFB measurement failed:', e.message);
        }

        // Wait a bit for metrics to stabilize
        setTimeout(() => resolve(vitals), 1000);
      });
    });

    // Get resource timing
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map(r => ({
        name: r.name,
        type: r.initiatorType,
        duration: r.duration,
        size: r.transferSize,
        startTime: r.startTime
      }));
    });

    const result = {
      success: true,
      url: page.url(),
      metrics: {
        ...metrics,
        JSHeapUsedSizeMB: (metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2),
        JSHeapTotalSizeMB: (metrics.JSHeapTotalSize / 1024 / 1024).toFixed(2)
      },
      vitals: vitals,
      resources: {
        count: resources.length,
        totalDuration: resources.reduce((sum, r) => sum + r.duration, 0),
        items: args.resources === 'true' ? resources : undefined
      }
    };

    if (args.trace) {
      result.trace = args.trace;
    }

    outputJSON(result);

    if (args.close !== 'false') {
      await closeBrowser();
    }
  } catch (error) {
    outputError(error);
  }
}

measurePerformance();
