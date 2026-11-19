---
description: 🧹 Clean temporary files, caches, and build artifacts
argument-hint: [all|cache|build|temp]
---

## Cleanup Target
<target>
$ARGUMENTS
</target>

## Workflow
- Identify cleanup targets (node_modules, dist, cache, temp files).
- Calculate disk space that will be freed.
- Remove specified artifacts safely.
- Report cleanup results and freed space.

**IMPORTANT:** Confirm before removing node_modules or large directories.
**IMPORTANT:** Never delete source code or configuration files.
@include .claude/commands/shared-snippets.md#report-writing-rules
