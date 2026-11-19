#!/usr/bin/env node
/**
 * Stop Hook - Runs when Claude Code session ends
 *
 * PURPOSE:
 * Performs cleanup and notification tasks when a Claude Code session terminates.
 * This hook ensures resources are freed and users are notified of completion.
 *
 * WHEN IT RUNS:
 * - After Claude Code finishes processing a prompt
 * - When session exits (success or error)
 * - Before the next session starts
 *
 * WHAT IT DOES:
 * 1. Logs session metadata (ID, exit code, timestamp) to sessions.log
 * 2. Cleans up temporary files older than 1 hour in .claude/temp/
 * 3. (Optional) Sends completion notifications to Discord/Telegram
 *
 * INPUT FORMAT:
 *   JSON via stdin: {"session_id": "abc123", "exit_code": 0}
 *
 * EXIT CODES:
 * - 0: Cleanup completed successfully
 * - 1: Error during cleanup (non-fatal, session already ended)
 *
 * USAGE:
 *   Configured in .claude/settings.json:
 *   "hooks": {
 *     "Stop": [{"hook": "node .claude/hooks/on-stop.js"}]
 *   }
 *
 * CUSTOMIZATION:
 * - Uncomment notification code to enable Discord/Telegram alerts
 * - Adjust temp file age threshold (currently 1 hour)
 * - Modify log file location (currently .claude/sessions.log)
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
    const { session_id, exit_code } = data;

    // Example: Log session end
    const logFile = path.join(process.env.CLAUDE_PROJECT_DIR || '.', '.claude', 'sessions.log');
    const logEntry = {
      timestamp: new Date().toISOString(),
      session: session_id,
      exit_code: exit_code,
      status: exit_code === 0 ? 'success' : 'error'
    };

    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');

    // Example: Send completion notification
    // const { execSync } = require('child_process');
    // execSync(`bash "${process.env.CLAUDE_PROJECT_DIR}/.claude/hooks/send-discord.sh" "Session ${session_id} completed"`);

    // Example: Cleanup temporary files
    const tempDir = path.join(process.env.CLAUDE_PROJECT_DIR || '.', '.claude', 'temp');
    if (fs.existsSync(tempDir)) {
      // Remove files older than 1 hour
      const files = fs.readdirSync(tempDir);
      const oneHourAgo = Date.now() - 3600000;
      files.forEach(file => {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlinkSync(filePath);
        }
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Stop hook error:', error.message);
    process.exit(1);
  }
});
