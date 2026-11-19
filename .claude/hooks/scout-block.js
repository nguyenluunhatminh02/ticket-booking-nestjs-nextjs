#!/usr/bin/env node

/**
 * Scout Block Hook
 * Prevents unauthorized scout operations and validates scout requests
 */

const fs = require('fs');
const path = require('path');

class ScoutBlocker {
  constructor() {
    this.blockedPatterns = [
      /rm\s+-rf/i,
      /del\s+/i,
      /format\s+/i,
      /drop\s+table/i,
      /truncate/i
    ];
    this.allowedScoutPaths = [
      '.claude/skills',
      '.claude/agents',
      '.claude/workflows',
      'docs'
    ];
  }

  /**
   * Validate scout request
   */
  validateScoutRequest(command) {
    // Check for blocked patterns
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(command)) {
        return {
          allowed: false,
          reason: `Blocked pattern detected: ${pattern}`,
          severity: 'high'
        };
      }
    }

    // Check if path is in allowed list
    const isAllowedPath = this.allowedScoutPaths.some(allowedPath =>
      command.includes(allowedPath)
    );

    if (!isAllowedPath && command.includes('scout')) {
      return {
        allowed: false,
        reason: 'Scout operation not in allowed paths',
        severity: 'medium'
      };
    }

    return { allowed: true };
  }

  /**
   * Log scout operation
   */
  logScoutOperation(command, result) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      command: command,
      allowed: result.allowed,
      reason: result.reason || null,
      severity: result.severity || 'info'
    };

    const logPath = path.join(process.cwd(), '.claude', 'logs', 'scout-operations.log');
    const logDir = path.dirname(logPath);

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
  }

  /**
   * Main hook execution
   */
  execute() {
    try {
      const input = JSON.parse(fs.readFileSync(0, 'utf-8'));
      const command = input.command || input.args?.join(' ') || '';

      const result = this.validateScoutRequest(command);
      this.logScoutOperation(command, result);

      if (!result.allowed) {
        console.error(JSON.stringify({
          decision: 'block',
          reason: result.reason,
          severity: result.severity
        }));
        process.exit(1);
      }

      console.log(JSON.stringify({
        decision: 'allow',
        message: 'Scout operation validated'
      }));
      process.exit(0);

    } catch (error) {
      console.error(JSON.stringify({
        decision: 'block',
        reason: `Hook execution error: ${error.message}`,
        severity: 'high'
      }));
      process.exit(1);
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const blocker = new ScoutBlocker();
  blocker.execute();
}

module.exports = ScoutBlocker;
