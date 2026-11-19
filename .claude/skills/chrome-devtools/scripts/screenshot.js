#!/usr/bin/env node
/**
 * Take a screenshot of a web page or element
 *
 * PURPOSE:
 * Captures screenshots of entire pages or specific elements. Includes automatic
 * image compression for large files to reduce storage and transfer costs.
 * Supports both CSS and XPath selectors for element targeting.
 *
 * WHY THIS SCRIPT:
 * - Visual testing and documentation
 * - Capture UI state for debugging
 * - Element-specific screenshots for focused analysis
 * - Automatic compression prevents large file issues
 *
 * COMMAND LINE ARGUMENTS:
 *   --output <path>        Output file path (required)
 *                          Example: screenshot.png, page.jpg
 *   --url <url>            Navigate to URL before screenshot (optional)
 *   --selector <selector>  CSS or XPath selector for element screenshot (optional)
 *                          CSS: ".main-content", "#header"
 *                          XPath: "//div[@class='content']"
 *   --full-page <bool>     Capture full scrollable page (default: false)
 *   --format <type>        Image format: png, jpeg (default: png)
 *   --quality <number>     JPEG quality 0-100 (default: browser default)
 *   --max-size <mb>        Maximum file size in MB before compression (default: 5)
 *   --no-compress          Disable automatic compression
 *   --headless <bool>      Run in headless mode (default: true)
 *   --close <bool>         Close browser after completion (default: true)
 *
 * OUTPUT FORMAT:
 *   JSON to stdout:
 *   {
 *     "success": true,
 *     "output": "/absolute/path/to/screenshot.png",
 *     "size": 123456,
 *     "url": "https://example.com",
 *     "compressed": true,              // Only if compression occurred
 *     "originalSize": 5242880,         // Only if compressed
 *     "compressionRatio": "76.29%"     // Only if compressed
 *   }
 *
 * EXIT CODES:
 *   0 - Screenshot successful
 *   1 - Error occurred (element not found, invalid path, etc.)
 *
 * USAGE EXAMPLES:
 *   # Full page screenshot
 *   node screenshot.js --output page.png --url https://example.com --full-page true
 *
 *   # Element screenshot (CSS selector)
 *   node screenshot.js --selector ".main-content" --output element.png --url https://example.com
 *
 *   # Element screenshot (XPath selector)
 *   node screenshot.js --selector "//div[@id='content']" --output element.png
 *
 *   # JPEG with custom quality
 *   node screenshot.js --output page.jpg --format jpeg --quality 80
 *
 *   # Disable compression for high-quality capture
 *   node screenshot.js --output hq.png --no-compress
 *
 *   # Custom max size (10 MB before compression)
 *   node screenshot.js --output large.png --max-size 10
 *
 * COMPRESSION STRATEGY:
 *   - Triggered when file size exceeds --max-size (default: 5 MB)
 *   - Requires ImageMagick (magick or convert command)
 *   - PNG: Resize to 90%, quality 85 → if still large, resize to 75%, quality 70
 *   - JPEG: Quality 80, progressive → if still large, quality 60, 4:2:0 sampling
 *   - Other formats: Convert to JPEG with compression
 *   - WHY: Prevents large screenshots from consuming disk space and bandwidth
 *
 * ERROR HANDLING:
 *   - Element not found: Provides troubleshooting tips
 *   - ImageMagick not found: Warns but keeps original file
 *   - Compression failed: Keeps original file, logs error
 *
 * NOTES:
 *   - Uses shared selector utilities from ./lib/selector.js
 *   - Enhances error messages with actionable troubleshooting steps
 *   - Automatically closes browser unless --close false is specified
 *   - Compression is optional and can be disabled with --no-compress
 *   - Output path is converted to absolute path in response
 */
import { getBrowser, getPage, closeBrowser, parseArgs, outputJSON, outputError } from './lib/browser.js';
import { parseSelector, getElement, enhanceError } from './lib/selector.js';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Compress image using ImageMagick if it exceeds max size
 * @param {string} filePath - Path to the image file
 * @param {number} maxSizeMB - Maximum file size in MB (default: 5)
 * @returns {Promise<{compressed: boolean, originalSize: number, finalSize: number}>}
 */
async function compressImageIfNeeded(filePath, maxSizeMB = 5) {
  const stats = await fs.stat(filePath);
  const originalSize = stats.size;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (originalSize <= maxSizeBytes) {
    return { compressed: false, originalSize, finalSize: originalSize };
  }

  try {
    // Check if ImageMagick is available
    try {
      execSync('magick -version', { stdio: 'pipe' });
    } catch {
      try {
        execSync('convert -version', { stdio: 'pipe' });
      } catch {
        console.error('Warning: ImageMagick not found. Install it to enable automatic compression.');
        return { compressed: false, originalSize, finalSize: originalSize };
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const tempPath = filePath.replace(ext, `.temp${ext}`);

    // Determine compression strategy based on file type
    let compressionCmd;
    // Sanitize file paths to prevent command injection
    const sanitizedFilePath = filePath.replace(/['"\\$`]/g, '');
    const sanitizedTempPath = tempPath.replace(/['"\\$`]/g, '');

    if (ext === '.png') {
      // For PNG: resize and compress with quality
      compressionCmd = ['magick', sanitizedFilePath, '-strip', '-resize', '90%', '-quality', '85', sanitizedTempPath];
    } else if (ext === '.jpg' || ext === '.jpeg') {
      // For JPEG: compress with quality and progressive
      compressionCmd = ['magick', sanitizedFilePath, '-strip', '-quality', '80', '-interlace', 'Plane', sanitizedTempPath];
    } else {
      // For other formats: convert to JPEG with compression
      compressionCmd = ['magick', sanitizedFilePath, '-strip', '-quality', '80', sanitizedTempPath.replace(ext, '.jpg')];
    }

    // Try compression using spawnSync for safer execution
    const result = require('child_process').spawnSync(compressionCmd[0], compressionCmd.slice(1), { stdio: 'pipe' });
    if (result.error) throw result.error;

    const compressedStats = await fs.stat(tempPath);
    const compressedSize = compressedStats.size;

    // If still too large, try more aggressive compression
    if (compressedSize > maxSizeBytes) {
      const finalPath = filePath.replace(ext, `.final${ext}`);
      let aggressiveArgs;
      if (ext === '.png') {
        aggressiveArgs = [tempPath, '-strip', '-resize', '75%', '-quality', '70', finalPath];
      } else {
        aggressiveArgs = [tempPath, '-strip', '-quality', '60', '-sampling-factor', '4:2:0', finalPath];
      }

      const aggressiveResult = require('child_process').spawnSync('magick', aggressiveArgs, { stdio: 'pipe' });
      if (aggressiveResult.error) throw aggressiveResult.error;
      await fs.unlink(tempPath);
      await fs.rename(finalPath, filePath);
    } else {
      await fs.rename(tempPath, filePath);
    }

    const finalStats = await fs.stat(filePath);
    return { compressed: true, originalSize, finalSize: finalStats.size };
  } catch (error) {
    console.error('Compression error:', error.message);
    // If compression fails, keep original file
    try {
      const tempPath = filePath.replace(path.extname(filePath), '.temp' + path.extname(filePath));
      await fs.unlink(tempPath).catch((e) => console.debug('Temp file cleanup failed:', e.message));
    } catch (error) {
      console.debug('Temp file cleanup failed:', error.message);
    }
    return { compressed: false, originalSize, finalSize: originalSize };
  }
}

async function screenshot() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.output) {
    outputError(new Error('--output is required'));
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

    const screenshotOptions = {
      path: args.output,
      type: args.format || 'png',
      fullPage: args['full-page'] === 'true'
    };

    if (args.quality) {
      screenshotOptions.quality = parseInt(args.quality);
    }

    let buffer;
    if (args.selector) {
      // Parse and validate selector
      const parsed = parseSelector(args.selector);

      // Get element based on selector type
      const element = await getElement(page, parsed);
      if (!element) {
        throw new Error(`Element not found: ${args.selector}`);
      }
      buffer = await element.screenshot(screenshotOptions);
    } else {
      buffer = await page.screenshot(screenshotOptions);
    }

    const result = {
      success: true,
      output: path.resolve(args.output),
      size: buffer.length,
      url: page.url()
    };

    // Compress image if needed (unless --no-compress flag is set)
    if (args['no-compress'] !== 'true') {
      const maxSize = args['max-size'] ? parseFloat(args['max-size']) : 5;
      const compressionResult = await compressImageIfNeeded(args.output, maxSize);

      if (compressionResult.compressed) {
        result.compressed = true;
        result.originalSize = compressionResult.originalSize;
        result.size = compressionResult.finalSize;
        result.compressionRatio = ((1 - compressionResult.finalSize / compressionResult.originalSize) * 100).toFixed(2) + '%';
      }
    }

    outputJSON(result);

    if (args.close !== 'false') {
      await closeBrowser();
    }
  } catch (error) {
    // Enhance error message if selector-related
    if (args.selector) {
      const enhanced = enhanceError(error, args.selector);
      outputError(enhanced);
    } else {
      outputError(error);
    }
    process.exit(1);
  }
}

screenshot();
