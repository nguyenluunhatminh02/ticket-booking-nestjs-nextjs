#!/usr/bin/env node
/**
 * UserPromptSubmit Hook - Runs before prompt is processed
 *
 * PURPOSE:
 * Validates and preprocesses user prompts before Claude Code processes them.
 * This hook enables security checks, prompt logging, and content transformation.
 *
 * WHEN IT RUNS:
 * - Immediately after user submits a prompt
 * - Before Claude Code starts processing
 * - Can BLOCK the prompt by exiting with non-zero code
 *
 * WHAT IT DOES:
 * 1. Logs prompt submissions to .claude/prompts.log
 *    - Timestamp, session ID, prompt length, first 100 chars preview
 *    - WHY: Audit trail for debugging and compliance
 * 2. Scans for sensitive patterns (passwords, API keys, secrets, tokens)
 *    - Warns user if sensitive data detected
 *    - (Optional) Can block prompt by uncommenting process.exit(1)
 *    - WHY: Prevents accidental credential exposure
 * 3. (Optional) Can transform/enhance prompts before processing
 *
 * INPUT FORMAT:
 *   JSON via stdin: {"prompt": "user text", "session_id": "abc123"}
 *
 * EXIT CODES:
 * - 0: Prompt allowed (default)
 * - 1: Prompt blocked (security violation or validation failure)
 *
 * USAGE:
 *   Configured in .claude/settings.json:
 *   "hooks": {
 *     "UserPromptSubmit": [{"hook": "node .claude/hooks/on-prompt-submit.js"}]
 *   }
 *
 * SENSITIVE PATTERNS DETECTED:
 * - password: value
 * - api_key: value
 * - secret: value
 * - token: value
 *
 * CUSTOMIZATION:
 * - Uncomment process.exit(1) to BLOCK prompts with sensitive data
 * - Add custom regex patterns to sensitivePatterns array
 * - Modify prompt transformation logic (currently commented out)
 * - Adjust log file location (currently .claude/prompts.log)
 *
 * SECURITY NOTE:
 * - Logs only first 100 chars of prompt (prevents full credential logging)
 * - Does NOT modify prompt content unless explicitly enabled
 */

const fs = require('fs');
const path = require('path');

// Read input from stdin
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
    const { prompt, session_id } = data;

    // Example: Log prompt submission
    const logFile = path.join(process.env.CLAUDE_PROJECT_DIR || '.', '.claude', 'prompts.log');
    const logEntry = {
      timestamp: new Date().toISOString(),
      session: session_id,
      prompt_length: prompt ? prompt.length : 0,
      prompt_preview: prompt ? prompt.substring(0, 100) : ''
    };

    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');

    // Example: Block sensitive patterns
    const sensitivePatterns = [
      /password\s*[:=]\s*\S+/i,
      /api[_-]?key\s*[:=]\s*\S+/i,
      /secret\s*[:=]\s*\S+/i,
      /token\s*[:=]\s*\S+/i
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(prompt)) {
        console.error('Warning: Prompt may contain sensitive information');
        // Could return non-zero exit to block the prompt
        // process.exit(1);
        break;
      }
    }

    // Example: Preprocess prompt (add context, transform, etc.)
    // const enhancedPrompt = `[${new Date().toISOString()}] ${prompt}`;
    // console.log(JSON.stringify({ prompt: enhancedPrompt }));
    // process.exit(0);

    // Exit successfully - allow prompt to proceed
    process.exit(0);
  } catch (error) {
    console.error('UserPromptSubmit hook error:', error.message);
    process.exit(1);
  }
});
