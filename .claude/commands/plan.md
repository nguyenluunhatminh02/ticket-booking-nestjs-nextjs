---
description: Intelligent plan creation with prompt enhancement
argument-hint: [task]
---

## Your mission
<task>
$ARGUMENTS
</task>

## Workflow
- Analyze the given task and ask for more details if needed.
- Decide to use `/plan:fast` or `/plan:hard` SlashCommands based on the complexity.
- Execute SlashCommand: `/plan:fast <detailed-instructions-prompt>` or `/plan:hard <detailed-instructions-prompt>`
- Activate `planning` skill.
- Note: `detailed-instructions-prompt` is **an enhanced prompt** that describes the task in detail based on the provided task description.

## Important Notes
@include .claude/commands/shared-snippets.md#skills-activation-reminder
@include .claude/commands/shared-snippets.md#report-writing-rules
**IMPORTANT**: **Do not** start implementing.
