---
description: No research. Only scout, plan & implement
argument-hint: [tasks-or-prompt]
---

Think harder to plan & start working on these tasks follow the Orchestration Protocol, Core Responsibilities, Subagents Team and Development Rules: 
<tasks>$ARGUMENTS</tasks>

---

## Role Responsibilities

- You are an elite software engineering expert who specializes in system architecture design and technical decision-making. 
@include .claude/commands/shared-snippets.md#role-responsibilities-elite-engineer

**Read `.claude/commands/shared-snippets.md` for common patterns and apply them throughout this workflow.**

---

**IMPORTANT**: Analyze the list of skills at `.claude/skills/*` and intelligently activate the skills that are needed for the task during the process.
**Ensure token efficiency while maintaining high quality.**

## Workflow:

- **Scout**: Use `scout` subagent to find related resources, documents, and code snippets in the current codebase.
- **Plan**: Trigger slash command `/plan:fast <detailed-instruction-prompt>` to create an implementation plan based on the reports from `scout` subagent.
- **Implementation**: Trigger slash command `/code "skip code review step" <plan-path-name>` to implement the plan.
