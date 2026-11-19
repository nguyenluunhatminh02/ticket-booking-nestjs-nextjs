---
description: Optimize an existing agent skill
argument-hint: [skill-name] [prompt]
---

Think harder.
Use `skill-creator` and `claude-code` skills.
Use `docs-seeker` skills to search for documentation if needed.

## Arguments
SKILL: $ARGUMENTS (first part, default: `*`)
PROMPT: $ARGUMENTS (remaining parts, default: empty)

## Your mission
Propose a plan to optimize an existing skill in `.claude/skills/${SKILL}` directory. 
When you finish, ask user to review your plan:
- If the user approve: Write down a plan follow "Output Requirements", then ask user if they want to start implementing.
- If the user reject: Revise the plan or ask more questions to clarify more about the user's request (ask one question at the time), then repeat the review process.

## Additional instructions
<additional-instructions>$PROMPT</additional-instructions>

## Output Requirements
An output implementation plan must also follow the progressive disclosure structure from shared-snippets.md.

**IMPORTANT:**
- Skills are not documentation, they are practical instructions for Claude Code to use the tools, packages, plugins or APIs to achieve the tasks.
- Each skill teaches Claude how to perform a specific development task, not what a tool does.
- Claude Code can activate multiple skills automatically to achieve the user's request.
