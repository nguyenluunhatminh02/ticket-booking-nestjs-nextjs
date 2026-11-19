# Parallel Agent Farm Patterns

Execute multiple Claude agents in parallel with coordination, monitoring, and safety mechanisms.

## Core Patterns (20+)

### 1. **Fan-Out/Fan-In Pattern**
```
Master Agent → [Worker1, Worker2, Worker3...] → Aggregator
```
- Master decomposes task into independent subtasks
- Workers execute in parallel
- Aggregator collects and synthesizes results
- Use for: Large codebases, multi-file refactoring

### 2. **Pipeline Pattern**
```
Stage1 → Stage2 → Stage3 → Final
```
- Sequential stages with parallel execution within each stage
- Each stage validates before passing to next
- Use for: Build processes, multi-step transformations

### 3. **Map-Reduce Pattern**
```
Map: [Task1, Task2...] → Reduce: Combine Results
```
- Map phase processes items independently
- Reduce phase aggregates with conflict resolution
- Use for: Bulk operations, batch processing

### 4. **Producer-Consumer Pattern**
```
Producer Queue → [Consumer1, Consumer2...]
```
- Producer generates work items
- Consumers process from shared queue
- Rate limiting prevents overload
- Use for: Continuous processing, streaming tasks

### 5. **Hierarchical Delegation (Shogun/Karo/Ashigaru)**
```
Shogun (Strategic) → Karo (Tactical) → Ashigaru (Execution)
```
- Three-tier hierarchy for complex projects
- Each level has specific responsibilities
- Use for: Large feature development, system integration

### 6. **Lock-Based Coordination**
```bash
# File-based locking
LOCK_FILE="/tmp/agent-farm-lock-$$"
if ! mkdir "$LOCK_FILE" 2>/dev/null; then
  echo "Another agent holds lock"
  exit 1
fi
trap 'rmdir "$LOCK_FILE"' EXIT
```
- Prevents race conditions on shared resources
- Automatic cleanup on exit
- Use for: Database migrations, file operations

### 7. **Semaphore Pattern**
```bash
# Limit concurrent access to N resources
SEMAPHORE_DIR="/tmp/semaphore"
mkdir -p "$SEMAPHORE_DIR"
MAX_CONCURRENT=5

acquire_semaphore() {
  while [ $(ls -1 "$SEMAPHORE_DIR" | wc -l) -ge $MAX_CONCURRENT ]; do
    sleep 0.1
  done
  touch "$SEMAPHORE_DIR/$$"
}

release_semaphore() {
  rm -f "$SEMAPHORE_DIR/$$"
}
```
- Controls concurrent access to limited resources
- Use for: API rate limits, database connections

### 8. **Circuit Breaker Pattern**
```bash
FAILURE_COUNT=0
MAX_FAILURES=3
COOLDOWN=60

execute_with_breaker() {
  if [ $FAILURE_COUNT -ge $MAX_FAILURES ]; then
    echo "Circuit open, waiting ${COOLDOWN}s"
    sleep $COOLDOWN
    FAILURE_COUNT=0
  fi
  
  if "$@"; then
    FAILURE_COUNT=0
  else
    FAILURE_COUNT=$((FAILURE_COUNT + 1))
    return 1
  fi
}
```
- Prevents cascading failures
- Automatic recovery after cooldown
- Use for: External API calls, flaky operations

### 9. **Retry with Exponential Backoff**
```bash
retry_with_backoff() {
  local max_attempts=5
  local delay=1
  local attempt=1
  
  while [ $attempt -le $max_attempts ]; do
    if "$@"; then
      return 0
    fi
    echo "Attempt $attempt failed, retrying in ${delay}s..."
    sleep $delay
    delay=$((delay * 2))
    attempt=$((attempt + 1))
  done
  return 1
}
```
- Handles transient failures gracefully
- Prevents overwhelming failing services
- Use for: Network operations, external services

### 10. **Health Check Pattern**
```bash
check_agent_health() {
  local agent_id=$1
  local heartbeat_file="/tmp/agent-$agent_id.heartbeat"
  
  if [ ! -f "$heartbeat_file" ]; then
    return 1
  fi
  
  local last_update=$(stat -c %Y "$heartbeat_file")
  local now=$(date +%s)
  local age=$((now - last_update))
  
  [ $age -lt 60 ]  # Healthy if updated within 60s
}
```
- Monitors agent liveness
- Detects hung or crashed agents
- Use for: Long-running agent farms

### 11. **Work Stealing Pattern**
```bash
# Agents steal work from busy peers
steal_work() {
  local my_queue="$1"
  local peer_queues=("$@")
  
  for peer in "${peer_queues[@]}"; do
    if [ "$peer" != "$my_queue" ] && [ -f "$peer" ]; then
      local peer_size=$(wc -l < "$peer")
      if [ $peer_size -gt 10 ]; then
        # Steal half the work
        head -n $((peer_size / 2)) "$peer" >> "$my_queue"
        tail -n +$((peer_size / 2 + 1)) "$peer" > "$peer.tmp"
        mv "$peer.tmp" "$peer"
        return 0
      fi
    fi
  done
  return 1
}
```
- Balances load dynamically
- Prevents stragglers
- Use for: Uneven work distributions

### 12. **Checkpoint/Resume Pattern**
```bash
# Save progress for resumable execution
save_checkpoint() {
  local checkpoint_file="/tmp/checkpoint-$$.json"
  cat > "$checkpoint_file" <<EOF
{
  "completed": $COMPLETED,
  "total": $TOTAL,
  "timestamp": $(date +%s),
  "state": "$CURRENT_STATE"
}
EOF
}

load_checkpoint() {
  local checkpoint_file="/tmp/checkpoint-$$.json"
  if [ -f "$checkpoint_file" ]; then
    COMPLETED=$(jq '.completed' "$checkpoint_file")
    CURRENT_STATE=$(jq -r '.state' "$checkpoint_file")
  fi
}
```
- Enables recovery from interruptions
- Tracks progress across restarts
- Use for: Long-running batch jobs

### 13. **Barrier Synchronization**
```bash
# Wait for all agents to reach checkpoint
BARRIER_FILE="/tmp/barrier-$$"
BARRIER_COUNT=10

reach_barrier() {
  touch "$BARRIER_FILE.$$.ready"
  
  while [ $(ls -1 "$BARRIER_FILE"*.ready 2>/dev/null | wc -l) -lt $BARRIER_COUNT ]; do
    sleep 0.5
  done
  
  # All agents arrived, cleanup
  rm -f "$BARRIER_FILE"*.ready
}
```
- Synchronizes parallel agents
- Ensures all reach same point
- Use for: Phase transitions, coordinated actions

### 14. **Message Passing Pattern**
```bash
# Named pipes for inter-agent communication
mkfifo /tmp/agent-channel-$$

send_message() {
  echo "$1" > /tmp/agent-channel-$$
}

receive_message() {
  read msg < /tmp/agent-channel-$$
  echo "$msg"
}
```
- Decoupled communication
- Asynchronous messaging
- Use for: Agent coordination, event distribution

### 15. **Priority Queue Pattern**
```bash
# Process high-priority tasks first
PRIORITY_QUEUE="/tmp/priority-queue"

enqueue() {
  local priority=$1
  local task=$2
  echo "$priority|$task" >> "$PRIORITY_QUEUE"
  sort -n "$PRIORITY_QUEUE" -o "$PRIORITY_QUEUE"
}

dequeue() {
  head -n 1 "$PRIORITY_QUEUE" | cut -d'|' -f2-
  tail -n +2 "$PRIORITY_QUEUE" > "$PRIORITY_QUEUE.tmp"
  mv "$PRIORITY_QUEUE.tmp" "$PRIORITY_QUEUE"
}
```
- Handles urgent tasks first
- Prevents starvation
- Use for: Mixed-priority workloads

### 16. **Scatter-Gather Pattern**
```bash
# Distribute work, collect results
scatter() {
  local items=("$@")
  for item in "${items[@]}"; do
    echo "$item" > "/tmp/scatter-$$-$RANDOM"
  done
}

gather() {
  local results=()
  for file in /tmp/scatter-$$-*; do
    results+=("$(cat "$file")")
    rm "$file"
  done
  printf '%s\n' "${results[@]}"
}
```
- Parallel distribution
- Centralized collection
- Use for: Parallel searches, distributed computation

### 17. **Blackboard Pattern**
```bash
# Shared knowledge base
BLACKBOARD="/tmp/blackboard-$$"
touch "$BLACKBOARD"

write_to_blackboard() {
  local key=$1
  local value=$2
  echo "$key=$value" >> "$BLACKBOARD"
}

read_from_blackboard() {
  local key=$1
  grep "^$key=" "$BLACKBOARD" | cut -d'=' -f2-
}
```
- Shared state management
- Collaborative problem solving
- Use for: Multi-agent reasoning, shared context

### 18. **Supervisor Pattern**
```bash
# Monitor and restart failed agents
supervise() {
  local agent_cmd="$1"
  local agent_id=$2
  
  while true; do
    echo "Starting agent $agent_id"
    $agent_cmd &
    local pid=$!
    wait $pid
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
      echo "Agent $agent_id failed, restarting in 5s..."
      sleep 5
    else
      echo "Agent $agent_id completed successfully"
      break
    fi
  done
}
```
- Automatic recovery
- Continuous operation
- Use for: Critical long-running agents

### 19. **Timeout Pattern**
```bash
# Prevent hung operations
execute_with_timeout() {
  local timeout=$1
  shift
  
  timeout $timeout "$@"
  local exit_code=$?
  
  if [ $exit_code -eq 124 ]; then
    echo "Operation timed out after ${timeout}s"
    return 1
  fi
  return $exit_code
}
```
- Prevents indefinite hangs
- Resource protection
- Use for: External calls, untrusted operations

### 20. **Idempotent Operations**
```bash
# Ensure operations can be safely retried
idempotent_migrate() {
  local migration_id=$1
  local marker="/tmp/migration-$migration_id.done"
  
  if [ -f "$marker" ]; then
    echo "Migration $migration_id already completed"
    return 0
  fi
  
  # Perform migration
  perform_migration "$migration_id"
  
  # Mark as complete
  touch "$marker"
}
```
- Safe retries
- Prevents duplicate work
- Use for: Database migrations, state changes

### 21. **Distributed Lock Manager**
```bash
# Centralized lock service
LOCK_SERVER="/tmp/lock-server"
mkfifo "$LOCK_SERVER"

# Server loop (run in background)
lock_server() {
  declare -A locks
  while read request; do
    local action=$(echo "$request" | cut -d'|' -f1)
    local resource=$(echo "$request" | cut -d'|' -f2)
    local client=$(echo "$request" | cut -d'|' -f3)
    
    case $action in
      ACQUIRE)
        if [ -z "${locks[$resource]}" ]; then
          locks[$resource]=$client
          echo "GRANTED" ;;
        else
          echo "DENIED" ;;
        fi
        ;;
      RELEASE)
        unset locks[$resource]
        echo "RELEASED" ;;
    esac
  done < "$LOCK_SERVER"
}
```
- Centralized coordination
- Prevents deadlocks
- Use for: Complex resource management

### 22. **Consensus Pattern**
```bash
# Achieve agreement among agents
propose() {
  local proposal=$1
  echo "$proposal" > "/tmp/proposal-$$"
  
  # Collect votes
  local votes=0
  local total_agents=5
  
  while [ $votes -lt $((total_agents / 2 + 1)) ]; do
    votes=$(ls -1 /tmp/vote-$$-* 2>/dev/null | wc -l)
    sleep 1
  done
  
  echo "Consensus reached"
}

vote() {
  local proposal_id=$1
  local vote=$2
  echo "$vote" > "/tmp/vote-$proposal_id-$$"
}
```
- Distributed decision making
- Fault tolerance
- Use for: Multi-agent decisions, consensus protocols

## Best Practices

### Safety
1. **Always use locks** for shared resources
2. **Implement timeouts** to prevent hangs
3. **Use circuit breakers** for external calls
4. **Checkpoint frequently** for long operations
5. **Validate inputs** at agent boundaries

### Performance
1. **Limit concurrency** to avoid resource exhaustion
2. **Use work stealing** for load balancing
3. **Batch operations** when possible
4. **Monitor resource usage** continuously
5. **Clean up resources** on exit

### Monitoring
1. **Heartbeat regularly** for health checks
2. **Log all operations** for debugging
3. **Track metrics** (throughput, latency, errors)
4. **Alert on failures** immediately
5. **Review logs** after completion

### Error Handling
1. **Retry transient failures** with backoff
2. **Fail fast** on permanent errors
3. **Isolate failures** to prevent cascading
4. **Graceful degradation** when possible
5. **Clear error messages** for debugging

## Next Steps
- See `agent-farm-tmux.md` for monitoring setup
- See `agent-farm-locks.md` for coordination details
- See `agent-farm-sweeps.md` for automation patterns
