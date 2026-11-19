---
description: Research, analyze, and create an implementation plan
argument-hint: [task]
---

Think harder.
Activate `planning` skill.

## Your mission
<task>
$ARGUMENTS
</task>

**Read `.claude/commands/shared-snippets.md` for common patterns and apply them throughout this workflow.**

## Workflow
1. Create a directory named `plans/YYYYMMDD-HHmm-plan-name` (eg. `plans/20251101-1505-authentication-and-profile-implementation`).
   Make sure you pass the directory path to every subagent during the process.
2. Follow strictly to the "Plan Creation & Organization" rules of `planning` skill.
3. Use multiple `researcher` agents (max 2 agents) in parallel to research for this task: 
   Each agent research for a different aspect of the task and are allowed to perform max 5 tool calls.
4. Analyze the codebase by reading `codebase-summary.md`, `code-standards.md`, `system-architecture.md` and `project-overview-pdr.md` file.
   **ONLY PERFORM THIS FOLLOWING STEP IF `codebase-summary.md` is not available or older than 3 days**: Use `/scout <instructions>` slash command to search the codebase for files needed to complete the task.
5. Main agent gathers all research and scout report filepaths, and pass them to `planner` subagent with the prompt to create an implementation plan of this task.
6. Main agent receives the implementation plan from `planner` subagent, and ask user to review the plan

## Output Requirements

@include .claude/commands/shared-snippets.md#plan-directory-structure
@include .claude/commands/shared-snippets.md#research-output-requirements

## Important Notes
@include .claude/commands/shared-snippets.md#skills-activation-reminder
@include .claude/commands/shared-snippets.md#report-writing-rules
- **IMPORTANT**: **Do not** start implementing.
