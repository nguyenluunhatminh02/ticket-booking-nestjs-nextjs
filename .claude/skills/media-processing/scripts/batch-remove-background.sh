#!/bin/bash
#
# batch-remove-background.sh - Batch background removal script using RMBG CLI
#
# PURPOSE:
# Processes multiple images in a directory, removing backgrounds from each.
# Provides progress tracking and summary statistics for batch operations.
#
# WHY THIS SCRIPT:
# - Automates background removal for multiple images
# - Shows progress (current/total) for long-running batch jobs
# - Provides summary statistics (success/fail counts)
# - Handles directory creation automatically
#
# COMMAND LINE ARGUMENTS:
#   $1 - Input directory with images (required)
#   $2 - Output directory (optional, default: <input_dir>/no-bg)
#   $3 - Model name (optional, default: modnet)
#        Options: u2netp, modnet, briaai, isnet-anime, silueta, u2net-cloth
#   $4 - Max resolution in pixels (optional, default: 2048)
#
# SUPPORTED IMAGE FORMATS:
#   - JPG/JPEG
#   - PNG
#   - WEBP
#
# OUTPUT:
#   - Transparent PNG images in output directory
#   - Console output: configuration, progress per file, summary statistics
#
# EXIT CODES:
#   0 - All images processed successfully
#   1 - Error occurred (directory not found, some images failed)
#
# USAGE EXAMPLES:
#   # Basic usage (output to <input_dir>/no-bg)
#   ./batch-remove-background.sh ./photos
#
#   # Custom output directory
#   ./batch-remove-background.sh ./photos ./output
#
#   # Use high-quality model
#   ./batch-remove-background.sh ./photos ./output briaai
#
#   # High resolution processing
#   ./batch-remove-background.sh ./photos ./output briaai 4096
#
# PROCESSING LOGIC:
#   1. Validate input directory exists
#   2. Create output directory if it doesn't exist
#   3. Find all image files (jpg, jpeg, png, webp)
#   4. Process each image sequentially
#   5. Track success/failure counts
#   6. Display summary statistics
#
# PROGRESS DISPLAY:
#   [1/10] Processing: photo1.jpg
#     ✓ Success
#   [2/10] Processing: photo2.jpg
#     ✗ Failed
#   ...
#
# SUMMARY OUTPUT:
#   Batch Processing Complete
#     Total:   10 files
#     Success: 9 files
#     Failed:  1 files
#     Output:  ./output
#
# AUTOMATIC DEPENDENCY INSTALLATION:
#   - Checks if rmbg-cli is installed
#   - If not found, installs globally via npm
#   - Requires Node.js and npm to be available
#
# ERROR HANDLING:
#   - Validates input directory exists
#   - Reports warning if no images found
#   - Continues processing if individual images fail
#   - Exits with error code if any images failed
#   - Uses colored output for better readability
#
# PERFORMANCE NOTES:
#   - Processes images sequentially (not parallel)
#   - Each image: 2-10 seconds depending on model and resolution
#   - First run downloads model (~50-200 MB)
#   - Total time: (number of images) × (time per image)
#
# DEPENDENCIES:
#   - rmbg-cli (npm package, auto-installed if missing)
#   - Node.js and npm (for rmbg-cli installation)
#   - find command (for locating image files)
#
# NOTES:
#   - Output files are always PNG (even if input is JPG/WEBP)
#   - Output filename: <original_name>.png (extension changed)
#   - Failed images are skipped, processing continues
#   - Use single-image version (remove-background.sh) for one-off tasks
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
INPUT_DIR=""
OUTPUT_DIR=""
MODEL="modnet"
MAX_RESOLUTION="2048"

# Parse arguments
INPUT_DIR="$1"
if [ -n "$2" ]; then
    OUTPUT_DIR="$2"
fi
if [ -n "$3" ]; then
    MODEL="$3"
fi
if [ -n "$4" ]; then
    MAX_RESOLUTION="$4"
fi

# Validate input directory
if [ -z "$INPUT_DIR" ]; then
    echo -e "${RED}Error: Input directory is required${NC}"
    echo ""
    echo "Usage: $0 <input_dir> [output_dir] [model] [resolution]"
    echo ""
    echo "Arguments:"
    echo "  input_dir   Input directory with images (required)"
    echo "  output_dir  Output directory (default: input_dir/no-bg)"
    echo "  model       Model name: u2netp, modnet, briaai, isnet-anime, silueta, u2net-cloth (default: modnet)"
    echo "  resolution  Max resolution in pixels (default: 2048)"
    echo ""
    echo "Examples:"
    echo "  $0 ./photos"
    echo "  $0 ./photos ./output"
    echo "  $0 ./photos ./output briaai"
    echo "  $0 ./photos ./output briaai 4096"
    exit 1
fi

if [ ! -d "$INPUT_DIR" ]; then
    echo -e "${RED}Error: Input directory '$INPUT_DIR' not found${NC}"
    exit 1
fi

# Set default output directory
if [ -z "$OUTPUT_DIR" ]; then
    OUTPUT_DIR="$INPUT_DIR/no-bg"
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Check if rmbg-cli is installed
if ! command -v rmbg &> /dev/null; then
    echo -e "${YELLOW}Warning: rmbg-cli not found${NC}"
    echo "Installing rmbg-cli globally..."
    npm install -g rmbg-cli
    echo -e "${GREEN}✓ rmbg-cli installed${NC}"
fi

# Find all image files
IMAGE_FILES=$(find "$INPUT_DIR" -maxdepth 1 -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.webp" \))
TOTAL_FILES=$(echo "$IMAGE_FILES" | grep -v '^$' | wc -l | tr -d ' ')

if [ "$TOTAL_FILES" -eq 0 ]; then
    echo -e "${YELLOW}Warning: No image files found in '$INPUT_DIR'${NC}"
    exit 0
fi

# Display configuration
echo -e "${GREEN}Batch Background Removal Configuration:${NC}"
echo "  Input Dir:  $INPUT_DIR"
echo "  Output Dir: $OUTPUT_DIR"
echo "  Model:      $MODEL"
echo "  Resolution: $MAX_RESOLUTION"
echo "  Total Files: $TOTAL_FILES"
echo ""

# Process each image
SUCCESS_COUNT=0
FAIL_COUNT=0
CURRENT=0

while IFS= read -r file; do
    [ -z "$file" ] && continue

    CURRENT=$((CURRENT + 1))
    BASENAME=$(basename "$file")
    OUTPUT_FILE="$OUTPUT_DIR/${BASENAME%.*}.png"

    echo -e "${BLUE}[$CURRENT/$TOTAL_FILES]${NC} Processing: $BASENAME"

    if rmbg "$file" -m "$MODEL" -o "$OUTPUT_FILE" -r "$MAX_RESOLUTION" 2>/dev/null; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo -e "  ${GREEN}✓ Success${NC}"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo -e "  ${RED}✗ Failed${NC}"
    fi
done <<< "$IMAGE_FILES"

# Display summary
echo ""
echo -e "${GREEN}Batch Processing Complete${NC}"
echo "  Total:   $TOTAL_FILES files"
echo "  Success: $SUCCESS_COUNT files"
echo "  Failed:  $FAIL_COUNT files"
echo "  Output:  $OUTPUT_DIR"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
