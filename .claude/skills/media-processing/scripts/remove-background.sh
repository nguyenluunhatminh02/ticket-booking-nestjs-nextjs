#!/bin/bash
#
# remove-background.sh - Background removal script using RMBG CLI
#
# PURPOSE:
# Removes backgrounds from images using AI-powered segmentation models via rmbg-cli.
# Provides a bash wrapper around the rmbg command-line tool with user-friendly output.
#
# WHY THIS SCRIPT:
# - Simpler than Node.js version (no SDK dependencies)
# - Works on systems without Node.js
# - Provides clear progress feedback
# - Automatically installs rmbg-cli if missing
#
# COMMAND LINE ARGUMENTS:
#   $1 - Input image file path (required)
#   $2 - Model name (optional, default: modnet)
#        Options: u2netp, modnet, briaai, isnet-anime, silueta, u2net-cloth
#   $3 - Output file path (optional, default: <input>-no-bg.png)
#   $4 - Max resolution in pixels (optional, default: 2048)
#
# OUTPUT:
#   - Transparent PNG image with background removed
#   - Console output: configuration, file sizes, success/failure
#
# EXIT CODES:
#   0 - Background removed successfully
#   1 - Error occurred (file not found, rmbg not installed, processing failed)
#
# USAGE EXAMPLES:
#   # Basic usage (default model: modnet)
#   ./remove-background.sh photo.jpg
#
#   # Use high-quality model
#   ./remove-background.sh photo.jpg briaai
#
#   # Custom output path
#   ./remove-background.sh photo.jpg briaai output.png
#
#   # High resolution
#   ./remove-background.sh photo.jpg briaai output.png 4096
#
# AI MODELS:
#   - briaai: High-quality, general-purpose (slower)
#   - modnet: Balanced quality/speed (default)
#   - u2netp: Fast, lightweight (lower quality)
#   - isnet-anime: Optimized for anime/cartoon images
#   - silueta: Silhouette extraction
#   - u2net-cloth: Optimized for clothing items
#
# AUTOMATIC DEPENDENCY INSTALLATION:
#   - Checks if rmbg-cli is installed
#   - If not found, installs globally via npm
#   - Requires Node.js and npm to be available
#
# OUTPUT FILE FORMAT:
#   - Always PNG (supports transparency)
#   - Maintains original aspect ratio
#   - Background replaced with transparent pixels
#
# PERFORMANCE NOTES:
#   - First run downloads model (~50-200 MB depending on model)
#   - Processing time: 2-10 seconds per image
#   - Higher resolution = longer processing time
#   - briaai is slowest but highest quality
#   - u2netp is fastest but lowest quality
#
# ERROR HANDLING:
#   - Validates input file exists
#   - Checks rmbg-cli installation
#   - Reports success/failure with file size comparison
#   - Uses colored output for better readability
#
# DEPENDENCIES:
#   - rmbg-cli (npm package, auto-installed if missing)
#   - Node.js and npm (for rmbg-cli installation)
#
# NOTES:
#   - Automatically generates output filename if not specified
#   - Shows file size comparison (input vs output)
#   - Uses colored output (green for success, red for errors, yellow for warnings)
#   - Use Node.js version (remove-bg-node.js) for progress tracking
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
INPUT=""
MODEL="modnet"
OUTPUT=""
MAX_RESOLUTION="2048"

# Parse arguments
INPUT="$1"
if [ -n "$2" ]; then
    MODEL="$2"
fi
if [ -n "$3" ]; then
    OUTPUT="$3"
fi
if [ -n "$4" ]; then
    MAX_RESOLUTION="$4"
fi

# Validate input
if [ -z "$INPUT" ]; then
    echo -e "${RED}Error: Input file is required${NC}"
    echo ""
    echo "Usage: $0 <input> [model] [output] [resolution]"
    echo ""
    echo "Arguments:"
    echo "  input       Input image file (required)"
    echo "  model       Model name: u2netp, modnet, briaai, isnet-anime, silueta, u2net-cloth (default: modnet)"
    echo "  output      Output file path (default: auto-generated)"
    echo "  resolution  Max resolution in pixels (default: 2048)"
    echo ""
    echo "Examples:"
    echo "  $0 photo.jpg"
    echo "  $0 photo.jpg briaai"
    echo "  $0 photo.jpg briaai output.png"
    echo "  $0 photo.jpg briaai output.png 4096"
    exit 1
fi

if [ ! -f "$INPUT" ]; then
    echo -e "${RED}Error: Input file '$INPUT' not found${NC}"
    exit 1
fi

# Check if rmbg-cli is installed
if ! command -v rmbg &> /dev/null; then
    echo -e "${YELLOW}Warning: rmbg-cli not found${NC}"
    echo "Installing rmbg-cli globally..."
    npm install -g rmbg-cli
    echo -e "${GREEN}✓ rmbg-cli installed${NC}"
fi

# Generate output filename if not provided
if [ -z "$OUTPUT" ]; then
    BASENAME=$(basename "$INPUT" | sed 's/\.[^.]*$//')
    OUTPUT="${BASENAME}-no-bg.png"
fi

# Display configuration
echo -e "${GREEN}Background Removal Configuration:${NC}"
echo "  Input:      $INPUT"
echo "  Model:      $MODEL"
echo "  Output:     $OUTPUT"
echo "  Resolution: $MAX_RESOLUTION"
echo ""

# Remove background
echo "Processing..."
rmbg "$INPUT" -m "$MODEL" -o "$OUTPUT" -r "$MAX_RESOLUTION"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Background removed successfully${NC}"
    echo "  Output: $OUTPUT"

    # Display file sizes
    INPUT_SIZE=$(du -h "$INPUT" | cut -f1)
    OUTPUT_SIZE=$(du -h "$OUTPUT" | cut -f1)
    echo ""
    echo "File sizes:"
    echo "  Input:  $INPUT_SIZE"
    echo "  Output: $OUTPUT_SIZE"
else
    echo -e "${RED}✗ Background removal failed${NC}"
    exit 1
fi
