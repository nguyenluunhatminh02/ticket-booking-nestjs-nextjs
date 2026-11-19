# Lock-Based Coordination for Agent Farms

Detailed patterns for safe concurrent execution with file-based locks.

## Lock Types

### 1. Exclusive Lock (Mutex)
```bash
#!/bin/bash
# Exclusive lock - only one agent at a time
LOCK_DIR="/tmp/agent-locks"
RESOURCE_NAME="database-migration"
LOCK_FILE="$LOCK_DIR/$RESOURCE_NAME.lock"

mkdir -p "$LOCK_DIR"

acquire_exclusive_lock() {
  local timeout=${1:-30}
  local start_time=$(date +%s)
  
  while ! mkdir "$LOCK_FILE" 2>/dev/null; do
    local now=$(date +%s)
    local elapsed=$((now - start_time))
    
    if [ $elapsed -ge $timeout ]; then
      echo "Failed to acquire lock after ${timeout}s"
      return 1
    fi
    
    sleep 0.1
  done
  
  # Store lock metadata
  echo "$$" > "$LOCK_FILE/pid"
  echo "$(date +%s)" > "$LOCK_DIR/$RESOURCE_NAME.timestamp"
  return 0
}

release_exclusive_lock() {
  rm -rf "$LOCK_FILE"
}

# Cleanup on exit
trap 'release_exclusive_lock' EXIT

# Usage
if acquire_exclusive_lock 30; then
  echo "Lock acquired, performing critical operation"
  # Critical section here
  release_exclusive_lock
fi
```

### 2. Read-Write Lock
```bash
#!/bin/bash
# Multiple readers OR single writer
LOCK_DIR="/tmp/agent-rwlocks"
RESOURCE="shared-config"
READERS_DIR="$LOCK_DIR/$RESOURCE.readers"
WRITER_FILE="$LOCK_DIR/$RESOURCE.writer"

mkdir -p "$READERS_DIR"

acquire_read_lock() {
  local timeout=${1:-30}
  local start_time=$(date +%s)
  
  # Wait for writer to release
  while [ -d "$WRITER_FILE" ]; do
    local now=$(date +%s)
    if [ $((now - start_time)) -ge $timeout ]; then
      return 1
    fi
    sleep 0.1
  done
  
  # Register as reader
  touch "$READERS_DIR/$$"
  return 0
}

release_read_lock() {
  rm -f "$READERS_DIR/$$"
}

acquire_write_lock() {
  local timeout=${1:-30}
  local start_time=$(date +%s)
  
  # Wait for exclusive access
  while ! mkdir "$WRITER_FILE" 2>/dev/null; do
    local now=$(date +%s)
    if [ $((now - start_time)) -ge $timeout ]; then
      return 1
    fi
    sleep 0.1
  done
  
  # Wait for all readers to finish
  while [ $(ls -1 "$READERS_DIR" 2>/dev/null | wc -l) -gt 0 ]; do
    local now=$(date +%s)
    if [ $((now - start_time)) -ge $timeout ]; then
      rmdir "$WRITER_FILE" 2>/dev/null
      return 1
    fi
    sleep 0.1
  done
  
  return 0
}

release_write_lock() {
  rmdir "$WRITER_FILE" 2>/dev/null
}
```

### 3. Semaphore (Limited Concurrency)
```bash
#!/bin/bash
# Allow N concurrent accesses
SEMAPHORE_DIR="/tmp/agent-semaphores"
RESOURCE="api-connections"
MAX_CONCURRENT=5

mkdir -p "$SEMAPHORE_DIR/$RESOURCE"

acquire_semaphore() {
  local timeout=${1:-60}
  local start_time=$(date +%s)
  
  while true; do
    local current=$(ls -1 "$SEMAPHORE_DIR/$RESOURCE" 2>/dev/null | wc -l)
    
    if [ $current -lt $MAX_CONCURRENT ]; then
      touch "$SEMAPHORE_DIR/$RESOURCE/$$"
      return 0
    fi
    
    local now=$(date +%s)
    if [ $((now - start_time)) -ge $timeout ]; then
      return 1
    fi
    
    sleep 0.2
  done
}

release_semaphore() {
  rm -f "$SEMAPHORE_DIR/$RESOURCE/$$"
}

trap 'release_semaphore' EXIT

# Usage
if acquire_semaphore 30; then
  # Access limited resource
  release_semaphore
fi
```

## Stale Lock Detection

```bash
#!/bin/bash
# Detect and clean stale locks
LOCK_DIR="/tmp/agent-locks"
MAX_LOCK_AGE=300  # 5 minutes

clean_stale_locks() {
  local now=$(date +%s)
  
  for lock_dir in "$LOCK_DIR"/*.lock; do
    [ -d "$lock_dir" ] || continue
    
    local timestamp_file="${lock_dir%.lock}.timestamp"
    local pid_file="$lock_dir/pid"
    
    if [ -f "$timestamp_file" ] && [ -f "$pid_file" ]; then
      local lock_time=$(cat "$timestamp_file")
      local pid=$(cat "$pid_file")
      local age=$((now - lock_time))
      
      # Check if process is still running
      if ! kill -0 "$pid" 2>/dev/null; then
        echo "Stale lock detected (process $pid dead), cleaning"
        rm -rf "$lock_dir"
        rm -f "$timestamp_file"
      elif [ $age -gt $MAX_LOCK_AGE ]; then
        echo "Lock age ${age}s exceeds max ${MAX_LOCK_AGE}s, cleaning"
        rm -rf "$lock_dir"
        rm -f "$timestamp_file"
      fi
    fi
  done
}

# Run cleanup periodically
clean_stale_locks
```

## Lock Hierarchy (Prevent Deadlocks)

```bash
#!/bin/bash
# Always acquire locks in consistent order
LOCK_ORDER=("database" "cache" "filesystem" "network")

acquire_locks_in_order() {
  local requested_locks=("$@")
  local ordered_locks=()
  
  # Sort requested locks by hierarchy
  for lock_name in "${LOCK_ORDER[@]}"; do
    for requested in "${requested_locks[@]}"; do
      if [ "$requested" = "$lock_name" ]; then
        ordered_locks+=("$requested")
      fi
    done
  done
  
  # Acquire in order
  for lock in "${ordered_locks[@]}"; do
    if ! acquire_exclusive_lock "$lock" 30; then
      echo "Failed to acquire $lock"
      # Release already acquired locks
      for acquired in "${ordered_locks[@]}"; do
        [ "$acquired" = "$lock" ] && break
        release_exclusive_lock "$acquired"
      done
      return 1
    fi
  done
  
  return 0
}

release_locks_in_reverse() {
  local locks=("$@")
  
  # Release in reverse order
  for ((i=${#locks[@]}-1; i>=0; i--)); do
    release_exclusive_lock "${locks[$i]}"
  done
}
```

## Distributed Lock with Lease

```bash
#!/bin/bash
# Lock with automatic expiration
LOCK_DIR="/tmp/agent-leases"
RESOURCE="critical-section"
LEASE_DURATION=60  # seconds

acquire_lease() {
  local lease_file="$LOCK_DIR/$RESOURCE.lease"
  local now=$(date +%s)
  local expiry=$((now + LEASE_DURATION))
  
  mkdir -p "$LOCK_DIR"
  
  # Check if existing lease is expired
  if [ -f "$lease_file" ]; then
    local existing_expiry=$(cat "$lease_file")
    if [ $now -lt $existing_expiry ]; then
      return 1  # Lease still valid
    fi
  fi
  
  # Acquire lease
  echo "$expiry" > "$lease_file"
  echo "$$" > "$LOCK_DIR/$RESOURCE.pid"
  return 0
}

renew_lease() {
  local lease_file="$LOCK_DIR/$RESOURCE.lease"
  local now=$(date +%s)
  local expiry=$((now + LEASE_DURATION))
  
  if [ -f "$lease_file" ]; then
    local pid_file="$LOCK_DIR/$RESOURCE.pid"
    if [ -f "$pid_file" ] && [ "$(cat "$pid_file")" = "$$" ]; then
      echo "$expiry" > "$lease_file"
      return 0
    fi
  fi
  
  return 1  # Not our lease
}

release_lease() {
  rm -f "$LOCK_DIR/$RESOURCE.lease"
  rm -f "$LOCK_DIR/$RESOURCE.pid"
}

# Background renewal
start_lease_renewal() {
  (
    while true; do
      sleep $((LEASE_DURATION / 2))
      renew_lease || exit 1
    done
  ) &
  RENEWAL_PID=$!
  trap 'kill $RENEWAL_PID 2>/dev/null; release_lease' EXIT
}
```

## Best Practices

1. **Always use timeouts** - Never wait indefinitely for locks
2. **Clean up on exit** - Use trap to ensure lock release
3. **Detect stale locks** - Check process liveness and age
4. **Consistent ordering** - Prevent deadlocks with hierarchy
5. **Use leases** - Automatic expiration for long operations
6. **Log lock operations** - Debug coordination issues
7. **Test under load** - Verify behavior with many concurrent agents
8. **Monitor lock contention** - Track wait times and failures