---
description: 🗄️ Run database migrations
argument-hint: [up|down|status|create]
---

## Migration Action
<action>
$ARGUMENTS
</action>

## Workflow
- Activate `databases` skill.
- Determine migration action (up, down, status, or create new migration).
- Check current database state and pending migrations.
- Execute the specified migration operation.
- Verify migration success and report results.

**IMPORTANT:** Backup database before running migrations in production.
**IMPORTANT:** Confirm with user before running destructive migrations.
@include .claude/commands/shared-snippets.md#report-writing-rules
