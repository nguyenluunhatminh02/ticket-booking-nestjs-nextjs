---
name: planning
description: Strategic planning and task decomposition for complex multi-step implementations
description_zh: 复杂多步骤实施的战略规划和任务分解
allowed-tools: Read, Write, Edit, Bash, ListAgents, SendMessage
---

# Planning Skill

Strategic planning and task decomposition for complex implementations.

## Purpose

Break down complex tasks into manageable, parallelizable units with clear dependencies and quality gates.

## When to Use

- Multi-file changes (3+ files)
- Complex feature implementations
- System architecture decisions
- Multi-phase projects
- Tasks requiring coordination between multiple agents

## Implementation Steps

### 1. Task Analysis

Analyze the request and identify:
- Core objectives
- Required files and components
- Dependencies between tasks
- Quality requirements
- Risk factors

### 2. Phase Decomposition

Break the task into phases:
- **Foundation**: Core infrastructure and templates
- **Quality**: Error handling, validation, gates
- **Coordination**: Workflows, messaging, agents
- **Advanced**: Optimization, monitoring, specialized tools

### 3. Dependency Mapping

Create dependency graph:
```
Phase 1 (Foundation)
  ├─ Task 1.1 (independent)
  ├─ Task 1.2 (independent)
  └─ Task 1.3 (depends on 1.1)

Phase 2 (Quality)
  ├─ Task 2.1 (depends on Phase 1)
  └─ Task 2.2 (depends on Phase 1)
```

### 4. Parallelization Strategy

Identify independent tasks that can run in parallel:
- Tasks with no shared state
- Tasks in different domains
- Tasks with different resource requirements

### 5. Quality Gate Definition

Define checkpoints for each phase:
- Validation criteria
- Testing requirements
- Review checkpoints
- Acceptance criteria

### 6. Agent Assignment

Assign tasks to appropriate agents:
- Domain-specific agents (frontend, backend, database)
- Quality agents (tester, reviewer)
- Coordination agents (orchestrator)

### 7. Risk Mitigation

Identify and plan for:
- Technical risks
- Integration risks
- Performance risks
- Security risks

## Output Format

```json
{
  "plan": {
    "phases": [
      {
        "id": "phase-1",
        "name": "Foundation",
        "tasks": [
          {
            "id": "task-1.1",
            "description": "Task description",
            "files": ["file1.js", "file2.js"],
            "dependencies": [],
            "parallel": true,
            "qualityGates": ["gate1", "gate2"]
          }
        ]
      }
    ],
    "dependencies": {
      "phase-2": ["phase-1"],
      "phase-3": ["phase-2"]
    },
    "agents": {
      "frontend": ["task-1.1"],
      "backend": ["task-1.2"]
    }
  }
}
```

## Quality Gates

- [ ] All tasks have clear objectives
- [ ] Dependencies are correctly mapped
- [ ] Parallelization opportunities identified
- [ ] Quality gates defined for each phase
- [ ] Agent assignments are appropriate
- [ ] Risks are identified and mitigated

## Error Handling

- **Circular dependencies**: Detect and report circular dependency chains
- **Missing dependencies**: Validate all dependencies exist
- **Agent conflicts**: Check for resource conflicts between agents
- **Scope creep**: Validate task scope against original requirements

## Integration Points

- Feeds into: `auto-orchestrate` workflow
- Receives from: User requirements, complexity analysis
- Coordinates with: Domain agents, quality agents
- Outputs to: Task execution system

## Example

```bash
# Analyze a complex task
/planning Implement user authentication with OAuth2

# Output: Structured plan with phases, tasks, dependencies
```
