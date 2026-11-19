---
description: No research. Only analyze and create an implementation plan
argument-hint: [task]
---

Think.
Activate `planning` skill.

## Your mission
<task>
$ARGUMENTS
</task>

**Read `.claude/commands/shared-snippets.md` for common patterns and apply them throughout this workflow.**

## Workflow
Use `planner` subagent to:
1. Create a directory named `plans/YYYYMMDD-HHmm-plan-name` (eg. `plans/20251101-1505-authentication-and-profile-implementation`).
   Make sure you pass the directory path to every subagent during the process.
2. Follow strictly to the "Plan Creation & Organization" rules of `planning` skill.
3. Analyze the codebase by reading `codebase-summary.md`, `code-standards.md`, `system-architecture.md` and `project-overview-pdr.md` file.
4. Gathers all information and create an implementation plan of this task.
5. Ask user to review the plan.

## Output Requirements

@include .claude/commands/shared-snippets.md#plan-directory-structure

## Important Notes
@include .claude/commands/shared-snippets.md#skills-activation-reminder
@include .claude/commands/shared-snippets.md#report-writing-rules
- **IMPORTANT**: **Do not** start implementing.
