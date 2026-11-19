---
name: team-orchestration
description: Multi-agent team orchestration with hierarchical coordination (shogun/karo/ashigaru pattern)
version: 1.0.0
author: Claude Code
triggers:
  - multi-agent
  - team coordination
  - hierarchical orchestration
  - complex workflows
  - parallel agents
---

# Team Orchestration Patterns

Multi-agent coordination using hierarchical leadership model with shared task patterns and messaging protocols.

## Hierarchical Agent Structure

### Shogun (Commander)
**Role**: Strategic coordinator and task decomposer
- Receives complex tasks from users
- Breaks down into subtasks for Karo agents
- Maintains overall context and state
- Makes architectural decisions
- Resolves conflicts between agents
- Synthesizes final results

**Responsibilities**:
- Task analysis and decomposition
- Agent assignment and coordination
- Quality control and review
- Final synthesis and reporting

### Karo (Advisor/Lead Agent)
**Role**: Domain expert and team lead
- Manages specific domain (frontend, backend, testing, etc.)
- Coordinates Ashigaru agents within domain
- Provides domain-specific guidance
- Reports progress to Shogun
- Handles domain-level decisions

**Responsibilities**:
- Domain-specific task planning
- Ashigaru coordination
- Technical decision making
- Progress reporting

### Ashigaru (Worker Agent)
**Role**: Task executor
- Implements specific tasks
- Reports to Karo agent
- Follows established patterns
- Provides detailed implementation

**Responsibilities**:
- Code implementation
- Testing execution
- Documentation writing
- Bug fixes

## RLM Pattern (Reinforcement Learning Model)

### Core Principles
1. **Feedback Loops**: Each agent provides feedback to coordinator
2. **Adaptive Planning**: Plans adjust based on agent performance
3. **Quality Gates**: Multi-stage validation before progression
4. **Context Preservation**: Maintain context across agent handoffs
5. **Parallel Execution**: Maximize throughput with independent tasks

### Implementation Pattern

```javascript
// Shogun-level coordination
const shogun = {
  analyze: (task) => {
    // Decompose into domains
    return {
      domains: ['frontend', 'backend', 'testing'],
      dependencies: [...],
      parallelizable: [...]
    };
  },
  
  coordinate: (domains) => {
    // Assign Karo agents per domain
    return domains.map(domain => ({
      karo: createKaroAgent(domain),
      task: domain.task,
      constraints: domain.constraints
    }));
  },
  
  synthesize: (results) => {
    // Merge and validate
    return mergeResults(results);
  }
};

// Karo-level coordination
const karo = {
  plan: (task) => {
    // Break into atomic tasks
    return task.subtasks.map(subtask => ({
      ashigaru: createAshigaruAgent(),
      task: subtask,
      canParallelize: subtask.independent
    }));
  },
  
  execute: (tasks) => {
    // Parallel execution of independent tasks
    const parallel = tasks.filter(t => t.canParallelize);
    const sequential = tasks.filter(t => !t.canParallelize);
    
    return {
      parallel: Promise.all(parallel.map(t => t.ashigaru.execute(t.task))),
      sequential: sequential.reduce((chain, t) => 
        chain.then(() => t.ashigaru.execute(t.task)), Promise.resolve())
    };
  }
};
```

## Messaging Protocols

### Message Types

#### Task Assignment
```json
{
  "type": "task_assign",
  "from": "shogun",
  "to": "karo-frontend",
  "task": {
    "id": "task-001",
    "description": "Implement user authentication UI",
    "requirements": [...],
    "constraints": [...],
    "deadline": "2026-11-07T12:00:00Z"
  },
  "context": {
    "parentTask": "auth-system",
    "relatedTasks": ["task-002", "task-003"]
  }
}
```

#### Progress Report
```json
{
  "type": "progress",
  "from": "karo-frontend",
  "to": "shogun",
  "taskId": "task-001",
  "status": "in_progress",
  "completion": 65,
  "blockers": [],
  "estimatedCompletion": "2026-11-07T11:30:00Z"
}
```

#### Result Submission
```json
{
  "type": "result",
  "from": "ashigaru-001",
  "to": "karo-frontend",
  "taskId": "subtask-001",
  "status": "completed",
  "artifacts": [
    {
      "type": "code",
      "path": "src/components/LoginForm.tsx",
      "changes": "added"
    }
  ],
  "testResults": {
    "passed": 12,
    "failed": 0,
    "coverage": 85
  },
  "notes": "Implemented with error handling and validation"
}
```

#### Conflict Resolution
```json
{
  "type": "conflict",
  "from": "karo-backend",
  "to": "shogun",
  "taskId": "task-002",
  "conflict": "API contract mismatch",
  "details": "Frontend expects different response format",
  "proposedSolution": "Update API to match frontend expectations",
  "alternatives": [...]
}
```

## Shared Task Patterns

### Pattern 1: Parallel Fan-Out
```javascript
// Shogun decomposes into independent domains
const domains = shogun.analyze(task);

// Each Karo manages their domain
const karoResults = await Promise.all(
  domains.map(domain => karo.execute(domain))
);

// Shogun synthesizes
const finalResult = shogun.synthesize(karoResults);
```

### Pattern 2: Sequential Pipeline
```javascript
// Tasks with dependencies execute in order
const pipeline = [
  { karo: 'database', task: 'schema-migration' },
  { karo: 'backend', task: 'api-implementation' },
  { karo: 'frontend', task: 'ui-integration' },
  { karo: 'testing', task: 'e2e-tests' }
];

const results = await pipeline.reduce(
  (chain, step) => chain.then(r => [...r, karo.execute(step)]),
  Promise.resolve([])
);
```

### Pattern 3: Hybrid Coordination
```javascript
// Mix of parallel and sequential
const parallelPhase = [
  { karo: 'frontend', task: 'ui-components' },
  { karo: 'backend', task: 'api-endpoints' },
  { karo: 'database', task: 'schema' }
];

const parallelResults = await Promise.all(
  parallelPhase.map(p => karo.execute(p))
);

const sequentialPhase = [
  { karo: 'integration', task: 'connect-components' },
  { karo: 'testing', task: 'integration-tests' }
];

const finalResults = await sequentialPhase.reduce(
  (chain, step) => chain.then(r => [...r, karo.execute(step)]),
  Promise.resolve(parallelResults)
);
```

## Quality Gates

### Gate 1: Task Decomposition
- [ ] Task clearly defined
- [ ] Dependencies identified
- [ ] Parallelization opportunities found
- [ ] Risk assessment completed

### Gate 2: Agent Assignment
- [ ] Right agent type selected
- [ ] Context properly passed
- [ ] Constraints communicated
- [ ] Success criteria defined

### Gate 3: Implementation Review
- [ ] Code follows patterns
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] No regressions introduced

### Gate 4: Integration Validation
- [ ] Components work together
- [ ] API contracts honored
- [ ] Performance acceptable
- [ ] Security requirements met

## Coordination Strategies

### Strategy 1: Domain-Based
Assign agents by technical domain:
- Frontend Karo → UI components
- Backend Karo → API logic
- Database Karo → Data layer
- Testing Karo → Quality assurance

### Strategy 2: Feature-Based
Assign agents by feature:
- Feature A team (frontend + backend + testing)
- Feature B team (frontend + backend + testing)
- Integration team (cross-feature coordination)

### Strategy 3: Layer-Based
Assign agents by architectural layer:
- Presentation layer team
- Business logic team
- Data access team
- Infrastructure team

## Error Handling

### Agent Failure
```javascript
try {
  const result = await agent.execute(task);
} catch (error) {
  // Karo handles within domain
  if (error.recoverable) {
    return karo.retry(task, error);
  }
  // Shogun handles cross-domain
  return shogun.escalate(error, task);
}
```

### Timeout Handling
```javascript
const timeout = setTimeout(() => {
  karo.report('timeout', taskId);
  shogun.reassign(taskId);
}, MAX_EXECUTION_TIME);

const result = await agent.execute(task);
clearTimeout(timeout);
```

### Conflict Resolution
```javascript
if (conflict.detected) {
  const resolution = await shogun.resolve({
    conflict: conflict.details,
    agents: [conflict.agent1, conflict.agent2],
    options: conflict.proposedSolutions
  });
  
  await Promise.all([
    conflict.agent1.apply(resolution),
    conflict.agent2.apply(resolution)
  ]);
}
```

## Usage Examples

### Example 1: Complex Feature Implementation
```javascript
const task = "Implement user authentication with OAuth2";

// Shogun analyzes
const analysis = shogun.analyze(task);
// Returns: { domains: ['frontend', 'backend', 'database'], parallelizable: true }

// Karo agents coordinate
const results = await Promise.all([
  karo.frontend.execute({ task: 'OAuth UI components' }),
  karo.backend.execute({ task: 'OAuth API endpoints' }),
  karo.database.execute({ task: 'User schema + tokens' })
]);

// Shogun synthesizes
const finalResult = shogun.synthesize(results);
```

### Example 2: Bug Fix Across Layers
```javascript
const task = "Fix checkout flow bug";

// Sequential pipeline
const pipeline = [
  { karo: 'testing', task: 'reproduce bug' },
  { karo: 'frontend', task: 'fix UI issue' },
  { karo: 'backend', task: 'fix API logic' },
  { karo: 'testing', task: 'verify fix' }
];

const results = await executePipeline(pipeline);
```

## Best Practices

1. **Clear Boundaries**: Each agent has well-defined responsibilities
2. **Minimal Coupling**: Agents communicate through messages, not shared state
3. **Idempotent Operations**: Tasks can be retried safely
4. **Progressive Disclosure**: Start with high-level plan, drill down as needed
5. **Fail Fast**: Detect and report issues early
6. **Context Preservation**: Pass necessary context between agents
7. **Quality Over Speed**: Don't sacrifice quality for parallelization

## Integration with Auto-Orchestrate

The team orchestration patterns integrate with the existing auto-orchestrate workflow:

```javascript
// Enhanced auto-orchestrate.js
phase('Analysis');
const analysis = await shogun.analyze(task);

phase('Planning');
const plan = await shogun.plan(analysis);

phase('Implementation');
const results = await shogun.coordinate(plan);

phase('Testing');
const testResults = await shogun.validate(results);

phase('Review');
const review = await shogun.review(results);

phase('Synthesis');
const finalReport = await shogun.synthesize({
  analysis, plan, results, testResults, review
});
```

## Future Enhancements

- Dynamic agent scaling based on task complexity
- Machine learning for optimal agent assignment
- Real-time performance monitoring
- Automated conflict detection and resolution
- Cross-project agent sharing
- Agent specialization and learning
