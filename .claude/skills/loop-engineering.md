# Loop Engineering Patterns

Safe, trackable loops with proper exit conditions for AI-assisted development.

## Core Principles

1. **Every loop must have a guaranteed exit condition**
2. **Track iterations, budget, and outcomes**
3. **Fail fast with meaningful errors**
4. **Log loop behavior for debugging**

## Pattern 1: While-Until-Dry

**Use when**: Processing items until a resource is exhausted or queue is empty.

```javascript
// Pattern: Process until no more items
let processed = 0;
const MAX_ITERATIONS = 1000;

while (queue.length > 0 && processed < MAX_ITERATIONS) {
  const item = queue.shift();
  await processItem(item);
  processed++;
  
  if (processed % 100 === 0) {
    console.log(`Processed ${processed} items, ${queue.length} remaining`);
  }
}

if (processed >= MAX_ITERATIONS) {
  throw new Error(`Loop exceeded max iterations (${MAX_ITERATIONS})`);
}
```

**When to use**:
- Batch processing queues
- Draining event buffers
- Processing paginated API results
- File system traversal

**Exit conditions**:
- Queue empty (success)
- Max iterations reached (failure)
- Error threshold exceeded (failure)

## Pattern 2: Loop-Until-Count

**Use when**: Need exactly N successful results, with retry logic.

```javascript
// Pattern: Collect N successful results
const TARGET_COUNT = 10;
const MAX_ATTEMPTS = 50;
const results = [];
let attempts = 0;

while (results.length < TARGET_COUNT && attempts < MAX_ATTEMPTS) {
  attempts++;
  
  try {
    const candidate = await generateCandidate();
    
    if (validate(candidate)) {
      results.push(candidate);
      console.log(`Collected ${results.length}/${TARGET_COUNT} valid results`);
    }
  } catch (error) {
    console.warn(`Attempt ${attempts} failed:`, error.message);
  }
}

if (results.length < TARGET_COUNT) {
  throw new Error(
    `Only collected ${results.length}/${TARGET_COUNT} results after ${attempts} attempts`
  );
}
```

**When to use**:
- Generating test data
- Finding N valid configurations
- Sampling until statistical significance
- Retry-until-success scenarios

**Exit conditions**:
- Target count reached (success)
- Max attempts exhausted (failure)
- Timeout exceeded (failure)

## Pattern 3: Loop-Until-Budget

**Use when**: Constrained by time, tokens, or compute resources.

```javascript
// Pattern: Work within a budget
const BUDGET = {
  maxTimeMs: 30000,      // 30 seconds
  maxTokens: 100000,     // Token limit
  maxCost: 1.00          // Dollar limit
};

const startTime = Date.now();
let tokensUsed = 0;
let cost = 0;
let iterations = 0;

while (iterations < 1000) {
  const elapsed = Date.now() - startTime;
  
  // Check all budget constraints
  if (elapsed > BUDGET.maxTimeMs) {
    console.log(`Time budget exceeded: ${elapsed}ms`);
    break;
  }
  if (tokensUsed > BUDGET.maxTokens) {
    console.log(`Token budget exceeded: ${tokensUsed}`);
    break;
  }
  if (cost > BUDGET.maxCost) {
    console.log(`Cost budget exceeded: $${cost.toFixed(2)}`);
    break;
  }
  
  // Do work
  const result = await doWork();
  tokensUsed += result.tokens;
  cost += result.cost;
  iterations++;
  
  // Progress reporting
  if (iterations % 10 === 0) {
    console.log(`Iteration ${iterations}: ${tokensUsed} tokens, $${cost.toFixed(2)}, ${elapsed}ms`);
  }
}

console.log(`Completed ${iterations} iterations within budget`);
```

**When to use**:
- API calls with rate limits
- LLM operations with token limits
- Expensive computations
- User-facing operations with SLA

**Exit conditions**:
- Any budget constraint hit (controlled stop)
- Work completed (success)
- Error threshold (failure)

## Pattern 4: Loop-Until-Stable

**Use when**: Iterating until convergence or no change.

```javascript
// Pattern: Iterate until stable
const MAX_ITERATIONS = 100;
const STABILITY_THRESHOLD = 0.001;

let previousState = null;
let currentState = initialState;
let iteration = 0;

while (iteration < MAX_ITERATIONS) {
  iteration++;
  
  previousState = currentState;
  currentState = await iterate(currentState);
  
  const delta = computeDelta(previousState, currentState);
  
  if (delta < STABILITY_THRESHOLD) {
    console.log(`Converged after ${iteration} iterations (delta: ${delta})`);
    break;
  }
  
  if (iteration % 10 === 0) {
    console.log(`Iteration ${iteration}: delta = ${delta}`);
  }
}

if (iteration >= MAX_ITERATIONS) {
  throw new Error(`Did not converge after ${MAX_ITERATIONS} iterations`);
}
```

**When to use**:
- Optimization algorithms
- State machine convergence
- Fixed-point iteration
- Gradient descent variants

**Exit conditions**:
- Delta below threshold (convergence)
- Max iterations (failure)
- Divergence detected (failure)

## Anti-Patterns to Avoid

### 1. Unbounded Loops
```javascript
// BAD: No exit condition
while (true) {
  await process();
}
```

### 2. Silent Failures
```javascript
// BAD: Swallows errors
try {
  while (condition) {
    await riskyOperation();
  }
} catch (e) {
  // ignored
}
```

### 3. No Progress Tracking
```javascript
// BAD: No visibility into loop behavior
for (let i = 0; i < items.length; i++) {
  await process(items[i]);
}
```

## Monitoring and Auditing

Use the loop audit script to analyze loop patterns:

```bash
node .claude/scripts/loop-audit.js <file-or-directory>
```

The script detects:
- Loops without iteration counters
- Missing max iteration guards
- Unbounded while loops
- Loops without progress logging

## Integration Checklist

When implementing loops:

- [ ] Define clear exit conditions (success + failure)
- [ ] Set maximum iteration count
- [ ] Track and log iterations
- [ ] Monitor resource usage (time, tokens, cost)
- [ ] Report progress at intervals
- [ ] Handle errors explicitly
- [ ] Test edge cases (empty input, max iterations)
- [ ] Document expected behavior

## Examples in This Project

See `/examples/loop-patterns/` for working implementations:
- `queue-processor.js` - While-until-dry pattern
- `data-generator.js` - Loop-until-count pattern
- `budget-constrained.js` - Loop-until-budget pattern
- `optimizer.js` - Loop-until-stable pattern
