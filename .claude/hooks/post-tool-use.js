#!/usr/bin/env node
/**
 * PostToolUse Hook - Runs after tool execution
 *
 * PURPOSE:
 * Captures telemetry and triggers side effects after Claude Code uses a tool.
 * This hook enables usage analytics, audit logging, and automated notifications.
 *
 * WHEN IT RUNS:
 * - Immediately after any tool (Read, Write, Edit, Bash, etc.) completes
 * - Before the next tool is invoked
 * - Runs asynchronously - does not block tool execution
 *
 * WHAT IT DOES:
 * 1. Logs tool usage metrics to .claude/tool-usage.log (JSON Lines format)
 *    - Timestamp, tool name, session ID, input keys, output length
 *    - WHY: Enables usage analytics and debugging
 * 2. (Optional) Sends notifications for file modifications
 *    - Triggers on Write/Edit tools
 *    - Can alert team via Discord/Telegram
 *
 * INPUT FORMAT:
 *   JSON via stdin: {
 *     "tool_name": "Write",
 *     "tool_input": {"file_path": "/path/to/file"},
 *     "tool_output": "...",
 *     "session_id": "abc123"
 *   }
 *
 * EXIT CODES:
 * - 0: Logging completed successfully
 * - 1: Error during logging (non-fatal)
 *
 * USAGE:
 *   Configured in .claude/settings.json:
 *   "hooks": {
 *     "PostToolUse": [{"hook": "node .claude/hooks/post-tool-use.js"}]
 *   }
 *
 * CUSTOMIZATION:
 * - Uncomment notification code to enable Discord/Telegram alerts
 * - Modify log file location (currently .claude/tool-usage.log)
 * - Add custom logic for specific tools (e.g., trigger CI on Write)
 *
 * SECURITY NOTE:
 * - Does NOT log sensitive data (only logs input keys, not values)
 * - Output length is logged, not content
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
    const { tool_name, tool_input, tool_output, session_id } = data;

    // Example: Log tool usage to a file
    const logFile = path.join(process.env.CLAUDE_PROJECT_DIR || '.', '.claude', 'tool-usage.log');
    const logEntry = {
      timestamp: new Date().toISOString(),
      tool: tool_name,
      session: session_id,
      // Don't log sensitive data
      input_keys: tool_input ? Object.keys(tool_input) : [],
      output_length: tool_output ? tool_output.length : 0
    };

    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');

    // Example: Send notification for specific tools
    if (tool_name === 'Write' || tool_name === 'Edit') {
      // Could trigger Discord/Telegram notification here
      // const { execSync } = require('child_process');
      // execSync(`bash "${process.env.CLAUDE_PROJECT_DIR}/.claude/hooks/send-discord.sh" "File modified: ${tool_input.file_path}"`);
    }

    // Exit successfully
    process.exit(0);
  } catch (error) {
    console.error('PostToolUse hook error:', error.message);
    process.exit(1);
  }
});
