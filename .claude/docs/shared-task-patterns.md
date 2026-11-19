# Shared Task Patterns and Messaging Protocols

## Overview

This document defines the shared task patterns and messaging protocols used across the multi-agent orchestration system. These patterns ensure consistent communication, task execution, and coordination across all agent levels.

## Messaging Protocols

### Message Envelope

All inter-agent messages follow a standard envelope format:

```javascript
{
  envelope: {
    messageId: 'uuid-v4',
    timestamp: 'ISO-8601',
    from: {
      agentId: 'agent-name',
      level: 'shogun|karo|ashigaru',
      domain: 'domain-name'
    },
    to: {
      agentId: 'agent-name',
      level: 'shogun|karo|ashigaru',
      domain: 'domain-name'
    },
    correlationId: 'uuid-v4', // Links related messages
    replyTo: 'message-id', // For responses
    ttl: 3600 // Time-to-live in seconds
  },
  payload: {
    type: 'message-type',
    data: { /* message-specific data */ }
  }
}
```

### Message Types

#### 1. Task Assignment (task_assign)

**Direction**: Shogun → Karo, Karo → Ashigaru

```javascript
{
  type: 'task_assign',
  data: {
    task: {
      id: 'task-uuid',
      parentId: 'parent-task-uuid', // Optional
      type: 'feature|bugfix|refactor|test|doc',
      priority: 'critical|high|medium|low',
      description: 'Clear task description',
      requirements: [
        'Requirement 1',
        'Requirement 2'
      ],
      constraints: [
        'Must use existing patterns',
        'Performance budget: 100ms'
      ],
      acceptanceCriteria: [
        'Criteria 1',
        'Criteria 2'
      ],
      estimatedEffort: '1h|2h|4h|8h',
      deadline: 'ISO-8601'
    },
    context: {
      parentTask: 'parent-task-description',
      relatedTasks: ['task-id-1', 'task-id-2'],
      dependencies: ['dependency-1'],
      sharedResources: ['resource-1'],
      apiContracts: { /* if applicable */ },
      designSpecs: { /* if applicable */ }
    },
    resources: {
      files: ['src/path/to/file.ts'],
      libraries: ['react', 'typescript'],
      patterns: ['pattern-name']
    },
    qualityCriteria: {
      testCoverage: 80,
      performanceBudget: '100ms',
      accessibilityLevel: 'AA',
      securityLevel: 'standard'
    }
  }
}
```

#### 2. Progress Report (progress)

**Direction**: Ashigaru → Karo, Karo → Shogun

```javascript
{
  type: 'progress',
  data: {
    taskId: 'task-uuid',
    status: 'started|in_progress|blocked|completed|failed',
    completion: 65, // Percentage 0-100
    currentPhase: 'implementation|testing|review',
    blockers: [
      {
        type: 'dependency|technical|resource',
        description: 'Blocker description',
        impact: 'high|medium|low',
        proposedSolution: 'Solution suggestion'
      }
    ],
    metrics: {
      linesOfCode: 150,
      filesModified: 3,
      testsWritten: 5,
      timeSpent: '2h'
    },
    estimatedCompletion: 'ISO-8601',
    notes: 'Additional context or observations'
  }
}
```

#### 3. Result Submission (result)

**Direction**: Ashigaru → Karo, Karo → Shogun

```javascript
{
  type: 'result',
  data: {
    taskId: 'task-uuid',
    status: 'completed|partial|failed',
    artifacts: [
      {
        type: 'code|test|doc|config|migration',
        path: 'src/path/to/file.ts',
        action: 'created|modified|deleted',
        linesAdded: 50,
        linesRemoved: 10,
        description: 'What was changed'
      }
    ],
    testResults: {
      total: 15,
      passed: 15,
      failed: 0,
      skipped: 0,
      coverage: 92,
      duration: '3.5s'
    },
    metrics: {
      complexity: 'low|medium|high',
      maintainability: 85,
      performance: '95ms',
      bundleSize: '+2kb'
    },
    issues: [
      {
        type: 'bug|limitation|technical-debt',
        severity: 'critical|major|minor',
        description: 'Issue description',
        workaround: 'If applicable'
      }
    ],
    recommendations: [
      'Follow-up task suggestion',
      'Optimization opportunity'
    ],
    notes: 'Implementation notes and decisions'
  }
}
```

#### 4. Conflict Escalation (conflict)

**Direction**: Karo → Shogun

```javascript
{
  type: 'conflict',
  data: {
    taskId: 'task-uuid',
    conflictType: 'api-contract|architecture|resource|priority|technical',
    description: 'Detailed conflict description',
    parties: [
      {
        agentId: 'karo-frontend',
        position: 'Frontend perspective',
        constraints: ['Must maintain UX']
      },
      {
        agentId: 'karo-backend',
        position: 'Backend perspective',
        constraints: ['Must maintain performance']
      }
    ],
    impact: {
      scope: 'local|cross-domain|system-wide',
      severity: 'blocking|degraded|cosmetic',
      affectedTasks: ['task-1', 'task-2']
    },
    proposedSolutions: [
      {
        solution: 'Solution 1',
        pros: ['Pro 1', 'Pro 2'],
        cons: ['Con 1'],
        effort: '2h',
        risk: 'low'
      },
      {
        solution: 'Solution 2',
        pros: ['Pro 1'],
        cons: ['Con 1', 'Con 2'],
        effort: '4h',
        risk: 'medium'
      }
    ],
    recommendation: 'Recommended solution with rationale',
    urgency: 'immediate|high|medium'
  }
}
```

#### 5. Resolution Directive (resolution)

**Direction**: Shogun → Karo

```javascript
{
  type: 'resolution',
  data: {
    conflictId: 'conflict-uuid',
    decision: 'Chosen solution description',
    rationale: 'Why this solution was chosen',
    directives: [
      {
        agentId: 'karo-frontend',
        action: 'Update API client to use new response format',
        deadline: 'ISO-8601',
        constraints: ['Maintain backward compatibility']
      },
      {
        agentId: 'karo-backend',
        action: 'Implement new response format with versioning',
        deadline: 'ISO-8601',
        constraints: ['Support both old and new formats']
      }
    ],
    followUp: {
      validationTask: 'task-uuid',
      reviewDate: 'ISO-8601'
    }
  }
}
```

#### 6. Status Query (status_query)

**Direction**: Any → Any

```javascript
{
  type: 'status_query',
  data: {
    targetTaskId: 'task-uuid',
    queryType: 'progress|blockers|eta|quality',
    urgency: 'routine|urgent|critical',
    context: 'Why this query is being made'
  }
}
```

#### 7. Status Response (status_response)

**Direction**: Any → Any (in response to status_query)

```javascript
{
  type: 'status_response',
  data: {
    queryId: 'original-message-id',
    taskId: 'task-uuid',
    status: 'current-status',
    details: {
      progress: 75,
      blockers: [],
      eta: 'ISO-8601',
      quality: 'on-track'
    },
    timestamp: 'ISO-8601'
  }
}
```

#### 8. Error Report (error)

**Direction**: Any → Parent Level

```javascript
{
  type: 'error',
  data: {
    taskId: 'task-uuid',
    errorType: 'technical|resource|timeout|validation|unknown',
    severity: 'critical|major|minor',
    error: {
      message: 'Error message',
      stack: 'Stack trace if available',
      code: 'Error code if applicable'
    },
    context: {
      action: 'What was being attempted',
      state: 'System state when error occurred',
      inputs: 'Inputs that caused the error'
    },
    impact: {
      scope: 'task|domain|system',
      affectedTasks: ['task-1'],
      recoverable: true
    },
    attemptedRecovery: [
      'Recovery attempt 1',
      'Recovery attempt 2'
    ],
    recommendation: 'Suggested next steps'
  }
}
```

## Shared Task Patterns

### Pattern 1: Parallel Fan-Out with Aggregation

**Use Case**: Independent tasks that can execute in parallel

```javascript
// Shogun decomposes into independent domains
const domains = await shogun.analyze(task);

// Each Karo manages their domain independently
const karoPromises = domains.map(async domain => {
  const karo = createKaroAgent(domain.type);
  const domainPlan = await karo.plan(domain.task);
  const domainResults = await karo.execute(domainPlan);
  return {
    domain: domain.type,
    results: domainResults,
    metrics: domainResults.metrics
  };
});

// Wait for all domains to complete
const domainResults = await Promise.all(karoPromises);

// Shogun validates and synthesizes
const validationResult = await shogun.validate(domainResults);
if (!validationResult.valid) {
  await shogun.resolveIssues(validationResult.issues);
}

const finalResult = await shogun.synthesize(domainResults);
```

### Pattern 2: Sequential Pipeline

**Use Case**: Tasks with dependencies that must execute in order

```javascript
const pipeline = [
  { karo: 'database', task: 'schema-migration', validation: 'schema-valid' },
  { karo: 'backend', task: 'api-implementation', validation: 'api-tested' },
  { karo: 'frontend', task: 'ui-integration', validation: 'ui-tested' },
  { karo: 'testing', task: 'e2e-tests', validation: 'all-passing' }
];

const results = [];
for (const step of pipeline) {
  const karo = createKaroAgent(step.karo);
  const result = await karo.execute(step.task);
  
  // Validate before proceeding
  const validation = await validate(result, step.validation);
  if (!validation.passed) {
    await handlePipelineFailure(step, validation);
    break;
  }
  
  results.push({
    step: step.karo,
    result: result,
    validation: validation
  });
}

const finalResult = await shogun.synthesize(results);
```

### Pattern 3: Hybrid Coordination

**Use Case**: Mix of parallel and sequential tasks

```javascript
// Phase 1: Parallel independent work
const parallelPhase = [
  { karo: 'frontend', task: 'ui-components' },
  { karo: 'backend', task: 'api-endpoints' },
  { karo: 'database', task: 'schema' }
];

const parallelResults = await Promise.all(
  parallelPhase.map(async p => {
    const karo = createKaroAgent(p.karo);
    return await karo.execute(p.task);
  })
);

// Phase 2: Sequential integration
const sequentialPhase = [
  { karo: 'integration', task: 'connect-components', dependsOn: parallelResults },
  { karo: 'testing', task: 'integration-tests' }
];

const sequentialResults = await sequentialPhase.reduce(
  async (chain, step) => {
    const prevResults = await chain;
    const karo = createKaroAgent(step.karo);
    const result = await karo.execute(step.task, { context: prevResults });
    return [...prevResults, result];
  },
  Promise.resolve(parallelResults)
);

const finalResult = await shogun.synthesize(sequentialResults);
```

### Pattern 4: Iterative Refinement

**Use Case**: Tasks that require multiple passes to reach quality standards

```javascript
const MAX_ITERATIONS = 3;
let currentResult = null;
let iteration = 0;

while (iteration < MAX_ITERATIONS) {
  iteration++;
  
  // Execute or refine
  const result = currentResult 
    ? await karo.refine(currentResult, feedback)
    : await karo.execute(task);
  
  // Validate quality
  const validation = await shogun.validateQuality(result);
  
  if (validation.meetsStandards) {
    currentResult = result;
    break;
  }
  
  // Get feedback for next iteration
  feedback = await shogun.generateFeedback(result, validation);
  currentResult = result;
  
  if (iteration === MAX_ITERATIONS) {
    await shogun.escalate('max-iterations-reached', { result, feedback });
  }
}

const finalResult = currentResult;
```

### Pattern 5: Dynamic Task Decomposition

**Use Case**: Complex tasks that need progressive decomposition

```javascript
async function decomposeAndExecute(task, level = 'shogun') {
  const agent = createAgent(level);
  
  // Analyze task complexity
  const analysis = await agent.analyze(task);
  
  if (analysis.canExecuteDirectly) {
    // Simple enough to execute at this level
    return await agent.execute(task);
  }
  
  // Decompose into subtasks
  const subtasks = await agent.decompose(task);
  
  // Determine next level
  const nextLevel = level === 'shogun' ? 'karo' : 'ashigaru';
  
  // Execute subtasks
  const results = await Promise.all(
    subtasks.map(async subtask => {
      if (subtask.needsFurtherDecomposition) {
        return await decomposeAndExecute(subtask, nextLevel);
      } else {
        const worker = createAgent(nextLevel);
        return await worker.execute(subtask);
      }
    })
  );
  
  // Synthesize results
  return await agent.synthesize(results);
}

const finalResult = await decomposeAndExecute(complexTask);
```

### Pattern 6: Circuit Breaker

**Use Case**: Prevent cascading failures when agents are struggling

```javascript
const circuitBreaker = {
  failures: new Map(),
  thresholds: {
    failureCount: 3,
    timeout: 60000,
    resetTimeout: 300000
  },
  
  async execute(agentId, task, executor) {
    const state = this.getState(agentId);
    
    if (state === 'OPEN') {
      throw new Error(`Circuit breaker open for ${agentId}`);
    }
    
    try {
      const result = await Promise.race([
        executor(task),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.thresholds.timeout)
        )
      ]);
      
      this.recordSuccess(agentId);
      return result;
    } catch (error) {
      this.recordFailure(agentId);
      
      if (this.shouldOpenCircuit(agentId)) {
        this.openCircuit(agentId);
      }
      
      throw error;
    }
  },
  
  getState(agentId) {
    const data = this.failures.get(agentId);
    if (!data) return 'CLOSED';
    if (data.state === 'OPEN' && Date.now() - data.openedAt > this.thresholds.resetTimeout) {
      this.failures.set(agentId, { state: 'HALF_OPEN', failureCount: data.failureCount });
      return 'HALF_OPEN';
    }
    return data.state || 'CLOSED';
  },
  
  recordSuccess(agentId) {
    this.failures.delete(agentId);
  },
  
  recordFailure(agentId) {
    const data = this.failures.get(agentId) || { failureCount: 0, state: 'CLOSED' };
    data.failureCount++;
    this.failures.set(agentId, data);
  },
  
  shouldOpenCircuit(agentId) {
    const data = this.failures.get(agentId);
    return data && data.failureCount >= this.thresholds.failureCount;
  },
  
  openCircuit(agentId) {
    const data = this.failures.get(agentId);
    data.state = 'OPEN';
    data.openedAt = Date.now();
    this.failures.set(agentId, data);
  }
};

// Usage
const result = await circuitBreaker.execute('karo-frontend', task, async (t) => {
  return await karo.execute(t);
});
```

### Pattern 7: Retry with Backoff

**Use Case**: Transient failures that may succeed on retry

```javascript
async function executeWithRetry(agent, task, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2
  } = options;
  
  let lastError;
  let delay = initialDelay;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await agent.execute(task);
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      if (!isRetryable(error)) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const jitter = Math.random() * 0.3 * delay;
      await sleep(delay + jitter);
      
      delay = Math.min(delay * backoffMultiplier, maxDelay);
      
      // Report retry attempt
      await agent.report('retry', {
        taskId: task.id,
        attempt: attempt + 1,
        error: error.message,
        nextRetryIn: delay
      });
    }
  }
  
  throw new Error(`Failed after ${maxRetries} retries: ${lastError.message}`);
}

function isRetryable(error) {
  return error.retryable !== false && 
         !['validation_error', 'permission_denied'].includes(error.code);
}
```

### Pattern 8: Quality Gate Chain

**Use Case**: Multi-stage validation before task completion

```javascript
const qualityGates = [
  {
    name: 'compilation',
    validator: async (artifacts) => {
      const result = await compile(artifacts);
      return { passed: result.success, errors: result.errors };
    }
  },
  {
    name: 'linting',
    validator: async (artifacts) => {
      const result = await lint(artifacts);
      return { passed: result.errors === 0, warnings: result.warnings };
    }
  },
  {
    name: 'unit-tests',
    validator: async (artifacts) => {
      const result = await runTests(artifacts, 'unit');
      return { 
        passed: result.passed === result.total,
        coverage: result.coverage,
        failures: result.failures
      };
    }
  },
  {
    name: 'integration-tests',
    validator: async (artifacts) => {
      const result = await runTests(artifacts, 'integration');
      return { 
        passed: result.passed === result.total,
        failures: result.failures
      };
    }
  },
  {
    name: 'security-scan',
    validator: async (artifacts) => {
      const result = await securityScan(artifacts);
      return { 
        passed: result.vulnerabilities.critical === 0,
        vulnerabilities: result.vulnerabilities
      };
    }
  }
];

async function passThroughQualityGates(artifacts) {
  const results = [];
  
  for (const gate of qualityGates) {
    const result = await gate.validator(artifacts);
    results.push({ gate: gate.name, ...result });
    
    if (!result.passed) {
      return {
        passed: false,
        failedGate: gate.name,
        results: results,
        artifacts: artifacts
      };
    }
  }
  
  return {
    passed: true,
    results: results,
    artifacts: artifacts
  };
}

// Usage
const qualityResult = await passThroughQualityGates(implementation);
if (!qualityResult.passed) {
  await karo.fixIssues(qualityResult.failedGate, qualityResult);
}
```

## Message Routing

### Routing Table

```javascript
const routingTable = {
  'task_assign': {
    'shogun': ['karo'],
    'karo': ['ashigaru']
  },
  'progress': {
    'ashigaru': ['karo'],
    'karo': ['shogun']
  },
  'result': {
    'ashigaru': ['karo'],
    'karo': ['shogun']
  },
  'conflict': {
    'karo': ['shogun']
  },
  'resolution': {
    'shogun': ['karo']
  },
  'error': {
    'ashigaru': ['karo'],
    'karo': ['shogun']
  }
};

function routeMessage(message) {
  const allowedTargets = routingTable[message.payload.type]?.[message.envelope.from.level];
  
  if (!allowedTargets || !allowedTargets.includes(message.envelope.to.level)) {
    throw new Error(`Invalid routing: ${message.payload.type} from ${message.envelope.from.level} to ${message.envelope.to.level}`);
  }
  
  return sendMessage(message);
}
```

## Message Validation

### Schema Validation

```javascript
const messageSchemas = {
  task_assign: {
    required: ['task.id', 'task.description', 'task.requirements'],
    optional: ['context', 'resources', 'qualityCriteria']
  },
  progress: {
    required: ['taskId', 'status', 'completion'],
    optional: ['blockers', 'metrics', 'estimatedCompletion']
  },
  result: {
    required: ['taskId', 'status', 'artifacts'],
    optional: ['testResults', 'metrics', 'issues', 'recommendations']
  }
};

function validateMessage(message) {
  const schema = messageSchemas[message.payload.type];
  if (!schema) {
    throw new Error(`Unknown message type: ${message.payload.type}`);
  }
  
  for (const field of schema.required) {
    if (!getNestedValue(message.payload.data, field)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  return true;
}
```

## Best Practices

1. **Always use message envelopes**: Ensures traceability and correlation
2. **Validate before sending**: Catch errors early
3. **Include correlation IDs**: Link related messages
4. **Set appropriate TTLs**: Prevent stale message processing
5. **Log all messages**: Enable debugging and auditing
6. **Implement idempotency**: Handle duplicate messages safely
7. **Use typed messages**: Better validation and tooling support
8. **Handle failures gracefully**: Implement retries and circuit breakers
9. **Monitor message queues**: Detect bottlenecks early
10. **Document message contracts**: Keep schemas up to date
