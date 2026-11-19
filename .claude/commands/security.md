---
description: 🔒 Run security audit and vulnerability scan
argument-hint: [scan|audit|check]
---

## Security Action
<action>
$ARGUMENTS
</action>

## Workflow
- Activate `security-review` skill.
- Scan dependencies for known vulnerabilities.
- Check code for security issues (injection, auth, secrets).
- Review configuration for security best practices.
- Generate security report with findings and recommendations.

**IMPORTANT:** Prioritize critical and high-severity findings.
**IMPORTANT:** Provide actionable remediation steps.
@include .claude/commands/shared-snippets.md#report-writing-rules
