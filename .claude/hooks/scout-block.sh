#!/bin/bash
#
# scout-block.sh - Bash implementation for blocking heavy directory access
#
# PURPOSE:
# Unix-specific implementation of directory access control for Claude Code.
# Called by scout-block.js on Linux/macOS/WSL systems.
#
# WHY SEPARATE BASH SCRIPT:
# - Node.js delegates platform-specific logic to native shell
# - Bash is faster for simple pattern matching than Node.js
# - Allows Unix-specific optimizations (e.g., using grep, sed)
#
# BLOCKED DIRECTORIES:
# - node_modules/ (npm dependencies - 100k+ files)
# - __pycache__/ (Python bytecode cache)
# - .git/ (Git internals - rarely needed for editing)
# - dist/ (build output - shouldn't be edited directly)
# - build/ (build output - shouldn't be edited directly)
#
# BLOCKING STRATEGY:
# 1. File paths (file_path, path, pattern): Strict blocking
#    - Any path containing blocked directory is rejected
#    - WHY: Prevents accidental access to irrelevant files
#
# 2. Bash commands: Selective blocking
#    - Blocks: cd node_modules, ls build/, cat dist/file.js
#    - Allows: npm build, pnpm build, yarn build
#    - WHY: Build commands are legitimate; directory browsing is not
#
# INPUT FORMAT (via stdin):
#   JSON: {"tool_name": "Bash", "tool_input": {"command": "ls node_modules"}}
#
# OUTPUT:
#   Prints "BLOCKED" or "ALLOWED" to stdout
#   Exit 0: Command allowed
#   Exit 2: Command blocked or error
#
# FAIL-OPEN DESIGN:
#   If JSON parsing fails, operation is ALLOWED with warning
#   WHY: Prevents hook misconfiguration from blocking ALL operations
#        Better to allow a bad operation than block everything
#
# USAGE:
#   echo '{"tool_input":{"command":"ls"}}' | bash scout-block.sh
#   # Output: ALLOWED (exit 0)
#
#   echo '{"tool_input":{"command":"ls node_modules"}}' | bash scout-block.sh
#   # Output: BLOCKED (exit 2)
#
# ARCHITECTURE:
#   1. Read JSON from stdin
#   2. Delegate to Node.js for JSON parsing (bash lacks native JSON support)
#   3. Node.js outputs BLOCKED/ALLOWED
#   4. Bash script interprets result and exits with appropriate code
#

# Read stdin
INPUT=$(cat)

# Validate input not empty
if [ -z "$INPUT" ]; then
  echo "ERROR: Empty input" >&2
  exit 2
fi

# Parse JSON and extract all relevant parameters using Node.js
CHECK_RESULT=$(echo "$INPUT" | node -e "
try {
  const input = require('fs').readFileSync(0, 'utf-8');
  const data = JSON.parse(input);

  if (!data.tool_input || typeof data.tool_input !== 'object') {
    // If JSON structure is invalid, allow operation with warning
    console.error('WARN: Invalid JSON structure, allowing operation');
    console.log('ALLOWED');
    process.exit(0);
  }

  const toolInput = data.tool_input;

  // Pattern for directory paths (used for file_path, path, pattern)
  const blockedDirPattern = /(^|\/|\s)node_modules(\/|$|\s)|(^|\/|\s)__pycache__(\/|$|\s)|(^|\/|\s)\.git(\/|$|\s)|(^|\/|\s)dist(\/|$|\s)|(^|\/|\s)build(\/|$|\s)/;

  // Pattern for Bash commands - only block directory access, not build commands
  // Blocks: cd node_modules, ls build/, cat dist/file.js
  // Allows: npm build, pnpm build, yarn build, npm run build
  const blockedBashPattern = /(cd\s+|ls\s+|cat\s+|rm\s+|cp\s+|mv\s+|find\s+)(node_modules|__pycache__|\.git|dist|build)(\/|$|\s)|(\s|^|\/)node_modules\/|(\s|^|\/)__pycache__\/|(\s|^|\/)\.git\/|(\s|^|\/)dist\/|(\s|^|\/)build\//;

  // Check file path parameters (strict blocking)
  const fileParams = [
    toolInput.file_path,    // Read, Edit, Write tools
    toolInput.path,         // Grep, Glob tools
    toolInput.pattern       // Glob, Grep tools
  ];

  for (const param of fileParams) {
    if (param && typeof param === 'string' && blockedDirPattern.test(param)) {
      console.log('BLOCKED');
      process.exit(0);
    }
  }

  // Check Bash command (selective blocking - only directory access)
  if (toolInput.command && typeof toolInput.command === 'string') {
    if (blockedBashPattern.test(toolInput.command)) {
      console.log('BLOCKED');
      process.exit(0);
    }
  }

  console.log('ALLOWED');
} catch (error) {
  // If JSON parsing fails, allow operation with warning (fail-open approach)
  // This prevents hook configuration issues from blocking all operations
  console.error('WARN: JSON parse failed, allowing operation -', error.message);
  console.log('ALLOWED');
  process.exit(0);
}
")

# Check if parsing failed
if [ $? -ne 0 ]; then
  exit 2
fi

# Check result
if [ "$CHECK_RESULT" = "BLOCKED" ]; then
  echo "ERROR: Blocked directory pattern (node_modules, __pycache__, .git/, dist/, build/)" >&2
  exit 2
fi

# Allow command (exit 0)
exit 0