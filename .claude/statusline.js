#!/usr/bin/env node
'use strict';

/**
 * @fileoverview Custom Claude Code statusline for Node.js
 * @module statusline
 * @description Displays a rich, informative status line in the terminal showing current project state,
 * session metrics, and billing information. Runs continuously to provide real-time feedback.
 *
 * WHY NODE.JS VERSION:
 * - Cross-platform compatibility (Windows, macOS, Linux)
 * - Better JSON parsing than bash
 * - Easier to maintain and extend
 * - No external dependencies required
 *
 * FEATURES DISPLAYED:
 * 1. Current directory (with ~ for home directory)
 * 2. Git branch name (if in git repo)
 * 3. Model name and version
 * 4. Session time remaining (5-hour billing blocks)
 * 5. Cost in USD (API billing mode only)
 * 6. Lines added/removed (code changes)
 *
 * INPUT FORMAT (via stdin):
 *   JSON object from Claude Code:
 *   {
 *     "workspace": {"current_dir": "/path/to/project"},
 *     "model": {"display_name": "Claude", "version": "3.5"},
 *     "cost": {"total_cost_usd": 0.1234, "total_lines_added": 100, "total_lines_removed": 50},
 *     "transcript_path": "/path/to/transcript.jsonl"
 *   }
 *
 * OUTPUT:
 *   Single line with color-coded status information
 *   Example: "📁 ~/project  🌿 main  🤖 Claude  ⌛ 2h 30m until reset"
 *
 * COLOR SCHEME:
 *   - Cyan: Directory, cost
 *   - Green: Git branch, lines changed
 *   - Magenta: Model name, usage
 *   - Yellow: Model version
 *   - Red/Yellow/Green: Session time (based on remaining %)
 *
 * SESSION TIMER LOGIC:
 *   - Anthropic uses 5-hour billing blocks (00:00-05:00, 05:00-10:00, etc. UTC)
 *   - Parses transcript JSONL to find first API call timestamp
 *   - Calculates time remaining until current block resets
 *   - Color changes: Green (>25% remaining), Yellow (10-25%), Red (<10%)
 *
 * ENVIRONMENT VARIABLES:
 *   NO_COLOR - Disable colors if set
 *   CLAUDE_BILLING_MODE - "api" shows cost, other modes hide it
 *
 * EXIT CODES:
 *   0 - Status line rendered successfully
 *   1 - Error (invalid input, parse failure)
 *
 * USAGE:
 *   Configured in .claude/settings.json:
 *   "statusLine": "node .claude/statusline.js"
 *
 * @version 1.0.0
 * @author Mastery Node.js Project
 */

const { stdin, stdout, env } = require('process');
const { execSync } = require('child_process');
const os = require('os');

/** @type {boolean} Whether to use ANSI color codes */
const USE_COLOR = !env.NO_COLOR && stdout.isTTY;

/**
 * Generate ANSI color code
 * @param {string} code - ANSI color code
 * @returns {string} ANSI escape sequence or empty string if colors disabled
 */
const color = (code) => USE_COLOR ? `\x1b[${code}m` : '';

/**
 * Generate ANSI reset code
 * @returns {string} ANSI reset sequence or empty string if colors disabled
 */
const reset = () => USE_COLOR ? '\x1b[0m' : '';

/** @type {string} Cyan color for directory and cost */
const DirColor = color('1;36');
/** @type {string} Green color for git branch and lines changed */
const GitColor = color('1;32');
/** @type {string} Magenta color for model name and usage */
const ModelColor = color('1;35');
/** @type {string} Yellow color for model version */
const VersionColor = color('1;33');
/** @type {string} Magenta color for usage */
const UsageColor = color('1;35');
/** @type {string} Cyan color for cost */
const CostColor = color('1;36');
/** @type {string} Reset color code */
const Reset = reset();

/**
 * Safe command execution wrapper
 * @param {string} cmd - Command to execute
 * @returns {string} Command output trimmed, or empty string on error
 */
function exec(cmd) {
    try {
        return execSync(cmd, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
            windowsHide: true
        }).trim();
    } catch (err) {
        return '';
    }
}

/**
 * Convert ISO8601 timestamp to Unix epoch seconds
 * @param {string} timestamp - ISO8601 timestamp string
 * @returns {number} Unix epoch seconds, or 0 on error
 */
function toEpoch(timestamp) {
    try {
        const date = new Date(timestamp);
        return Math.floor(date.getTime() / 1000);
    } catch (err) {
        return 0;
    }
}

/**
 * Format epoch timestamp as HH:mm
 * @param {number} epoch - Unix epoch seconds
 * @returns {string} Formatted time string "HH:mm", or "00:00" on error
 */
function formatTimeHM(epoch) {
    try {
        const date = new Date(epoch * 1000);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (err) {
        return '00:00';
    }
}

/**
 * Get session color based on remaining percentage
 * @param {number} sessionPercent - Session usage percentage (0-100)
 * @returns {string} ANSI color code based on remaining time
 * @description Color thresholds:
 *   - <=10% remaining: Red (\x1b[1;31m)
 *   - 10-25% remaining: Yellow (\x1b[1;33m)
 *   - >25% remaining: Green (\x1b[1;32m)
 */
function getSessionColor(sessionPercent) {
    if (!USE_COLOR) return '';

    const remaining = 100 - sessionPercent;
    if (remaining <= 10) {
        return '\x1b[1;31m';  // red
    } else if (remaining <= 25) {
        return '\x1b[1;33m';  // yellow
    } else {
        return '\x1b[1;32m';  // green
    }
}

/**
 * Expand home directory path to ~ notation
 * @param {string} path - Absolute path
 * @returns {string} Path with home directory replaced by ~
 */
function expandHome(path) {
    const homeDir = os.homedir();
    if (path.startsWith(homeDir)) {
        return path.replace(homeDir, '~');
    }
    return path;
}

/**
 * Read stdin asynchronously
 * @returns {Promise<string>} Complete stdin content
 */
async function readStdin() {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stdin.setEncoding('utf8');

        stdin.on('data', (chunk) => {
            chunks.push(chunk);
        });

        stdin.on('end', () => {
            resolve(chunks.join(''));
        });

        stdin.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Main function - parse input and render statusline
 * @returns {Promise<void>}
 * @description Reads JSON from stdin, extracts workspace/model/cost data,
 *   detects git branch, calculates session timer from transcript,
 *   and outputs color-coded status line.
 */
async function main() {
    try {
        // Read and parse JSON input
        const input = await readStdin();
        if (!input.trim()) {
            console.error('No input provided');
            process.exit(1);
        }

        const data = JSON.parse(input);

        // Extract basic information
        let currentDir = 'unknown';
        if (data.workspace?.current_dir) {
            currentDir = data.workspace.current_dir;
        } else if (data.cwd) {
            currentDir = data.cwd;
        }
        currentDir = expandHome(currentDir);

        const modelName = data.model?.display_name || 'Claude';
        const modelVersion = data.model?.version && data.model.version !== 'null' ? data.model.version : '';

        // Git branch detection
        let gitBranch = '';
        const gitCheck = exec('git rev-parse --git-dir');
        if (gitCheck) {
            gitBranch = exec('git branch --show-current');
            if (!gitBranch) {
                gitBranch = exec('git rev-parse --short HEAD');
            }
        }

        // Native Claude Code data integration
        let sessionText = '';
        let sessionPercent = 0;
        let costUSD = '';
        let linesAdded = 0;
        let linesRemoved = 0;
        const billingMode = env.CLAUDE_BILLING_MODE || 'api';

        // Extract native cost data from Claude Code
        costUSD = data.cost?.total_cost_usd || '';
        linesAdded = data.cost?.total_lines_added || 0;
        linesRemoved = data.cost?.total_lines_removed || 0;

        // Session timer - parse local transcript JSONL (zero external dependencies)
        const transcriptPath = data.transcript_path;

        if (transcriptPath) {
            try {
                const fs = require('fs');
                if (fs.existsSync(transcriptPath)) {
                    const content = fs.readFileSync(transcriptPath, 'utf8');
                    const lines = content.split('\n').filter(l => l.trim());

                    // Find first API call with usage data
                    let firstApiCall = null;
                    for (const line of lines) {
                        try {
                            const entry = JSON.parse(line);
                            if (entry.usage && entry.timestamp) {
                                firstApiCall = entry.timestamp;
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    if (firstApiCall) {
                        // Calculate 5-hour billing block (Anthropic windows)
                        const now = new Date();
                        const currentUtcHour = now.getUTCHours();
                        const blockStart = Math.floor(currentUtcHour / 5) * 5;
                        let blockEnd = blockStart + 5;

                        // Handle day wraparound
                        let blockEndDate = new Date(now);
                        if (blockEnd >= 24) {
                            blockEnd -= 24;
                            blockEndDate.setUTCDate(blockEndDate.getUTCDate() + 1);
                        }
                        blockEndDate.setUTCHours(blockEnd, 0, 0, 0);

                        const nowSec = Math.floor(Date.now() / 1000);
                        const blockEndSec = Math.floor(blockEndDate.getTime() / 1000);
                        const remaining = blockEndSec - nowSec;

                        if (remaining > 0 && remaining < 18000) {
                            const rh = Math.floor(remaining / 3600);
                            const rm = Math.floor((remaining % 3600) / 60);
                            const blockEndLocal = formatTimeHM(blockEndSec);
                            sessionText = `${rh}h ${rm}m until reset at ${blockEndLocal}`;
                            sessionPercent = Math.floor((18000 - remaining) * 100 / 18000);
                        }
                    }
                }
            } catch (err) {
                // Silent fail - transcript not readable
            }
        }

        // Render statusline
        let output = '';

        // Directory
        output += `📁 ${DirColor}${currentDir}${Reset}`;

        // Git branch
        if (gitBranch) {
            output += `  🌿 ${GitColor}${gitBranch}${Reset}`;
        }

        // Model
        output += `  🤖 ${ModelColor}${modelName}${Reset}`;

        // Model version
        if (modelVersion) {
            output += `  🏷️ ${VersionColor}${modelVersion}${Reset}`;
        }

        // Session time
        if (sessionText) {
            const sessionColorCode = getSessionColor(sessionPercent);
            output += `  ⌛ ${sessionColorCode}${sessionText}${Reset}`;
        }

        // Cost (only show for API billing mode)
        if (billingMode === 'api' && costUSD && /^\d+(\.\d+)?$/.test(costUSD.toString())) {
            const costUSDNum = parseFloat(costUSD);
            output += `  💵 ${CostColor}$${costUSDNum.toFixed(4)}${Reset}`;
        }

        // Lines changed
        if ((linesAdded > 0 || linesRemoved > 0)) {
            const linesColor = color('1;32');  // green
            output += `  📝 ${linesColor}+${linesAdded} -${linesRemoved}${Reset}`;
        }

        console.log(output);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
