#!/usr/bin/env bash
#
# Auto-Format Hook - Runs formatters after code edits
#
# PURPOSE:
# Automatically formats code files after Write/Edit tool execution
# using prettier, eslint, or other appropriate formatters.
#
# WHEN IT RUNS:
# - Called by post-tool-use.js hook after Write/Edit tools
# - Runs asynchronously to avoid blocking
#
# INPUT:
# - File path as first argument, OR
# - JSON via stdin: {"file_path": "/path/to/file"}
#
# EXIT CODES:
# - 0: Success (file formatted or skipped gracefully)
# - 1: Error (but non-fatal, hook continues)
#
# FEATURES:
# - Detects file type and runs appropriate formatter
# - Handles missing formatters gracefully (no errors)
# - Logs formatting results to .claude/format.log
# - Fast and non-blocking
# - Respects .prettierrc and .eslintrc configs
#

set -euo pipefail

# Configuration
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
LOG_FILE="${PROJECT_DIR}/.claude/format.log"
TIMEOUT_MS=5000

# Colors for output (disabled if not terminal)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Logging function
log() {
  local level="$1"
  shift
  local message="$*"
  local timestamp
  timestamp=$(date +"%Y-%m-%d %H:%M:%S")

  # Log to file
  echo "[${timestamp}] [${level}] ${message}" >> "${LOG_FILE}" 2>/dev/null || true

  # Also print to stdout if verbose mode
  if [ "${VERBOSE:-0}" = "1" ]; then
    case "$level" in
      INFO)  echo -e "${BLUE}[INFO]${NC} ${message}" ;;
      OK)    echo -e "${GREEN}[OK]${NC} ${message}" ;;
      WARN)  echo -e "${YELLOW}[WARN]${NC} ${message}" ;;
      ERROR) echo -e "${RED}[ERROR]${NC} ${message}" ;;
    esac
  fi
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Get file extension
get_extension() {
  local file="$1"
  echo "${file##*.}"
}

# Detect formatter based on file type
detect_formatter() {
  local file="$1"
  local ext
  ext=$(get_extension "$file")

  case "$ext" in
    js|jsx|ts|tsx|mjs|cjs)
      echo "javascript"
      ;;
    json|jsonc)
      echo "json"
      ;;
    css|scss|sass|less)
      echo "css"
      ;;
    html|htm)
      echo "html"
      ;;
    md|markdown)
      echo "markdown"
      ;;
    yaml|yml)
      echo "yaml"
      ;;
    *)
      echo "unknown"
      ;;
  esac
}

# Format with prettier
format_with_prettier() {
  local file="$1"

  # Check if prettier is available
  if ! command_exists npx; then
    log "WARN" "npx not found, skipping prettier"
    return 1
  fi

  # Check if prettier is installed
  if ! npx --no-installation prettier --version >/dev/null 2>&1; then
    log "WARN" "prettier not installed, skipping"
    return 1
  fi

  # Run prettier with timeout
  local start_time
  start_time=$(date +%s%N)

  if timeout "$((TIMEOUT_MS / 1000))" npx --no-installation prettier --write "$file" >/dev/null 2>&1; then
    local end_time
    end_time=$(date +%s%N)
    local duration_ms=$(( (end_time - start_time) / 1000000 ))
    log "OK" "Formatted with prettier (${duration_ms}ms): ${file}"
    return 0
  else
    log "ERROR" "Prettier failed on: ${file}"
    return 1
  fi
}

# Format with eslint
format_with_eslint() {
  local file="$1"

  # Check if eslint is available
  if ! command_exists npx; then
    log "WARN" "npx not found, skipping eslint"
    return 1
  fi

  # Check if eslint is installed
  if ! npx --no-installation eslint --version >/dev/null 2>&1; then
    log "WARN" "eslint not installed, skipping"
    return 1
  fi

  # Run eslint --fix with timeout
  local start_time
  start_time=$(date +%s%N)

  if timeout "$((TIMEOUT_MS / 1000))" npx --no-installation eslint --fix "$file" >/dev/null 2>&1; then
    local end_time
    end_time=$(date +%s%N)
    local duration_ms=$(( (end_time - start_time) / 1000000 ))
    log "OK" "Formatted with eslint (${duration_ms}ms): ${file}"
    return 0
  else
    log "WARN" "ESLint fix failed or found unfixable issues: ${file}"
    return 1
  fi
}

# Format JSON files
format_json() {
  local file="$1"

  # Try prettier first, fallback to jq
  if format_with_prettier "$file"; then
    return 0
  fi

  # Fallback to jq if available
  if command_exists jq; then
    local temp_file
    temp_file=$(mktemp)

    if jq '.' "$file" > "$temp_file" 2>/dev/null; then
      mv "$temp_file" "$file"
      log "OK" "Formatted JSON with jq: ${file}"
      return 0
    else
      rm -f "$temp_file"
      log "ERROR" "jq failed on: ${file}"
      return 1
    fi
  fi

  log "WARN" "No JSON formatter available for: ${file}"
  return 1
}

# Main formatting logic
format_file() {
  local file="$1"

  # Check if file exists
  if [ ! -f "$file" ]; then
    log "ERROR" "File not found: ${file}"
    return 1
  fi

  # Detect file type
  local file_type
  file_type=$(detect_formatter "$file")

  log "INFO" "Processing ${file_type} file: ${file}"

  case "$file_type" in
    javascript)
      # Try prettier first, then eslint
      if format_with_prettier "$file"; then
        return 0
      fi
      format_with_eslint "$file"
      ;;
    json)
      format_json "$file"
      ;;
    css|html|markdown|yaml)
      format_with_prettier "$file"
      ;;
    *)
      log "INFO" "No formatter configured for ${file_type}, skipping: ${file}"
      return 0
      ;;
  esac
}

# Parse input
parse_input() {
  local file_path=""

  # Check if file path is provided as argument
  if [ $# -gt 0 ]; then
    file_path="$1"
  else
    # Read JSON from stdin
    local input
    input=$(cat)

    # Extract file_path from JSON
    if command_exists jq; then
      file_path=$(echo "$input" | jq -r '.file_path // empty' 2>/dev/null || echo "")
    else
      # Fallback: simple grep (less robust)
      file_path=$(echo "$input" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    fi
  fi

  echo "$file_path"
}

# Main execution
main() {
  # Ensure log directory exists
  mkdir -p "$(dirname "${LOG_FILE}")"

  # Parse input
  local file_path
  file_path=$(parse_input "$@")

  # Validate file path
  if [ -z "$file_path" ]; then
    log "ERROR" "No file path provided"
    exit 1
  fi

  # Skip if file is in node_modules or .git
  if [[ "$file_path" == *"/node_modules/"* ]] || [[ "$file_path" == *"/.git/"* ]]; then
    log "INFO" "Skipping ignored path: ${file_path}"
    exit 0
  fi

  # Format the file
  if format_file "$file_path"; then
    exit 0
  else
    # Non-fatal error, exit 0 to not break the hook chain
    exit 0
  fi
}

# Run main function
main "$@"
