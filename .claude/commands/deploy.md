---
description: 🚀 Deploy to staging or production
argument-hint: [staging|production]
---

## Deployment Target
<target>
$ARGUMENTS
</target>

## Workflow
- Activate `devops` skill.
- Determine deployment target (staging or production) from arguments or ask user.
- Run pre-deployment checks (tests, linting, build).
- Execute deployment for the specified environment.
- Verify deployment health and report status.

**IMPORTANT:** Always run tests before deploying.
**IMPORTANT:** Confirm with user before deploying to production.
@include .claude/commands/shared-snippets.md#report-writing-rules
