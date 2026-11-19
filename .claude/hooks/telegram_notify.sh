#!/bin/bash
#
# telegram_notify.sh - Telegram notification hook for Claude Code events
#
# PURPOSE:
# Sends formatted notifications to Telegram when Claude Code sessions complete,
# subagents finish, or other events occur. Provides session analytics in Markdown.
#
# WHY THIS SCRIPT:
# - Alternative to Discord notifications for teams using Telegram
# - Formats messages as Telegram Markdown for rich display
# - Handles multiple event types (Stop, SubagentStop, generic events)
#
# INPUT FORMAT (via stdin):
#   JSON object from Claude Code hook system:
#   {
#     "hookType": "Stop" | "SubagentStop" | "Other",
#     "projectDir": "/path/to/project",
#     "sessionId": "abc123",
#     "toolsUsed": [{"tool": "Write", "parameters": {...}}, ...]
#   }
#
# ENVIRONMENT VARIABLES:
#   TELEGRAM_BOT_TOKEN - Telegram bot API token (required)
#   TELEGRAM_CHAT_ID - Telegram chat/group ID to send to (required)
#   Loaded from (priority order):
#   1. Process environment (highest)
#   2. .claude/.env
#   3. .claude/hooks/.env (lowest)
#
# EVENT TYPES HANDLED:
#   1. Stop - Session completed
#      - Shows: tools used (with counts), files modified, session time
#      - Format: Markdown with code blocks
#   2. SubagentStop - Specialized agent completed
#      - Shows: agent type, session time
#   3. Other - Generic event
#      - Shows: event type, session time
#
# TELEGRAM MESSAGE FORMAT:
#   Header: "🚀 *DevPocket Task Completed*" (or similar)
#   Fields:
#     * Time (timestamp)
#     * Project (name)
#     * Total Operations (tool count)
#     * Session (first 8 chars of ID)
#     * Tools Used (code block with counts)
#     * Files Modified (bullet list with relative paths)
#     * Location (project directory)
#
# EXIT CODES:
#   0 - Notification sent successfully
#   1 - Error (missing env vars or send failure)
#
# USAGE:
#   Configured in .claude/settings.json:
#   "hooks": {
#     "Stop": [{"hook": "bash .claude/hooks/telegram_notify.sh"}],
#     "SubagentStop": [{"hook": "bash .claude/hooks/telegram_notify.sh"}]
#   }
#
# SETUP:
#   1. Create Telegram bot via @BotFather
#   2. Get bot token and set TELEGRAM_BOT_TOKEN
#   3. Get chat ID (use @userinfobot or check bot updates)
#   4. Set TELEGRAM_CHAT_ID
#
# NOTES:
#   - Fails if TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set (exit 1)
#   - Uses jq for safe JSON construction (prevents injection)
#   - Disables web page previews to reduce noise
#   - Converts absolute paths to relative for readability
#

set -euo pipefail

# Load environment variables with priority: process.env > .claude/.env > .claude/hooks/.env
load_env() {
    # 1. Start with lowest priority: .claude/hooks/.env
    if [[ -f "$(dirname "$0")/.env" ]]; then
        set -a
        source "$(dirname "$0")/.env"
        set +a
    fi

    # 2. Override with .claude/.env
    if [[ -f .claude/.env ]]; then
        set -a
        source .claude/.env
        set +a
    fi

    # 3. Process env (already loaded) has highest priority - no action needed
    # Variables already in process.env will not be overwritten by 'source'
}

load_env

# Read JSON input from stdin
INPUT=$(cat)

# Extract relevant information from the hook input
HOOK_TYPE=$(echo "$INPUT" | jq -r '.hookType // "unknown"')
PROJECT_DIR=$(echo "$INPUT" | jq -r '.projectDir // ""')
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
SESSION_ID=$(echo "$INPUT" | jq -r '.sessionId // ""')
PROJECT_NAME=$(basename "$PROJECT_DIR")

# Configuration - these will be set via environment variables
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# Validate required environment variables
if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
    echo "Error: TELEGRAM_BOT_TOKEN environment variable not set" >&2
    exit 1
fi

if [[ -z "$TELEGRAM_CHAT_ID" ]]; then
    echo "Error: TELEGRAM_CHAT_ID environment variable not set" >&2
    exit 1
fi

# Function to send Telegram message
send_telegram_message() {
    local message="$1"
    local url="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"

    # Use jq to safely build JSON payload
    local payload=$(jq -n \
        --arg chat_id "${TELEGRAM_CHAT_ID}" \
        --arg text "$message" \
        '{
            "chat_id": $chat_id,
            "text": $text,
            "parse_mode": "Markdown",
            "disable_web_page_preview": true
        }')

    curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$url" > /dev/null
}

# Generate summary based on hook type
case "$HOOK_TYPE" in
    "Stop")
        # Extract tool usage summary
        TOOLS_USED=$(echo "$INPUT" | jq -r '.toolsUsed[]?.tool // empty' | sort | uniq -c | sort -nr)
        FILES_MODIFIED=$(echo "$INPUT" | jq -r '.toolsUsed[]? | select(.tool == "Edit" or .tool == "Write" or .tool == "MultiEdit") | .parameters.file_path // empty' | sort | uniq)
        
        # Count operations
        TOTAL_TOOLS=$(echo "$INPUT" | jq '.toolsUsed | length')
        
        # Build summary message
        MESSAGE="🚀 *DevPocket Task Completed*
        
📅 *Time:* ${TIMESTAMP}
📁 *Project:* ${PROJECT_NAME}
🔧 *Total Operations:* ${TOTAL_TOOLS}
🆔 *Session:* ${SESSION_ID:0:8}...

*Tools Used:*"

        if [[ -n "$TOOLS_USED" ]]; then
            MESSAGE="${MESSAGE}
\`\`\`
${TOOLS_USED}
\`\`\`"
        else
            MESSAGE="${MESSAGE}
None"
        fi

        if [[ -n "$FILES_MODIFIED" ]]; then
            MESSAGE="${MESSAGE}

*Files Modified:*"
            while IFS= read -r file; do
                if [[ -n "$file" ]]; then
                    # Show relative path from project root
                    relative_file=$(echo "$file" | sed "s|^${PROJECT_DIR}/||")
                    MESSAGE="${MESSAGE}
• ${relative_file}"
                fi
            done <<< "$FILES_MODIFIED"
        fi
        
        MESSAGE="${MESSAGE}

📍 *Location:* \`${PROJECT_DIR}\`"
        ;;
        
    "SubagentStop")
        SUBAGENT_TYPE=$(echo "$INPUT" | jq -r '.subagentType // "unknown"')
        MESSAGE="🤖 *DevPocket Subagent Completed*

📅 *Time:* ${TIMESTAMP}
📁 *Project:* ${PROJECT_NAME}
🔧 *Agent Type:* ${SUBAGENT_TYPE}
🆔 *Session:* ${SESSION_ID:0:8}...

Specialized agent completed its task.

📍 *Location:* \`${PROJECT_DIR}\`"
        ;;
        
    *)
        MESSAGE="📝 *DevPocket Code Event*

📅 *Time:* ${TIMESTAMP}
📁 *Project:* ${PROJECT_NAME}
📋 *Event:* ${HOOK_TYPE}
🆔 *Session:* ${SESSION_ID:0:8}...

📍 *Location:* \`${PROJECT_DIR}\`"
        ;;
esac

# Send the notification
send_telegram_message "$MESSAGE"

# Log the notification (optional)
echo "Telegram notification sent for $HOOK_TYPE event in project $PROJECT_NAME" >&2