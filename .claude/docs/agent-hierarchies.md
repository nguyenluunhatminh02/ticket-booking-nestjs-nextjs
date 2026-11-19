# Agent Team Hierarchies

## Overview

The multi-agent orchestration system uses a three-tier hierarchical structure inspired by feudal Japanese military organization. This structure provides clear command chains, domain expertise, and efficient task execution.

## Hierarchy Levels

### Level 1: Shogun (将軍) - Strategic Commander

**Purpose**: Top-level strategic coordination and task decomposition

**Responsibilities**:
- Receive and analyze complex user tasks
- Decompose tasks into domain-specific subtasks
- Assign work to Karo agents
- Maintain global context and state
- Resolve cross-domain conflicts
- Synthesize final results
- Ensure quality standards across all domains

**Decision Authority**:
- Architectural decisions
- Resource allocation
- Priority setting
- Conflict resolution
- Final approval

**Communication**:
- Receives: User requests, Karo progress reports, conflict escalations
- Sends: Task assignments to Karo, status updates to user, resolution directives

**Example Shogun Agents**:
- `orchestrator-shogun`: Main workflow coordinator
- `planner-shogun`: Strategic planning agent
- `reviewer-shogun`: Final quality gate

### Level 2: Karo (家老) - Domain Advisor/Lead

**Purpose**: Domain-specific expertise and team leadership

**Responsibilities**:
- Manage specific technical domain (frontend, backend, database, testing, etc.)
- Break down domain tasks into atomic units
- Coordinate Ashigaru agents within domain
- Provide domain-specific technical guidance
- Report progress to Shogun
- Handle domain-level technical decisions
- Validate Ashigaru work quality

**Decision Authority**:
- Domain-specific implementation details
- Technology choices within domain
- Task prioritization within domain
- Ashigaru assignment and coordination

**Communication**:
- Receives: Task assignments from Shogun, results from Ashigaru
- Sends: Progress reports to Shogun, task assignments to Ashigaru, conflict escalations

**Example Karo Agents**:
- `karo-frontend`: UI/UX domain lead
- `karo-backend`: API and business logic lead
- `karo-database`: Data layer and schema lead
- `karo-testing`: Quality assurance lead
- `karo-devops`: Infrastructure and deployment lead
- `karo-security`: Security and authentication lead

### Level 3: Ashigaru (足軽) - Task Executor

**Purpose**: Individual task implementation and execution

**Responsibilities**:
- Implement specific, well-defined tasks
- Write code, tests, documentation
- Follow established patterns and conventions
- Report completion to Karo
- Provide detailed implementation notes
- Flag issues or blockers

**Decision Authority**:
- Implementation details within assigned task
- Code style and formatting (within standards)
- Local optimization decisions

**Communication**:
- Receives: Task assignments from Karo
- Sends: Results and progress reports to Karo, blocker notifications

**Example Ashigaru Agents**:
- `ashigaru-component`: React component implementer
- `ashigaru-api`: API endpoint implementer
- `ashigaru-test`: Test writer
- `ashigaru-doc`: Documentation writer
- `ashigaru-migration`: Database migration writer

## Hierarchy Interaction Patterns

### Pattern 1: Top-Down Decomposition

```
User Request
    ↓
Shogun: Analyze & Decompose
    ↓
    ├─→ Karo-Frontend: Plan UI tasks
    │       ↓
    │       ├─→ Ashigaru: Implement LoginForm
    │       ├─→ Ashigaru: Implement Dashboard
    │       └─→ Ashigaru: Implement Navigation
    │
    ├─→ Karo-Backend: Plan API tasks
    │       ↓
    │       ├─→ Ashigaru: Implement auth endpoints
    │       ├─→ Ashigaru: Implement user endpoints
    │       └─→ Ashigaru: Implement validation
    │
    └─→ Karo-Database: Plan schema tasks
            ↓
            ├─→ Ashigaru: Create user table
            └─→ Ashigaru: Create migration
```

### Pattern 2: Bottom-Up Synthesis

```
Ashigaru: Complete task → Report to Karo
    ↓
Karo: Validate & Aggregate → Report to Shogun
    ↓
Shogun: Integrate all domains → Final result to User
```

### Pattern 3: Cross-Domain Coordination

```
Karo-Frontend ←→ Karo-Backend
    ↓
    Conflict detected (API contract mismatch)
    ↓
Shogun: Resolve conflict
    ↓
Both Karo: Apply resolution
```

## Agent Lifecycle

### Creation
1. Shogun identifies need for domain expertise
2. Shogun creates Karo agent with domain context
3. Karo creates Ashigaru agents for specific tasks
4. Agents receive initial context and constraints

### Execution
1. Agents execute assigned tasks
2. Regular progress reporting up the chain
3. Blockers escalated immediately
4. Results validated at each level

### Completion
1. Ashigaru report completion to Karo
2. Karo validates and aggregates results
3. Karo reports to Shogun
4. Shogun integrates and delivers final result

### Termination
1. Task completed successfully
2. Context archived for future reference
3. Agent resources released

## Context Passing

### Shogun → Karo
```javascript
{
  task: {
    id: 'domain-task-001',
    domain: 'frontend',
    description: 'Implement authentication UI',
    requirements: [...],
    constraints: [...]
  },
  context: {
    parentTask: 'auth-system',
    relatedDomains: ['backend', 'database'],
    apiContracts: {...},
    designSpecs: {...}
  },
  qualityCriteria: {
    testCoverage: 80,
    performanceBudget: '100ms',
    accessibilityLevel: 'AA'
  }
}
```

### Karo → Ashigaru
```javascript
{
  task: {
    id: 'atomic-task-001',
    type: 'component',
    description: 'Create LoginForm component',
    specifications: {...},
    dependencies: [...]
  },
  context: {
    domain: 'frontend',
    patterns: [...],
    sharedComponents: [...]
  },
  acceptanceCriteria: [...]
}
```

### Ashigaru → Karo
```javascript
{
  result: {
    taskId: 'atomic-task-001',
    status: 'completed',
    artifacts: [
      { type: 'code', path: 'src/components/LoginForm.tsx' },
      { type: 'test', path: 'src/components/LoginForm.test.tsx' }
    ],
    metrics: {
      linesOfCode: 150,
      testCoverage: 92,
      complexity: 'low'
    },
    notes: 'Implemented with form validation and error handling'
  }
}
```

### Karo → Shogun
```javascript
{
  report: {
    domain: 'frontend',
    taskId: 'domain-task-001',
    status: 'completed',
    summary: 'All UI components implemented and tested',
    artifacts: [...],
    metrics: {
      totalComponents: 5,
      testCoverage: 88,
      performanceScore: 95
    },
    issues: [],
    recommendations: [...]
  }
}
```

## Quality Gates by Level

### Ashigaru Level
- Code compiles without errors
- Tests written and passing
- Follows coding standards
- Documentation included

### Karo Level
- All Ashigaru tasks completed
- Domain integration validated
- Performance benchmarks met
- Security requirements satisfied

### Shogun Level
- All domain tasks completed
- Cross-domain integration working
- End-to-end tests passing
- User requirements fully met
- Quality standards exceeded

## Scaling Strategies

### Horizontal Scaling
- Multiple Ashigaru agents working in parallel within a domain
- Karo coordinates and aggregates results
- Used for large codebases or many similar tasks

### Vertical Scaling
- Deep hierarchy with multiple Karo levels
- Used for very complex domains
- Example: Karo → Sub-Karo → Ashigaru

### Dynamic Scaling
- Shogun creates/destroys agents based on workload
- Karo spawns Ashigaru for peak demand
- Automatic load balancing across agents

## Anti-Patterns to Avoid

1. **Bypassing Hierarchy**: Ashigaru communicating directly with Shogun
2. **Over-Centralization**: Shogun making domain-specific decisions
3. **Under-Coordination**: Karo agents working in isolation
4. **Context Loss**: Not passing sufficient context down the chain
5. **Quality Shortcuts**: Skipping validation at any level
6. **Single Point of Failure**: No backup agents for critical roles

## Best Practices

1. **Clear Boundaries**: Each level has distinct responsibilities
2. **Minimal Viable Context**: Pass only necessary context to avoid overload
3. **Regular Check-ins**: Frequent progress reporting prevents drift
4. **Early Escalation**: Report blockers immediately, don't wait
5. **Validate at Each Level**: Don't assume lower levels got it right
6. **Document Decisions**: Record why decisions were made
7. **Learn from Failures**: Archive lessons for future tasks

## Implementation Notes

When implementing hierarchical coordination:

1. Use message passing, not shared state
2. Implement retry logic at each level
3. Add timeout handling for long-running tasks
4. Log all inter-agent communications
5. Implement circuit breakers for failing agents
6. Use typed messages for better validation
7. Implement dead letter queues for failed messages
