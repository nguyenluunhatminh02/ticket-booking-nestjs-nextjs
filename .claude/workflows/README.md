# Claude Code Workflows

Automated workflows that orchestrate complex multi-step processes, coordinate multiple agents, and enforce development standards across the project.

## Available Workflows

### Primary Development Workflow

**File**: `primary-workflow.md`

The core development workflow that defines the standard process for implementing features and fixing bugs.

**Stages**:
1. **Planning** - Delegate to `planner` agent to create implementation plan
2. **Implementation** - Write clean, maintainable code following specifications
3. **Testing** - Delegate to `tester` agent to run tests and validate
4. **Code Review** - Delegate to `code-reviewer` agent to assess quality
5. **Integration** - Ensure seamless integration with existing code
6. **Debugging** - Use `debugger` agent when issues arise

**Key Principles**:
- Always start with a plan from the `planner` agent
- Never ignore failing tests
- Run compile commands after code changes
- Update documentation when needed
- Follow YAGNI, KISS, and DRY principles

### Development Rules

**File**: `development-rules.md`

Comprehensive rules and standards that govern all development work.

**Core Principles**:
- **YAGNI** (You Aren't Gonna Need It) - Don't over-engineer
- **KISS** (Keep It Simple, Stupid) - Prefer simplicity
- **DRY** (Don't Repeat Yourself) - Eliminate duplication

**File Management**:
- Use kebab-case for file names
- Keep files under 200 lines for optimal context
- Split large files into focused components
- Use meaningful, descriptive names

**Code Quality**:
- Follow established architectural patterns
- Handle edge cases and error scenarios
- Use try-catch for error handling
- Cover security standards
- Run linting before commit
- Run tests before push

**Pre-commit/Push Rules**:
- No confidential information in commits
- Clean, professional commit messages
- Conventional commit format
- All tests must pass

### Orchestration Protocol

**File**: `orchestration-protocol.md`

Defines how multiple agents coordinate and work together on complex tasks.

**Sequential Chaining**:
Chain agents when tasks have dependencies:
- Planning → Implementation → Testing → Review
- Research → Design → Code → Documentation
- Each agent completes before the next begins
- Pass context and outputs between agents

**Parallel Execution**:
Spawn multiple agents simultaneously for independent tasks:
- Code + Tests + Docs (non-conflicting components)
- Multiple feature branches
- Cross-platform development (iOS + Android)
- Careful coordination to avoid file conflicts
- Plan merge strategy before execution

### Documentation Management

**File**: `documentation-management.md`

Rules for maintaining project documentation throughout development.

**Living Documents**:
- `./docs/development-roadmap.md` - Project phases and milestones
- `./docs/project-changelog.md` - Detailed change record
- `./docs/system-architecture.md` - Architecture documentation
- `./docs/code-standards.md` - Coding standards

**Automatic Update Triggers**:
- After feature implementation
- After major milestones
- After bug fixes
- After security updates
- Weekly reviews

**Update Protocol**:
1. Read current status before updates
2. Maintain version consistency
3. Verify links and cross-references
4. Ensure alignment with actual progress

## Auto-Orchestration

**File**: `auto-orchestrate.js`

JavaScript workflow that automatically orchestrates complex tasks with multi-agent coordination.

**When to Auto-Invoke**:
1. **Multi-file changes** (3+ files)
2. **Complex keywords detected**: implement, create, build, develop + feature/system/module
3. **Architectural changes**: Database schema, API design, system integration
4. **Quality requirements**: Tests, documentation, security

**Workflow Steps**:
1. Analyze task type and complexity
2. Spawn appropriate agents in optimal sequence
3. Execute parallel agents when tasks are independent
4. Run tester and code-reviewer for quality assurance
5. Return comprehensive results

**Example**:
```javascript
// User says: "Implement a new user authentication system with OAuth2"
// Auto-orchestrate workflow spawns:
// 1. planner agent → creates implementation plan
// 2. researcher agents → research OAuth2 in parallel
// 3. implementation agents → execute plan
// 4. tester agent → validates implementation
// 5. code-reviewer agent → assesses quality
// 6. project-manager agent → tracks progress
```

## Workflow Usage Patterns

### Standard Feature Development

```bash
# 1. Plan the feature
/plan Implement user authentication

# 2. Implement following the plan
/code plans/auth-implementation/plan.md

# 3. Test the implementation
/test

# 4. Review code quality
/review:codebase

# 5. Update documentation
/docs:update API endpoints
```

### Bug Fix Workflow

```bash
# 1. Debug the issue
/debug API returning 500 errors

# 2. Fix the bug
/fix:hard Race condition in WebSocket handler

# 3. Validate the fix
/test

# 4. Review changes
/review:codebase
```

### Complex System Implementation

```bash
# Auto-orchestration handles this automatically
# When you say: "Build a new payment processing system"

# The workflow will:
# 1. Detect complexity (multi-file, architectural change)
# 2. Spawn planner agent
# 3. Spawn researcher agents in parallel
# 4. Coordinate implementation
# 5. Run quality assurance
# 6. Return comprehensive results
```

## Creating Custom Workflows

Workflows are defined in Markdown files in the `.claude/workflows/` directory.

### Basic Workflow Structure

```markdown
# Workflow Name

## Purpose
Describe what this workflow accomplishes

## Steps
1. Step one description
2. Step two description
3. Step three description

## Rules
- Rule 1
- Rule 2
- Rule 3

## Agent Coordination
- Which agents to invoke
- When to invoke them
- How to pass context
```

### JavaScript Workflow Structure

For complex orchestration, create a `.js` file:

```javascript
// auto-orchestrate.js example
module.exports = async (task) => {
  // 1. Analyze task
  const analysis = analyzeTask(task);
  
  // 2. Plan approach
  const plan = await spawnAgent('planner', analysis);
  
  // 3. Execute in parallel/sequence
  const results = await executeAgents(plan);
  
  // 4. Quality assurance
  await spawnAgent('tester', results);
  await spawnAgent('code-reviewer', results);
  
  // 5. Return results
  return results;
};
```

## Workflow Best Practices

1. **Start with planning** - Always use the planner agent for complex tasks
2. **Follow the protocol** - Adhere to orchestration patterns
3. **Maintain quality** - Never skip testing or code review
4. **Update documentation** - Keep docs in sync with changes
5. **Use auto-orchestration** - Let the system coordinate complex tasks
6. **Token efficiency** - Keep agents focused and concise
7. **Clear communication** - Document decisions and trade-offs

## Workflow Integration

Workflows integrate with:
- **Agents** - Specialized AI agents execute workflow steps
- **Commands** - Slash commands trigger workflows
- **Skills** - Skills provide specialized knowledge
- **Hooks** - Hooks automate notifications and actions

## Related Documentation

- [Agents Overview](../agents/README.md) - Agents that workflows coordinate
- [Commands Reference](../commands/README.md) - Commands that trigger workflows
- [Skills Reference](../skills/README.md) - Skills that workflows activate
- [Hooks Guide](../hooks/README.md) - Hooks that workflows can trigger
