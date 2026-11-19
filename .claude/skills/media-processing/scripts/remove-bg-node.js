#!/usr/bin/env node

/**
 * Node.js background removal script using RMBG SDK
 *
 * PURPOSE:
 * Removes backgrounds from images using AI-powered segmentation models.
 * Provides a Node.js implementation with progress tracking and multiple model support.
 *
 * WHY THIS SCRIPT:
 * - Native Node.js implementation (no external CLI dependencies)
 * - Supports multiple AI models (briaai, modnet, u2netp)
 * - Progress tracking for long-running operations
 * - Better error handling and user feedback
 *
 * AI MODELS:
 *   - briaai: High-quality, general-purpose (slower)
 *   - modnet: Balanced quality/speed (default)
 *   - u2netp: Fast, lightweight (lower quality)
 *
 * COMMAND LINE ARGUMENTS:
 *   <input>                 Input image file path (required)
 *   -o, --output <path>     Output file path (default: <input>-no-bg.png)
 *   -m, --model <name>      Model: briaai, modnet, u2netp (default: modnet)
 *   -r, --resolution <n>    Max resolution in pixels (default: 2048)
 *   -p, --progress          Show progress information
 *   -h, --help              Show help message
 *
 * OUTPUT:
 *   - Transparent PNG image with background removed
 *   - Console output: configuration, progress, file sizes, duration
 *
 * EXIT CODES:
 *   0 - Background removed successfully
 *   1 - Error occurred (file not found, processing failed)
 *
 * USAGE EXAMPLES:
 *   # Basic usage (default model: modnet)
 *   node remove-bg-node.js photo.jpg
 *
 *   # Use high-quality model
 *   node remove-bg-node.js photo.jpg -m briaai -o output.png
 *
 *   # High resolution with progress
 *   node remove-bg-node.js photo.jpg -r 4096 -p
 *
 *   # Show help
 *   node remove-bg-node.js --help
 *
 * PROGRESS TRACKING:
 *   When --progress is enabled:
 *   - Shows overall progress percentage
 *   - Shows model download progress (first run only)
 *   - Shows processing progress
 *   - Updates in real-time (overwrites same line)
 *
 * PERFORMANCE NOTES:
 *   - First run downloads model (~50-200 MB depending on model)
 *   - Processing time: 2-10 seconds per image
 *   - Higher resolution = longer processing time
 *   - briaai is slowest but highest quality
 *   - u2netp is fastest but lowest quality
 *
 * OUTPUT FILE FORMAT:
 *   - Always PNG (supports transparency)
 *   - Maintains original aspect ratio
 *   - Background replaced with transparent pixels
 *
 * DEPENDENCIES:
 *   - rmbg: Background removal SDK
 *   - Node.js 18+
 *
 * NOTES:
 *   - Automatically generates output filename if not specified
 *   - Validates input file exists before processing
 *   - Shows file size comparison (input vs output)
 *   - Processing duration is displayed after completion
 *   - Use bash version (remove-background.sh) if Node.js not available
 */

const { rmbg, createBriaaiModel, createModnetModel, createU2netpModel } = require('rmbg')
const { readFileSync, writeFileSync, existsSync } = require('fs')
const { basename, extname } = require('path')

// Parse command line arguments
const args = process.argv.slice(2)

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Background Removal using RMBG SDK

Usage: node remove-bg-node.js <input> [options]

Arguments:
  input               Input image file path (required)

Options:
  -o, --output <path>     Output file path (default: auto-generated)
  -m, --model <name>      Model: briaai, modnet, u2netp (default: modnet)
  -r, --resolution <n>    Max resolution in pixels (default: 2048)
  -p, --progress          Show progress information
  -h, --help              Show this help message

Examples:
  node remove-bg-node.js photo.jpg
  node remove-bg-node.js photo.jpg -m briaai -o output.png
  node remove-bg-node.js photo.jpg -r 4096 -p
`)
  process.exit(0)
}

// Parse options
const input = args[0]
let output = null
let model = 'modnet'
let maxResolution = 2048
let showProgress = false

for (let i = 1; i < args.length; i++) {
  const arg = args[i]
  if (arg === '-o' || arg === '--output') {
    output = args[++i]
  } else if (arg === '-m' || arg === '--model') {
    model = args[++i]
  } else if (arg === '-r' || arg === '--resolution') {
    maxResolution = parseInt(args[++i], 10)
  } else if (arg === '-p' || arg === '--progress') {
    showProgress = true
  }
}

// Validate input
if (!input) {
  console.error('Error: Input file is required')
  process.exit(1)
}

if (!existsSync(input)) {
  console.error(`Error: Input file '${input}' not found`)
  process.exit(1)
}

// Generate output filename if not provided
if (!output) {
  const name = basename(input, extname(input))
  output = `${name}-no-bg.png`
}

// Select model
let modelInstance
switch (model.toLowerCase()) {
  case 'briaai':
    modelInstance = createBriaaiModel()
    break
  case 'u2netp':
    modelInstance = createU2netpModel()
    break
  case 'modnet':
  default:
    modelInstance = createModnetModel()
    break
}

// Display configuration
console.log('Background Removal Configuration:')
console.log(`  Input:      ${input}`)
console.log(`  Model:      ${model}`)
console.log(`  Output:     ${output}`)
console.log(`  Resolution: ${maxResolution}`)
console.log('')

// Remove background
async function removeBackground() {
  try {
    console.log('Processing...')
    const startTime = Date.now()

    const options = {
      model: modelInstance,
      maxResolution,
      output
    }

    if (showProgress) {
      options.onProgress = (progress, download, processInfo) => {
        const percent = Math.round(progress * 100)
        const downloadPercent = Math.round(download * 100)
        const processPercent = Math.round(processInfo * 100)

        process.stdout.write(
          `\rProgress: ${percent}% | Download: ${downloadPercent}% | Process: ${processPercent}%`
        )
      }
    }

    await rmbg(input, options)

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    if (showProgress) {
      console.log('') // New line after progress
    }

    console.log('✓ Background removed successfully')
    console.log(`  Output: ${output}`)
    console.log(`  Duration: ${duration}s`)

    // Display file sizes
    const inputStats = require('fs').statSync(input)
    const outputStats = require('fs').statSync(output)

    console.log('')
    console.log('File sizes:')
    console.log(`  Input:  ${formatBytes(inputStats.size)}`)
    console.log(`  Output: ${formatBytes(outputStats.size)}`)
  } catch (error) {
    console.error('✗ Background removal failed:', error.message)
    process.exit(1)
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// Run
removeBackground()
