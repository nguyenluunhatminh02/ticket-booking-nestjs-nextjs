#!/usr/bin/env node
/**
 * error-gates-block.js - PreToolUse hook for blocking actions matching error patterns
 *
 * PURPOSE:
 * Checks if the current tool action matches a blocked error pattern and prevents execution.
 * Works with error-gates.js which tracks and promotes errors to blocked status.
 *
 * HOW IT WORKS:
 * 1. Reads .claude/memory/error-gates.json
 * 2. Extracts pattern from current tool action
 * 3. Checks if pattern is blocked
 * 4. Exits with code 2 to block the action if matched
 *
 * PATTERN MATCHING:
 * - Creates same pattern signature as error-gates.js
 * - Checks if pattern exists in gates.patterns with blocked=true
 * - Respects overrides array (patterns that should not be blocked)
 *
 * EXIT CODES:
 * - 0: Action allowed (no blocked pattern matched)
 * - 2: Action blocked (pattern is in blocked gates)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const GATES_FILE = path.join(
  process.env.CLAUDE_PROJECT_DIR || '.',
  '.claude',
  'memory',
  'error-gates.json'
);

// Error keywords to detect potential failures
const ERROR_KEYWORDS = [
  'error',
  'failed',
  'enoent',
  'eacces',
  'permission denied',
  'not found',
  'no such file',
  'cannot read',
  'cannot write',
  'syntax error',
  'undefined is not',
  'cannot find module'
];

/**
 * Normalize a file path for pattern matching
 */
function normalizePath(filePath) {
  if (!filePath) return 'unknown';

  const normalized = filePath
    .replace(/^\/home\/[^/]+\//, '~/')
    .replace(/^C:\\Users\\[^\\]+\\/, '~\\')
    .replace(/\/Users\/[^/]+\//, '~/');

  const parts = normalized.split(/[\/\\]/);
  if (parts.length > 2) {
    return '*/' + parts.slice(-2).join('/');
  }
  return normalized;
}

/**
 * Extract error type from error message
 */
function extractErrorType(message) {
  if (!message) return 'unknown';

  const lower = message.toLowerCase();

  if (lower.includes('enoent') || lower.includes('no such file')) return 'ENOENT';
  if (lower.includes('eacces') || lower.includes('permission denied')) return 'EACCES';
  if (lower.includes('syntax error')) return 'SYNTAX';
  if (lower.includes('cannot find module')) return 'MODULE_NOT_FOUND';
  if (lower.includes('undefined')) return 'UNDEFINED';
  if (lower.includes('timeout')) return 'TIMEOUT';

  return 'GENERAL';
}

/**
 * Create error pattern signature (same logic as error-gates.js)
 */
function createPattern(toolName, toolInput) {
  let errorType = 'GENERAL';
  let pattern = '';

  // For Bash commands, check if command contains error-prone patterns
  if (toolName === 'Bash') {
    const command = toolInput?.command || '';

    // Check for common error patterns in commands
    if (command.includes('cat ') && !command.includes('||')) {
      errorType = 'ENOENT';
      pattern = 'cat_without_fallback';
    } else if (command.includes('rm ') && !command.includes('-f')) {
      errorType = 'EACCES';
      pattern = 'rm_without_force';
    } else if (command.match(/cd\s+[^|]+$/)) {
      errorType = 'ENOENT';
      pattern = 'cd_to_unknown';
    }
  } else if (['Read', 'Write', 'Edit'].includes(toolName)) {
    const filePath = toolInput?.file_path || toolInput?.path;
    if (filePath) {
      errorType = 'GENERAL';
      pattern = normalizePath(filePath);
    }
  }

  if (!pattern) return null;

  return `${toolName}:${errorType}:${pattern}`;
}

/**
 * Load gates from storage
 */
function loadGates() {
  try {
    if (!fs.existsSync(GATES_FILE)) {
      return { patterns: {}, overrides: [] };
    }

    const content = fs.readFileSync(GATES_FILE, 'utf-8');
    const gates = JSON.parse(content);

    if (!gates.patterns || typeof gates.patterns !== 'object') {
      gates.patterns = {};
    }
    if (!Array.isArray(gates.overrides)) {
      gates.overrides = [];
    }

    return gates;
  } catch (error) {
    console.error('Error gates block: Failed to load gates file:', error.message);
    return { patterns: {}, overrides: [] };
  }
}

// Main execution
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('readable', () => {
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    input += chunk;
  }
});

process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const { tool_name, tool_input } = data;

    // Create pattern for current action
    const pattern = createPattern(tool_name, tool_input);

    if (!pattern) {
      // No pattern to check
      process.exit(0);
    }

    // Load gates
    const gates = loadGates();

    // Check if pattern is blocked
    if (gates.patterns[pattern] &&
        gates.patterns[pattern].blocked === true &&
        !gates.overrides.includes(pattern)) {

      const record = gates.patterns[pattern];
      console.error(`\n⚠️  ERROR GATE BLOCKED`);
      console.error(`Pattern: ${pattern}`);
      console.error(`Occurrences: ${record.count}`);
      console.error(`First seen: ${record.first_seen}`);
      console.error(`Last seen: ${record.last_seen}`);
      console.error(`Sample: ${record.sample || 'N/A'}`);
      console.error(`\nThis action has failed ${record.count} times and is now blocked.`);
      console.error(`To override: add "${pattern}" to overrides array in .claude/memory/error-gates.json\n`);

      process.exit(2);
    }

    // Action allowed
    process.exit(0);
  } catch (error) {
    console.error('Error gates block hook error:', error.message);
    // Don't block on hook errors
    process.exit(0);
  }
});
