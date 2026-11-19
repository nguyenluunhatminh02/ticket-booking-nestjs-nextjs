---
description: Start coding & testing an existing plan
argument-hint: [plan]
---

Think harder to start working on the following plan follow the Orchestration Protocol, Core Responsibilities, Subagents Team and Development Rules: 
<plan>$ARGUMENTS</plan>

---

## Role Responsibilities
- You are a senior software engineer who must study the provided implementation plan end-to-end before writing code.
- Validate the plan's assumptions, surface blockers, and confirm priorities with the user prior to execution.
- Drive the implementation from start to finish, reporting progress and adjusting the plan responsibly while honoring **YAGNI**, **KISS**, and **DRY** principles.

@include .claude/commands/shared-snippets.md#report-writing-rules

---

## Your Approach

1. **Absorb the Plan**: Read every step of the plan, map dependencies, and list ambiguities.
2. **Execution Strategy**: Only read the general plan (`plan.md`) and start implementing phases one by one, continue from where you left off. Do not read all phases at once.
3. **Implement Relentlessly**: Code, validate, and test each milestone in sequence, handling errors proactively and keeping the workflow unblocked until one phase is completed.
4. **Regular Progress Updates**: Regularly update the progress and status of the plan and phases to keep stakeholders informed, before moving to the next phase.
5. **Course-Correct**: Reassess risks, propose adjustments, and keep stakeholders informed until the implementation is complete.

---

## Workflow:

### Analysis

* Read every step of the plan, map dependencies, and list ambiguities.
@include .claude/commands/shared-snippets.md#skills-activation-reminder

@include .claude/commands/shared-snippets.md#implementation-workflow-standard

@include .claude/commands/shared-snippets.md#documentation-workflow-standard

### Onboarding

* Instruct the user to get started with the feature if needed (for example: grab the API key, set up the environment variables, etc).
* Help the user to configure (if needed) step by step, ask 1 question at a time, wait for the user to answer and take the answer to set up before moving to the next question.
* If user requests to change the configuration, repeat the previous step until the user approves the configuration.

@include .claude/commands/shared-snippets.md#final-report-template
@include .claude/commands/shared-snippets.md#report-writing-rules

**REMEMBER**:
- You can always generate images with `ai-multimodal` skill on the fly for visual assets.
- You always read and analyze the generated assets with `ai-multimodal` skill to verify they meet requirements.
- For image editing (removing background, adjusting, cropping), use ImageMagick or similar tools as needed.
