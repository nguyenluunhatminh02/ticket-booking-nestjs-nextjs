---
name: graph-engineering
description: 9-stage pipeline for complex dependency management using task graphs. Visualizes, orchestrates, and executes interdependent tasks with teaching mode for skill transfer.
version: 1.0.0
author: codejunkie99/graph-engineering (567 stars)
tags: [orchestration, dependencies, workflow, visualization, teaching]
triggers:
  - complex multi-file changes
  - dependency management
  - task orchestration
  - workflow visualization
  - skill transfer
---

# Graph Engineering: 9-Stage Pipeline

Transform complex, interdependent work into visual, tractable task graphs with automatic orchestration and teaching capabilities.

## When to Use

Apply this skill when facing:
- **Multi-component features** with clear dependencies
- **Architectural changes** requiring coordinated updates
- **Migration tasks** with sequential constraints
- **Learning scenarios** where skill transfer matters
- **Debugging chains** where root cause analysis requires systematic exploration

## The 9-Stage Pipeline

### Stage 1: Task Decomposition
Break the problem into atomic, executable units.

**Process:**
1. Identify the end goal
2. List all required changes/components
3. Define each as a discrete task with:
   - Clear input/output contract
   - Estimated complexity (S/M/L/XL)
   - Required skills/knowledge
   - Success criteria

**Output:** Raw task list with metadata

```javascript
// Example task structure
{
  id: "task-auth-middleware",
  title: "Implement auth middleware",
  complexity: "M",
  requires: ["jwt-knowledge", "express-middleware"],
  produces: ["auth-checker", "token-validator"],
  depends_on: [],
  blocks: ["task-user-routes", "task-admin-panel"]
}
```

### Stage 2: Dependency Mapping
Identify relationships between tasks.

**Process:**
1. For each task, ask: "What must exist before this can start?"
2. For each task, ask: "What does this enable?"
3. Map explicit dependencies (hard requirements)
4. Map implicit dependencies (shared resources, ordering constraints)
5. Identify parallelizable work

**Output:** Dependency graph (DAG - Directed Acyclic Graph)

```javascript
// Dependency structure
{
  nodes: [/* tasks from Stage 1 */],
  edges: [
    { from: "task-db-schema", to: "task-api-endpoints", type: "hard" },
    { from: "task-auth", to: "task-user-routes", type: "hard" },
    { from: "task-tests", to: "task-ci-pipeline", type: "soft" }
  ]
}
```

### Stage 3: Critical Path Analysis
Find the longest chain of dependent tasks.

**Process:**
1. Calculate earliest start time for each task
2. Calculate latest start time without delaying project
3. Identify tasks with zero slack (critical path)
4. Mark tasks that can slip without affecting deadline

**Output:** Critical path + slack analysis

```javascript
// Critical path result
{
  critical_path: ["task-db-schema", "task-api-endpoints", "task-frontend-integration"],
  total_duration: "8 hours",
  slack_tasks: [
    { task: "task-docs", slack: "4 hours" },
    { task: "task-tests", slack: "2 hours" }
  ],
  bottleneck: "task-api-endpoints"
}
```

### Stage 4: Resource Allocation
Assign agents/resources to tasks based on skills and availability.

**Process:**
1. Match task requirements to agent capabilities
2. Consider parallel execution limits
3. Balance workload across agents
4. Account for learning curves (teaching mode)

**Output:** Assignment matrix

```javascript
// Resource allocation
{
  assignments: [
    { task: "task-db-schema", agent: "planner", priority: 1 },
    { task: "task-api-endpoints", agent: "coder", priority: 2 },
    { task: "task-tests", agent: "tester", priority: 3 }
  ],
  parallel_groups: [
    ["task-db-schema"],
    ["task-api-endpoints", "task-auth"],
    ["task-tests", "task-docs"]
  ]
}
```

### Stage 5: Execution Strategy
Determine execution order and parallelization.

**Process:**
1. Topological sort of dependency graph
2. Group tasks into execution waves
3. Identify opportunities for parallel execution
4. Define checkpoints and validation gates

**Output:** Execution plan with waves

```javascript
// Execution strategy
{
  waves: [
    { wave: 1, tasks: ["task-db-schema"], gate: "schema-validated" },
    { wave: 2, tasks: ["task-api-endpoints", "task-auth"], gate: "api-tested" },
    { wave: 3, tasks: ["task-frontend-integration"], gate: "integration-tested" }
  ],
  parallelism: 2,
  checkpoints: ["schema-validated", "api-tested", "integration-tested"]
}
```

### Stage 6: Risk Assessment
Identify potential failure points and mitigation strategies.

**Process:**
1. For each task, assess:
   - Technical complexity
   - Dependency on external systems
   - Knowledge gaps
   - Integration risks
2. Assign risk scores (Low/Medium/High/Critical)
3. Define mitigation strategies
4. Plan fallback approaches

**Output:** Risk matrix with mitigations

```javascript
// Risk assessment
{
  risks: [
    {
      task: "task-third-party-integration",
      risk: "High",
      reason: "External API stability",
      mitigation: "Implement circuit breaker, mock for testing"
    }
  ],
  contingency_plans: {
    "task-third-party-integration": "Fall back to cached data"
  }
}
```

### Stage 7: Teaching Mode Integration
Embed skill transfer into the execution flow.

**Process:**
1. Identify tasks that require new skills
2. For each skill gap:
   - Create micro-learning module (5-10 min)
   - Include worked examples
   - Provide practice exercises
   - Define mastery criteria
3. Schedule learning before dependent tasks
4. Track skill acquisition

**Output:** Learning plan integrated with task graph

```javascript
// Teaching mode
{
  skill_gaps: [
    {
      skill: "graphql-subscriptions",
      required_by: ["task-real-time-features"],
      learning_module: {
        duration: "15 min",
        resources: ["tutorial-link", "example-code"],
        practice: "build-simple-subscription",
        mastery: "can-explain-and-implement"
      },
      scheduled_before: "task-real-time-features"
    }
  ]
}
```

### Stage 8: Visualization
Generate visual representation of the task graph.

**Process:**
1. Render dependency graph (nodes + edges)
2. Highlight critical path
3. Show execution waves
4. Display resource assignments
5. Indicate risk levels
6. Mark teaching opportunities

**Output:** Interactive visualization (see task-graph.js script)

**Visualization Elements:**
- Nodes: Tasks (color-coded by status/risk)
- Edges: Dependencies (solid = hard, dashed = soft)
- Critical path: Highlighted in red
- Parallel groups: Grouped visually
- Teaching moments: Marked with book icon

### Stage 9: Execution & Adaptation
Execute the plan with continuous adaptation.

**Process:**
1. Execute tasks in wave order
2. Monitor progress against plan
3. Detect blockers early
4. Re-plan when necessary:
   - Task takes longer than expected
   - Dependency fails
   - New information emerges
5. Update visualization in real-time
6. Capture lessons learned

**Output:** Completed work + adapted plan + lessons

```javascript
// Execution tracking
{
  status: "in-progress",
  completed: ["task-db-schema", "task-auth"],
  in_progress: ["task-api-endpoints"],
  blocked: [],
  adaptations: [
    {
      trigger: "task-auth took 2x longer",
      action: "Delayed task-user-routes, accelerated task-api-endpoints",
      impact: "No change to critical path"
    }
  ]
}
```

## Task-Graph Orchestration

### Orchestration Principles

1. **Explicit Dependencies**: Never assume implicit ordering
2. **Parallel When Possible**: Maximize throughput
3. **Fail Fast**: Detect blockers early
4. **Adapt Continuously**: Re-plan on new information
5. **Teach While Doing**: Build capability, not just output

### Orchestration Workflow

```javascript
// Pseudo-code for orchestration
async function orchestrate(taskGraph) {
  // Stage 1-3: Planning
  const decomposed = decompose(problem);
  const mapped = mapDependencies(decomposed);
  const criticalPath = analyzeCriticalPath(mapped);
  
  // Stage 4-6: Strategy
  const allocated = allocateResources(mapped);
  const strategy = planExecution(allocated);
  const risks = assessRisks(strategy);
  
  // Stage 7: Teaching
  const learningPlan = identifySkillGaps(strategy);
  
  // Stage 8: Visualization
  visualize(mapped, criticalPath, strategy, risks, learningPlan);
  
  // Stage 9: Execution
  for (const wave of strategy.waves) {
    await executeWave(wave, {
      adapt: (change) => rePlan(taskGraph, change),
      teach: (skill) => deliverLearning(skill)
    });
  }
  
  return captureLessons(taskGraph);
}
```

### Dependency Types

**Hard Dependencies**: Must complete before dependent starts
- Schema must exist before API endpoints
- Auth must exist before protected routes

**Soft Dependencies**: Preferred ordering but not required
- Tests should run before deployment
- Docs should update with code changes

**Resource Dependencies**: Shared resources create implicit ordering
- Database connection pool
- API rate limits
- File system locks

## Teaching Mode: Skill Transfer

### Philosophy

Every complex task is a learning opportunity. Graph Engineering embeds teaching into the workflow so teams build capability while delivering output.

### Teaching Triggers

Activate teaching mode when:
1. **Skill Gap Detected**: Task requires knowledge team lacks
2. **Novel Pattern**: First time implementing this approach
3. **Knowledge Silo**: Only one person understands this area
4. **Onboarding**: New team member joining mid-project

### Teaching Methods

**Just-In-Time Learning**
- 5-10 minute micro-modules
- Focused on immediate task requirements
- Includes worked examples
- Practice before production use

**Pair Execution**
- Expert pairs with learner
- Expert explains reasoning aloud
- Learner drives implementation
- Debrief after completion

**Documentation-First**
- Write docs before code
- Forces clarity of understanding
- Creates reference for future
- Enables async learning

**Retrospective Teaching**
- After task completion, extract lessons
- Create reusable patterns
- Update team knowledge base
- Schedule follow-up practice

### Teaching Integration

```javascript
// Teaching mode integration
const teachingPlan = {
  before_task: {
    skill: "graphql-subscriptions",
    module: "real-time-graphql-15min",
    practice: "build-chat-subscription",
    mastery_check: "explain-backpressure-handling"
  },
  during_task: {
    pair_with: "expert-dev",
    explain_reasoning: true,
    learner_drives: true
  },
  after_task: {
    retrospective: true,
    extract_pattern: true,
    update_docs: true,
    schedule_practice: "next-sprint"
  }
};
```

## Anti-Patterns to Avoid

1. **Hidden Dependencies**: Always make dependencies explicit
2. **Sequential Everything**: Parallelize when possible
3. **Big Bang Integration**: Integrate incrementally
4. **Learning Deferred**: Teach just-in-time, not just-in-case
5. **Static Plans**: Adapt to new information
6. **Ignoring Risks**: Assess and mitigate proactively
7. **No Visualization**: Always make the graph visible

## Example: Feature Implementation

**Problem**: "Add user authentication with OAuth2"

**Stage 1 - Decomposition**:
- task-db-schema (S)
- task-oauth-provider (M)
- task-auth-middleware (M)
- task-login-ui (M)
- task-protected-routes (M)
- task-tests (L)
- task-docs (S)

**Stage 2 - Dependencies**:
```
db-schema → oauth-provider → auth-middleware → protected-routes
db-schema → login-ui → protected-routes
protected-routes → tests
all → docs
```

**Stage 3 - Critical Path**:
```
db-schema → oauth-provider → auth-middleware → protected-routes → tests
Total: 6 hours
```

**Stage 4 - Allocation**:
- planner: db-schema
- coder: oauth-provider, auth-middleware, protected-routes
- frontend-dev: login-ui
- tester: tests
- tech-writer: docs

**Stage 5 - Execution**:
- Wave 1: db-schema (gate: schema-validated)
- Wave 2: oauth-provider, login-ui (parallel)
- Wave 3: auth-middleware (gate: middleware-tested)
- Wave 4: protected-routes (gate: routes-tested)
- Wave 5: tests, docs (parallel)

**Stage 6 - Risks**:
- oauth-provider: High risk (third-party API)
  - Mitigation: Mock provider for testing, circuit breaker

**Stage 7 - Teaching**:
- Skill gap: OAuth2 flow
  - 15-min module before oauth-provider task
  - Pair programming with expert
  - Retrospective to extract pattern

**Stage 8 - Visualization**:
- Generate task graph showing all stages
- Highlight critical path in red
- Show parallel groups
- Mark teaching moments

**Stage 9 - Execution**:
- Execute waves in order
- Adapt when oauth-provider takes longer
- Capture lessons for future auth tasks

## Integration with Auto-Orchestrate

This skill integrates with the auto-orchestrate workflow:

1. **Detection**: Auto-orchestrate detects complex task
2. **Planning**: Graph Engineering provides structured planning
3. **Visualization**: Task graph shows dependencies
4. **Execution**: Waves execute in optimal order
5. **Teaching**: Skill gaps identified and addressed
6. **Adaptation**: Re-plan on blockers

## Tools

- **task-graph.js**: Visualize dependency graphs
  - Run: `node .claude/scripts/task-graph.js`
  - Input: Task graph JSON
  - Output: Interactive HTML visualization

## References

- Original: codejunkie99/graph-engineering (567 stars)
- Critical Path Method (CPM)
- Program Evaluation and Review Technique (PERT)
- Agile task decomposition
- Just-in-time learning theory
