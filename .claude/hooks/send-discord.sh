#!/bin/bash
#
# send-discord.sh - Simple Discord notification sender
#
# PURPOSE:
# Sends a text message to Discord via webhook. Used by other hooks to notify
# team members when Claude Code completes tasks or encounters issues.
#
# WHY THIS SCRIPT:
# - Provides reusable Discord notification function for all hooks
# - Handles environment variable loading with priority chain
# - Formats messages as Discord embeds for rich display
#
# INPUT:
#   $1 - Message text to send (required)
#
# ENVIRONMENT VARIABLES:
#   DISCORD_WEBHOOK_URL - Discord webhook URL (required)
#   Loaded from (priority order):
#   1. Process environment (highest)
#   2. .claude/.env
#   3. .claude/hooks/.env (lowest)
#
# OUTPUT:
#   Sends POST request to Discord webhook
#   Prints success/failure message to stdout
#
# EXIT CODES:
#   0 - Message sent successfully
#   1 - Failed to send or DISCORD_WEBHOOK_URL not set
#
# USAGE:
#   ./send-discord.sh "Task completed successfully"
#   ./send-discord.sh "Error: Build failed"
#
# DISCORD EMBED FORMAT:
#   - Title: "🤖 Claude Code Session Complete"
#   - Description: Your message
#   - Color: Blue (5763719)
#   - Fields: Session time, project name
#   - Footer: "DevPocket API • <project-name>"
#
# NOTES:
#   - Message should be escaped if it contains special characters
#   - Discord markdown is supported in message text
#   - Timestamp is automatically added in UTC
#

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

message="$1"
    
if [[ -z "$DISCORD_WEBHOOK_URL" ]]; then
    echo "⚠️  Discord notification skipped: DISCORD_WEBHOOK_URL not set"
    exit 1
fi

# Prepare message for Discord (Discord markdown supports \n)
discord_message="$message"

# Discord embeds for richer formatting - use jq to safely build JSON
payload=$(jq -n \
  --arg description "$discord_message" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
  --arg footer "DevPocket API • $(basename "$(pwd)")" \
  --arg session_time "$(date '+%H:%M:%S')" \
  --arg project "$(basename "$(pwd)")" \
  '{
    "embeds": [{
      "title": "🤖 Claude Code Session Complete",
      "description": $description,
      "color": 5763719,
      "timestamp": $timestamp,
      "footer": {
        "text": $footer
      },
      "fields": [
        {
          "name": "⏰ Session Time",
          "value": $session_time,
          "inline": true
        },
        {
          "name": "📂 Project",
          "value": $project,
          "inline": true
        }
      ]
    }]
  }')

curl -s -X POST "$DISCORD_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$payload" >/dev/null 2>&1

if [[ $? -eq 0 ]]; then
    echo "✅ Discord notification sent"
else
    echo "❌ Failed to send Discord notification"
    exit 1
fi