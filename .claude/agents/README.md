---
name: agents-readme
description: Documentation for Claude Code agents - specialized AI agents that handle specific aspects of software development with unique expertise for focused tasks
---

# Claude Code Agents

Specialized AI agents that handle specific aspects of software development. Each agent has unique expertise and can be invoked to complete focused tasks.

## Available Agents

### Planning & Architecture

#### **planner**
- **Purpose**: Research, analyze, and create comprehensive implementation plans
- **When to use**: Before starting significant implementation work, evaluating technical trade-offs, or understanding the best approach for solving complex problems
- **Example**: "I need to add OAuth2 authentication to our app" → Planner researches OAuth2 implementations and creates a detailed plan
- **Model**: Default

#### **project-manager**
- **Purpose**: Comprehensive project oversight, progress tracking, and coordination
- **When to use**: After completing major features, tracking progress against implementation plans, or consolidating reports from multiple agents
- **Example**: "The backend-developer and tester agents have finished their work. What's our overall project status?"
- **Model**: Haiku (fast, efficient)

### Code Quality & Testing

#### **code-reviewer**
- **Purpose**: Comprehensive code quality assessment and best practices enforcement
- **When to use**: After implementing new features, before merging PRs, when investigating technical debt, or optimizing performance bottlenecks
- **Example**: "I've finished implementing the user authentication endpoint" → Reviews for quality and security
- **Model**: Sonnet

#### **tester**
- **Purpose**: Validate code quality through testing, coverage analysis, and build verification
- **When to use**: After implementing new features, checking test coverage, or verifying bug fixes don't introduce regressions
- **Example**: "I've implemented the new user authentication endpoint" → Runs test suite and validates implementation
- **Model**: Sonnet

### Debugging & Investigation

#### **debugger**
- **Purpose**: Investigate issues, analyze system behavior, diagnose performance problems, and optimize performance
- **When to use**: Troubleshooting errors, identifying bottlenecks, analyzing failed deployments, investigating test failures, or creating diagnostic reports
- **Example**: "The /api/users endpoint is throwing 500 errors" → Systematically investigates the issue
- **Model**: Sonnet

#### **scout**
- **Purpose**: Quickly locate relevant files across large codebases using parallel search strategies
- **When to use**: Beginning work on features spanning multiple directories, debugging issues requiring file relationship understanding, or before making changes affecting multiple codebase parts
- **Example**: "I need to add Stripe as a new payment provider. Can you help me find all the relevant files?"
- **Model**: Haiku (fast search)
- **Tools**: Glob, Grep, Read, WebFetch, Bash, ListMcpResourcesTool

#### **scout-external**
- **Purpose**: Search external resources, documentation, and web for relevant information
- **When to use**: Need to find external documentation, research third-party libraries, or gather information from web sources
- **Model**: Haiku

### Specialized Roles

#### **brainstormer**
- **Purpose**: Generate creative solutions, explore ideas, and think through problems
- **When to use**: Early-stage problem solving, feature ideation, or exploring multiple solution approaches
- **Model**: Default

#### **copywriter**
- **Purpose**: Create compelling copy, documentation, and user-facing content
- **When to use**: Writing marketing copy, user documentation, README files, or any user-facing text
- **Model**: Default

#### **database-admin**
- **Purpose**: Database design, optimization, migration planning, and query optimization
- **When to use**: Designing database schemas, optimizing queries, planning migrations, or troubleshooting database performance
- **Model**: Default

#### **docs-manager**
- **Purpose**: Manage documentation, create technical docs, and maintain documentation standards
- **When to use**: Creating or updating documentation, organizing doc structure, or ensuring documentation quality
- **Model**: Default

#### **git-manager**
- **Purpose**: Git workflow management, branch strategies, and version control best practices
- **When to use**: Setting up git workflows, managing branches, resolving merge conflicts, or implementing git strategies
- **Model**: Default

#### **journal-writer**
- **Purpose**: Create development journals, progress reports, and technical retrospectives
- **When to use**: Documenting development progress, creating retrospectives, or maintaining development logs
- **Model**: Default

#### **mcp-manager**
- **Purpose**: Manage MCP (Model Context Protocol) servers, tools, and integrations
- **When to use**: Setting up MCP servers, configuring tools, or troubleshooting MCP integrations
- **Model**: Default

#### **ui-ux-designer**
- **Purpose**: Design user interfaces, create wireframes, and improve user experience
- **When to use**: Designing UI components, creating user flows, or improving UX patterns
- **Model**: Default

## How to Use Agents

### Automatic Invocation
Agents are automatically invoked based on task requirements. The system analyzes your request and selects the appropriate agent.

### Manual Invocation
You can explicitly request an agent:
```bash
# Using Task tool
<Task tool call to planner with query about OAuth2 implementation>

# Or mention the agent directly
"I'll use the code-reviewer agent to analyze the recent changes"
```

### Agent Orchestration
Multiple agents can work together:
1. **planner** creates implementation plan
2. **scout** locates relevant files
3. Implementation agents execute the plan
4. **tester** validates the implementation
5. **code-reviewer** assesses quality
6. **project-manager** tracks progress

## Agent Selection Guide

| Task Type | Recommended Agent |
|-----------|------------------|
| Planning new features | planner |
| Finding files | scout |
| Writing code | (implementation agents) |
| Testing code | tester |
| Reviewing code | code-reviewer |
| Debugging issues | debugger |
| Tracking progress | project-manager |
| Database work | database-admin |
| Documentation | docs-manager |
| Git operations | git-manager |
| UI/UX design | ui-ux-designer |
| Creative ideas | brainstormer |
| User-facing content | copywriter |
| MCP integration | mcp-manager |
| Development logs | journal-writer |

## Best Practices

1. **Use the right agent for the job** - Each agent has specific expertise
2. **Let agents collaborate** - Complex tasks benefit from multiple agents
3. **Provide clear context** - Agents work best with well-defined tasks
4. **Review agent output** - Always validate agent recommendations
5. **Token efficiency** - Agents are optimized for efficient token usage

## Model Selection

- **Haiku**: Fast, efficient tasks (scout, project-manager)
- **Sonnet**: Balanced performance and capability (tester, code-reviewer, debugger)
- **Default**: Complex reasoning tasks (planner, specialized roles)

## Related Documentation

- [Skills Overview](../skills/README.md) - Skills that agents can activate
- [Commands Reference](../commands/README.md) - Commands that invoke agents
- [Workflows Guide](../workflows/README.md) - Automated agent orchestration
