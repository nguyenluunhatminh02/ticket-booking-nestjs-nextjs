---
description: 🎨 Run linting and code formatting
argument-hint: [check|fix|format]
---

## Linting Action
<action>
$ARGUMENTS
</action>

## Workflow
- Activate `code-review` skill for standards.
- Run linters on codebase (ESLint, Prettier, etc.).
- Check for code style violations and formatting issues.
- Auto-fix issues when safe to do so.
- Report remaining issues that need manual attention.

**IMPORTANT:** Fix formatting issues automatically when possible.
**IMPORTANT:** Report only issues that cannot be auto-fixed.
@include .claude/commands/shared-snippets.md#report-writing-rules
