# Tmux Monitoring Setup for Agent Farms

Monitor and manage parallel agent execution with tmux sessions.

## Basic Setup

```bash
#!/bin/bash
# Create monitoring session
SESSION_NAME="agent-farm-$(date +%s)"

# Create session with monitoring layout
tmux new-session -d -s "$SESSION_NAME" -n "monitor"

# Split window for monitoring
tmux split-window -h -t "$SESSION_NAME:monitor"
tmux split-window -v -t "$SESSION_NAME:monitor.0"
tmux split-window -v -t "$SESSION_NAME:monitor.1"

# Pane 0: Agent status dashboard
tmux send-keys -t "$SESSION_NAME:monitor.0" 'watch -n 1 agent-status' C-m

# Pane 1: Resource usage
tmux send-keys -t "$SESSION_NAME:monitor.1" 'htop' C-m

# Pane 2: Logs
tmux send-keys -t "$SESSION_NAME:monitor.2" 'tail -f /tmp/agent-farm.log' C-m

# Pane 3: Control panel
tmux send-keys -t "$SESSION_NAME:monitor.3" 'agent-control' C-m

# Attach to session
tmux attach -t "$SESSION_NAME"
```

## Agent Status Dashboard

```bash
#!/bin/bash
# agent-status - Real-time agent monitoring
AGENT_DIR="/tmp/agents"
REFRESH_INTERVAL=2

while true; do
  clear
  echo "=== Agent Farm Status ==="
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  
  # Count agents by status
  RUNNING=0
  COMPLETED=0
  FAILED=0
  IDLE=0
  
  for agent_dir in "$AGENT_DIR"/*/; do
    [ -d "$agent_dir" ] || continue
    
    agent_id=$(basename "$agent_dir")
    status_file="$agent_dir/status"
    heartbeat_file="$agent_dir/heartbeat"
    
    if [ -f "$status_file" ]; then
      status=$(cat "$status_file")
      
      case "$status" in
        "running")
          # Check heartbeat
          if [ -f "$heartbeat_file" ]; then
            last_beat=$(stat -c %Y "$heartbeat_file")
            now=$(date +%s)
            age=$((now - last_beat))
            
            if [ $age -lt 60 ]; then
              echo "✓ $agent_id: RUNNING (heartbeat ${age}s ago)"
              RUNNING=$((RUNNING + 1))
            else
              echo "⚠ $agent_id: STALE (no heartbeat for ${age}s)"
            fi
          else
            echo "? $agent_id: RUNNING (no heartbeat file)"
            RUNNING=$((RUNNING + 1))
          fi
          ;;
        "completed")
          echo "✓ $agent_id: COMPLETED"
          COMPLETED=$((COMPLETED + 1))
          ;;
        "failed")
          error=$(cat "$agent_dir/error" 2>/dev/null || echo "Unknown error")
          echo "✗ $agent_id: FAILED - $error"
          FAILED=$((FAILED + 1))
          ;;
        *)
          echo "- $agent_id: $status"
          IDLE=$((IDLE + 1))
          ;;
      esac
    fi
  done
  
  echo ""
  echo "Summary: $RUNNING running, $COMPLETED completed, $FAILED failed, $IDLE idle"
  echo "Total: $((RUNNING + COMPLETED + FAILED + IDLE)) agents"
  
  sleep $REFRESH_INTERVAL
done
```

## Agent Control Panel

```bash
#!/bin/bash
# agent-control - Interactive agent management
AGENT_DIR="/tmp/agents"

show_menu() {
  clear
  echo "=== Agent Control Panel ==="
  echo "1. List all agents"
  echo "2. Start new agent"
  echo "3. Stop agent"
  echo "4. Restart failed agents"
  echo "5. View agent logs"
  echo "6. Clean completed agents"
  echo "7. Exit"
  echo ""
  read -p "Select option: " choice
  
  case $choice in
    1) list_agents ;;
    2) start_agent ;;
    3) stop_agent ;;
    4) restart_failed ;;
    5) view_logs ;;
    6) clean_completed ;;
    7) exit 0 ;;
    *) echo "Invalid option"; sleep 1; show_menu ;;
  esac
}

list_agents() {
  clear
  echo "=== Agent List ==="
  for agent_dir in "$AGENT_DIR"/*/; do
    [ -d "$agent_dir" ] || continue
    agent_id=$(basename "$agent_dir")
    status=$(cat "$agent_dir/status" 2>/dev/null || echo "unknown")
    echo "$agent_id: $status"
  done
  echo ""
  read -p "Press Enter to continue..."
  show_menu
}

start_agent() {
  read -p "Agent command: " cmd
  read -p "Agent ID (or auto): " agent_id
  
  if [ "$agent_id" = "auto" ]; then
    agent_id="agent-$(date +%s)-$RANDOM"
  fi
  
  mkdir -p "$AGENT_DIR/$agent_id"
  echo "running" > "$AGENT_DIR/$agent_id/status"
  
  # Start agent in background
  (
    $cmd
    echo $? > "$AGENT_DIR/$agent_id/exit_code"
    if [ $(cat "$AGENT_DIR/$agent_id/exit_code") -eq 0 ]; then
      echo "completed" > "$AGENT_DIR/$agent_id/status"
    else
      echo "failed" > "$AGENT_DIR/$agent_id/status"
    fi
  ) > "$AGENT_DIR/$agent_id/output.log" 2>&1 &
  
  echo "Started agent $agent_id (PID: $!)"
  sleep 2
  show_menu
}

stop_agent() {
  read -p "Agent ID to stop: " agent_id
  
  if [ -f "$AGENT_DIR/$agent_id/pid" ]; then
    pid=$(cat "$AGENT_DIR/$agent_id/pid")
    kill "$pid" 2>/dev/null
    echo "stopped" > "$AGENT_DIR/$agent_id/status"
    echo "Stopped agent $agent_id"
  else
    echo "Agent not found or no PID file"
  fi
  
  sleep 2
  show_menu
}

restart_failed() {
  count=0
  for agent_dir in "$AGENT_DIR"/*/; do
    [ -d "$agent_dir" ] || continue
    agent_id=$(basename "$agent_dir")
    status=$(cat "$agent_dir/status" 2>/dev/null)
    
    if [ "$status" = "failed" ]; then
      echo "Restarting $agent_id..."
      cmd=$(cat "$agent_dir/command" 2>/dev/null)
      if [ -n "$cmd" ]; then
        echo "running" > "$agent_dir/status"
        $cmd > "$agent_dir/output.log" 2>&1 &
        echo $! > "$agent_dir/pid"
        count=$((count + 1))
      fi
    fi
  done
  
  echo "Restarted $count failed agents"
  sleep 2
  show_menu
}

view_logs() {
  read -p "Agent ID: " agent_id
  
  if [ -f "$AGENT_DIR/$agent_id/output.log" ]; then
    less "$AGENT_DIR/$agent_id/output.log"
  else
    echo "No log file found"
    sleep 2
  fi
  
  show_menu
}

clean_completed() {
  count=0
  for agent_dir in "$AGENT_DIR"/*/; do
    [ -d "$agent_dir" ] || continue
    agent_id=$(basename "$agent_dir")
    status=$(cat "$agent_dir/status" 2>/dev/null)
    
    if [ "$status" = "completed" ]; then
      rm -rf "$agent_dir"
      count=$((count + 1))
    fi
  done
  
  echo "Cleaned $count completed agents"
  sleep 2
  show_menu
}

show_menu
```

## Tmux Session Manager

```bash
#!/bin/bash
# Manage multiple tmux sessions for agent farms

create_farm_session() {
  local farm_name=$1
  local agent_count=${2:-5}
  local session="farm-$farm_name"
  
  # Create session
  tmux new-session -d -s "$session" -n "control"
  
  # Create panes for agents
  for ((i=1; i<=agent_count; i++)); do
    if [ $i -eq 1 ]; then
      tmux split-window -v -t "$session:control"
    else
      tmux split-window -h -t "$session:control"
    fi
    
    # Create agent directory
    agent_id="agent-$farm_name-$i"
    mkdir -p "/tmp/agents/$agent_id"
    
    # Start agent in pane
    tmux send-keys -t "$session:control.$i" \
      "run-agent $agent_id" C-m
  done
  
  # Add monitoring window
  tmux new-window -t "$session" -n "monitor"
  tmux send-keys -t "$session:monitor" 'agent-status' C-m
  
  echo "Created farm session: $session"
  echo "Attach with: tmux attach -t $session"
}

list_farms() {
  echo "=== Active Agent Farms ==="
  tmux list-sessions | grep "^farm-" | while read line; do
    session=$(echo "$line" | cut -d: -f1)
    echo "  $session"
  done
}

stop_farm() {
  local farm_name=$1
  local session="farm-$farm_name"
  
  # Kill all agent processes
  for agent_dir in /tmp/agents/agent-$farm_name-*/; do
    [ -d "$agent_dir" ] || continue
    if [ -f "$agent_dir/pid" ]; then
      kill $(cat "$agent_dir/pid") 2>/dev/null
    fi
  done
  
  # Kill tmux session
  tmux kill-session -t "$session" 2>/dev/null
  
  echo "Stopped farm: $farm_name"
}

# Command interface
case "$1" in
  create)
    create_farm_session "$2" "$3"
    ;;
  list)
    list_farms
    ;;
  stop)
    stop_farm "$2"
    ;;
  *)
    echo "Usage: $0 {create|list|stop} [farm_name] [agent_count]"
    ;;
esac
```

## Resource Monitoring

```bash
#!/bin/bash
# Monitor resource usage across agent farm

monitor_resources() {
  local interval=${1:-5}
  
  while true; do
    clear
    echo "=== Resource Monitor ==="
    echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # CPU usage
    echo "CPU Usage:"
    top -bn1 | grep "Cpu(s)" | awk '{print "  " $2 + $4 "% used"}'
    echo ""
    
    # Memory usage
    echo "Memory Usage:"
    free -h | awk '/^Mem:/ {print "  Used: " $3 " / " $2 " (" $3/$2*100 "%)"}'
    echo ""
    
    # Agent resource usage
    echo "Agent Resource Usage:"
    for agent_dir in /tmp/agents/*/; do
      [ -d "$agent_dir" ] || continue
      agent_id=$(basename "$agent_dir")
      
      if [ -f "$agent_dir/pid" ]; then
        pid=$(cat "$agent_dir/pid")
        if ps -p "$pid" > /dev/null 2>&1; then
          cpu=$(ps -p "$pid" -o %cpu= | tr -d ' ')
          mem=$(ps -p "$pid" -o %mem= | tr -d ' ')
          echo "  $agent_id: CPU ${cpu}%, MEM ${mem}%"
        fi
      fi
    done
    
    echo ""
    echo "Press Ctrl+C to exit"
    sleep $interval
  done
}

monitor_resources "$@"
```

## Quick Start

```bash
# 1. Start monitoring session
./agent-farm-monitor.sh

# 2. In another terminal, start agents
./farm-manager.sh create myproject 10

# 3. Monitor progress
tmux attach -t farm-myproject

# 4. Check status
./agent-status

# 5. Clean up when done
./farm-manager.sh stop myproject
```