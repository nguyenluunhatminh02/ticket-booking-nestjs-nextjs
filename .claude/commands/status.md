---
description: 📊 Show project status dashboard
argument-hint: [full|quick|deps|git]
---

## Status Scope
<scope>
$ARGUMENTS
</scope>

## Workflow
- Check git status (branch, uncommitted changes, ahead/behind).
- Analyze dependencies (outdated, vulnerabilities).
- Review recent test results and coverage.
- Check build status and deployment state.
- Generate concise project health summary.

**IMPORTANT:** Highlight actionable items and blockers.
**IMPORTANT:** Prioritize critical issues at the top.
@include .claude/commands/shared-snippets.md#report-writing-rules
