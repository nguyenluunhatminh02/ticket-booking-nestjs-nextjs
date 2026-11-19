# Best Practices Sweeps Automation

Automated quality checks, validation, and optimization for agent farms.

## Pre-Flight Checks

```bash
#!/bin/bash
# pre-flight-check.sh - Validate environment before starting agent farm

set -e

echo "=== Pre-Flight Checks ==="

# Check disk space
AVAILABLE_GB=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ $AVAILABLE_GB -lt 10 ]; then
  echo "✗ Insufficient disk space: ${AVAILABLE_GB}GB available (need 10GB+)"
  exit 1
fi
echo "✓ Disk space: ${AVAILABLE_GB}GB available"

# Check memory
AVAILABLE_MEM=$(free -g | awk '/^Mem:/ {print $7}')
if [ $AVAILABLE_MEM -lt 4 ]; then
  echo "✗ Insufficient memory: ${AVAILABLE_MEM}GB available (need 4GB+)"
  exit 1
fi
echo "✓ Memory: ${AVAILABLE_MEM}GB available"

# Check CPU cores
CPU_CORES=$(nproc)
if [ $CPU_CORES -lt 4 ]; then
  echo "⚠ Low CPU count: $CPU_CORES cores (recommend 4+)"
else
  echo "✓ CPU cores: $CPU_CORES"
fi

# Check required tools
for tool in tmux jq curl git; do
  if ! command -v $tool &> /dev/null; then
    echo "✗ Missing required tool: $tool"
    exit 1
  fi
done
echo "✓ All required tools installed"

# Check for stale locks
STALE_LOCKS=$(find /tmp/agent-locks -name "*.lock" -mmin +60 2>/dev/null | wc -l)
if [ $STALE_LOCKS -gt 0 ]; then
  echo "⚠ Found $STALE_LOCKS stale locks (older than 60 minutes)"
  read -p "Clean stale locks? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    find /tmp/agent-locks -name "*.lock" -mmin +60 -exec rm -rf {} \;
    echo "✓ Cleaned stale locks"
  fi
else
  echo "✓ No stale locks"
fi

# Check for running agents
RUNNING_AGENTS=$(find /tmp/agents -name "status" -exec grep -l "running" {} \; 2>/dev/null | wc -l)
if [ $RUNNING_AGENTS -gt 0 ]; then
  echo "⚠ Found $RUNNING_AGENTS running agents"
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
else
  echo "✓ No running agents"
fi

echo ""
echo "=== All checks passed ==="
```

## Code Quality Sweeps

```bash
#!/bin/bash
# code-quality-sweep.sh - Automated code quality checks across agents

SWEEP_DIR="/tmp/sweeps/$(date +%s)"
mkdir -p "$SWEEP_DIR"

echo "=== Code Quality Sweep ==="
echo "Results directory: $SWEEP_DIR"

# Run linting
echo "Running linters..."
(
  cd /home/kronosss2002/Desktop/gamedb
  
  # ESLint for JavaScript/TypeScript
  if [ -f "package.json" ]; then
    npm run lint 2>&1 | tee "$SWEEP_DIR/lint.log"
  fi
  
  # Pylint for Python
  if find . -name "*.py" | grep -q .; then
    pylint **/*.py 2>&1 | tee "$SWEEP_DIR/pylint.log" || true
  fi
)

# Run tests
echo "Running tests..."
(
  cd /home/kronosss2002/Desktop/gamedb
  
  if [ -f "package.json" ] && grep -q '"test"' package.json; then
    npm test 2>&1 | tee "$SWEEP_DIR/test.log"
  elif [ -f "pytest.ini" ] || find . -name "test_*.py" | grep -q .; then
    pytest 2>&1 | tee "$SWEEP_DIR/pytest.log" || true
  fi
)

# Check for security issues
echo "Running security checks..."
(
  cd /home/kronosss2002/Desktop/gamedb
  
  # npm audit for Node.js
  if [ -f "package-lock.json" ]; then
    npm audit 2>&1 | tee "$SWEEP_DIR/security.log" || true
  fi
  
  # Check for secrets
  if command -v trufflehog &> /dev/null; then
    trufflehog filesystem . 2>&1 | tee "$SWEEP_DIR/secrets.log" || true
  fi
)

# Generate summary
echo ""
echo "=== Sweep Summary ==="
echo "Lint: $(grep -c "error" "$SWEEP_DIR/lint.log" 2>/dev/null || echo 0) errors"
echo "Tests: $(grep -c "FAIL" "$SWEEP_DIR/test.log" 2>/dev/null || echo 0) failures"
echo "Security: $(grep -c "vulnerability" "$SWEEP_DIR/security.log" 2>/dev/null || echo 0) issues"
echo ""
echo "Full results in: $SWEEP_DIR"
```

## Performance Monitoring Sweep

```bash
#!/bin/bash
# performance-sweep.sh - Monitor and optimize agent performance

INTERVAL=${1:-30}  # Check every 30 seconds
DURATION=${2:-3600}  # Run for 1 hour

echo "=== Performance Monitoring Sweep ==="
echo "Interval: ${INTERVAL}s, Duration: ${DURATION}s"

START_TIME=$(date +%s)
END_TIME=$((START_TIME + DURATION))

while [ $(date +%s) -lt $END_TIME ]; do
  TIMESTAMP=$(date +%s)
  REPORT_FILE="/tmp/sweeps/perf-$TIMESTAMP.json"
  
  # Collect metrics
  cat > "$REPORT_FILE" <<EOF
{
  "timestamp": $TIMESTAMP,
  "agents": {
EOF
  
  # Agent metrics
  first=true
  for agent_dir in /tmp/agents/*/; do
    [ -d "$agent_dir" ] || continue
    agent_id=$(basename "$agent_dir")
    
    if [ -f "$agent_dir/pid" ]; then
      pid=$(cat "$agent_dir/pid")
      if ps -p "$pid" > /dev/null 2>&1; then
        cpu=$(ps -p "$pid" -o %cpu= | tr -d ' ')
        mem=$(ps -p "$pid" -o %mem= | tr -d ' ')
        rss=$(ps -p "$pid" -o rss= | tr -d ' ')
        
        [ "$first" = true ] || echo "," >> "$REPORT_FILE"
        first=false
        
        cat >> "$REPORT_FILE" <<EOF
    "$agent_id": {
      "cpu": $cpu,
      "mem": $mem,
      "rss": $rss
    }
EOF
      fi
    fi
  done
  
  cat >> "$REPORT_FILE" <<EOF
  },
  "system": {
    "cpu_total": $(top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}'),
    "mem_used_gb": $(free -g | awk '/^Mem:/ {print $3}'),
    "load_avg": $(uptime | awk -F'load average:' '{print $2}' | tr -d ' ')
  }
}
EOF
  
  # Check for performance issues
  HIGH_CPU=$(jq '[.agents[].cpu] | map(select(. > 80)) | length' "$REPORT_FILE")
  HIGH_MEM=$(jq '[.agents[].mem] | map(select(. > 50)) | length' "$REPORT_FILE")
  
  if [ $HIGH_CPU -gt 0 ] || [ $HIGH_MEM -gt 0 ]; then
    echo "⚠ Performance alert at $(date): $HIGH_CPU high CPU, $HIGH_MEM high memory agents"
    echo "  Details: $REPORT_FILE"
  fi
  
  sleep $INTERVAL
done

echo "=== Sweep Complete ==="
echo "Reports saved to: /tmp/sweeps/perf-*.json"
```

## Automated Recovery Sweep

```bash
#!/bin/bash
# recovery-sweep.sh - Automatically detect and recover from failures

MAX_RETRIES=3
RETRY_DELAY=60

echo "=== Recovery Sweep ==="

# Find failed agents
for agent_dir in /tmp/agents/*/; do
  [ -d "$agent_dir" ] || continue
  agent_id=$(basename "$agent_dir")
  
  status_file="$agent_dir/status"
  [ -f "$status_file" ] || continue
  
  status=$(cat "$status_file")
  
  case "$status" in
    "failed")
      echo "Detected failed agent: $agent_id"
      
      # Check retry count
      retry_file="$agent_dir/retry_count"
      retry_count=0
      [ -f "$retry_file" ] && retry_count=$(cat "$retry_file")
      
      if [ $retry_count -ge $MAX_RETRIES ]; then
        echo "  ✗ Max retries ($MAX_RETRIES) exceeded, skipping"
        continue
      fi
      
      # Attempt recovery
      echo "  Attempting recovery (retry $((retry_count + 1))/$MAX_RETRIES)..."
      
      # Get original command
      cmd_file="$agent_dir/command"
      if [ -f "$cmd_file" ]; then
        cmd=$(cat "$cmd_file")
        
        # Reset status
        echo "running" > "$status_file"
        echo $((retry_count + 1)) > "$retry_file"
        
        # Restart agent
        $cmd > "$agent_dir/output.log" 2>&1 &
        echo $! > "$agent_dir/pid"
        
        echo "  ✓ Restarted agent (PID: $!)"
      else
        echo "  ✗ No command file found, cannot recover"
      fi
      ;;
      
    "running")
      # Check for stale agents
      heartbeat_file="$agent_dir/heartbeat"
      if [ -f "$heartbeat_file" ]; then
        last_beat=$(stat -c %Y "$heartbeat_file")
        now=$(date +%s)
        age=$((now - last_beat))
        
        if [ $age -gt 300 ]; then  # 5 minutes
          echo "⚠ Stale agent detected: $agent_id (no heartbeat for ${age}s)"
          
          # Kill and restart
          if [ -f "$agent_dir/pid" ]; then
            pid=$(cat "$agent_dir/pid")
            kill "$pid" 2>/dev/null
            sleep 2
            kill -9 "$pid" 2>/dev/null
          fi
          
          echo "  Restarting stale agent..."
          cmd=$(cat "$agent_dir/command" 2>/dev/null)
          if [ -n "$cmd" ]; then
            echo "running" > "$status_file"
            $cmd > "$agent_dir/output.log" 2>&1 &
            echo $! > "$agent_dir/pid"
            echo "  ✓ Restarted (PID: $!)"
          fi
        fi
      fi
      ;;
  esac
done

echo "=== Recovery Sweep Complete ==="
```

## Resource Cleanup Sweep

```bash
#!/bin/bash
# cleanup-sweep.sh - Clean up resources from completed agents

echo "=== Resource Cleanup Sweep ==="

cleaned=0

for agent_dir in /tmp/agents/*/; do
  [ -d "$agent_dir" ] || continue
  agent_id=$(basename "$agent_dir")
  
  status_file="$agent_dir/status"
  [ -f "$status_file" ] || continue
  
  status=$(cat "$status_file")
  
  case "$status" in
    "completed")
      # Clean up completed agents older than 1 hour
      if [ -f "$agent_dir/completed_at" ]; then
        completed_at=$(cat "$agent_dir/completed_at")
        now=$(date +%s)
        age=$((now - completed_at))
        
        if [ $age -gt 3600 ]; then
          echo "Cleaning completed agent: $agent_id (age: ${age}s)"
          rm -rf "$agent_dir"
          cleaned=$((cleaned + 1))
        fi
      else
        # Mark completion time
        date +%s > "$agent_dir/completed_at"
      fi
      ;;
      
    "failed")
      # Keep failed agents for debugging, but clean old logs
      if [ -f "$agent_dir/failed_at" ]; then
        failed_at=$(cat "$agent_dir/failed_at")
        now=$(date +%s)
        age=$((now - failed_at))
        
        if [ $age -gt 86400 ]; then  # 24 hours
          echo "Cleaning old failed agent: $agent_id (age: ${age}s)"
          rm -rf "$agent_dir"
          cleaned=$((cleaned + 1))
        fi
      else
        date +%s > "$agent_dir/failed_at"
      fi
      ;;
  esac
done

# Clean up temporary files
echo "Cleaning temporary files..."
find /tmp/agent-locks -name "*.lock" -mmin +60 -exec rm -rf {} \; 2>/dev/null
find /tmp/agent-semaphores -type f -mmin +30 -delete 2>/dev/null
find /tmp/sweeps -type f -mtime +7 -delete 2>/dev/null

echo "=== Cleanup Complete ==="
echo "Cleaned $cleaned agent directories"
```

## Scheduled Sweeps with Cron

```bash
#!/bin/bash
# setup-sweeps.sh - Configure automated sweeps with cron

echo "=== Setting Up Automated Sweeps ==="

# Create sweep scripts directory
SWEEP_DIR="$HOME/.agent-farm/sweeps"
mkdir -p "$SWEEP_DIR"

# Copy sweep scripts
cp /path/to/code-quality-sweep.sh "$SWEEP_DIR/"
cp /path/to/performance-sweep.sh "$SWEEP_DIR/"
cp /path/to/recovery-sweep.sh "$SWEEP_DIR/"
cp /path/to/cleanup-sweep.sh "$SWEEP_DIR/"

chmod +x "$SWEEP_DIR"/*.sh

# Create crontab entries
CRON_FILE="/tmp/agent-farm-cron"
cat > "$CRON_FILE" <<EOF
# Code quality sweep every 6 hours
0 */6 * * * $SWEEP_DIR/code-quality-sweep.sh >> /tmp/sweeps/cron.log 2>&1

# Performance monitoring every 5 minutes
*/5 * * * * $SWEEP_DIR/performance-sweep.sh 60 300 >> /tmp/sweeps/perf-cron.log 2>&1

# Recovery sweep every 10 minutes
*/10 * * * * $SWEEP_DIR/recovery-sweep.sh >> /tmp/sweeps/recovery-cron.log 2>&1

# Cleanup sweep daily at 2 AM
0 2 * * * $SWEEP_DIR/cleanup-sweep.sh >> /tmp/sweeps/cleanup-cron.log 2>&1
EOF

# Install crontab
crontab "$CRON_FILE"
rm "$CRON_FILE"

echo "✓ Installed automated sweeps"
echo ""
echo "Current crontab:"
crontab -l | grep "agent-farm"
echo ""
echo "Logs will be written to /tmp/sweeps/"
```

## Usage Examples

```bash
# Run pre-flight checks
./pre-flight-check.sh

# Run code quality sweep
./code-quality-sweep.sh

# Monitor performance for 1 hour
./performance-sweep.sh 30 3600

# Run recovery sweep
./recovery-sweep.sh

# Clean up old agents
./cleanup-sweep.sh

# Set up automated sweeps
./setup-sweeps.sh
```

## Integration with Agent Farm

```bash
#!/bin/bash
# integrated-farm-runner.sh - Complete agent farm with sweeps

# Pre-flight checks
./pre-flight-check.sh || exit 1

# Start agent farm
./farm-manager.sh create myproject 10

# Set up monitoring
./agent-farm-tmux.sh

# Run initial quality sweep
./code-quality-sweep.sh

# Start automated sweeps in background
(
  while true; do
    ./recovery-sweep.sh
    sleep 600  # Every 10 minutes
  done
) &
RECOVERY_PID=$!

(
  while true; do
    ./cleanup-sweep.sh
    sleep 86400  # Daily
  done
) &
CLEANUP_PID=$!

echo "Agent farm running with automated sweeps"
echo "Recovery sweep PID: $RECOVERY_PID"
echo "Cleanup sweep PID: $CLEANUP_PID"
echo ""
echo "Press Ctrl+C to stop farm and sweeps"

trap 'kill $RECOVERY_PID $CLEANUP_PID 2>/dev/null; ./farm-manager.sh stop myproject' EXIT

wait
```