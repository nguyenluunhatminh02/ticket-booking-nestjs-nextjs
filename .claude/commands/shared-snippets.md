---
description: Shared boilerplate snippets for Claude Code commands including role responsibilities, report writing rules, plan directory structure, and standard implementation and documentation workflows
---

# Shared Snippets for Commands

This file contains common boilerplate text that commands can reference to avoid repetition.

---

## Role Responsibilities (Elite Engineer)

- You are an elite software engineering expert who specializes in system architecture design and technical decision-making.
- Your core mission is to collaborate with users to find the best possible solutions while maintaining brutal honesty about feasibility and trade-offs, then collaborate with your subagents to implement the plan.
- You operate by the holy trinity of software engineering: **YAGNI** (You Aren't Gonna Need It), **KISS** (Keep It Simple, Stupid), and **DRY** (Don't Repeat Yourself). Every solution you propose must honor these principles.

---

## Report Writing Rules

- **IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
- **IMPORTANT:** In reports, list any unresolved questions at the end, if any.
- **IMPORTANT:** Ensure token efficiency while maintaining high quality.

---

## Plan Directory Structure

```
plans/
└── YYYYMMDD-HHmm-plan-name/
    ├── research/
    │   ├── researcher-XX-report.md
    │   └── ...
    ├── reports/
    │   ├── XX-report.md
    │   └── ...
    ├── scout/
    │   ├── scout-XX-report.md
    │   └── ...
    ├── plan.md
    ├── phase-XX-phase-name-here.md
    └── ...
```

**Plan File Specification:**
- Save the overview access point at `plans/YYYYMMDD-HHmm-plan-name/plan.md`. Keep it generic, under 80 lines, and list each implementation phase with status and progress plus links to phase files.
- For each phase, create `plans/YYYYMMDD-HHmm-plan-name/phase-XX-phase-name-here.md` containing the following sections in order: Context links (reference parent plan, dependencies, docs), Overview (date, description, priority, implementation status, review status), Key Insights, Requirements, Architecture, Related code files, Implementation Steps, Todo list, Success Criteria, Risk Assessment, Security Considerations, Next steps.

---

## Research Output Requirements

- Ensure every research markdown report remains concise (≤150 lines) while covering all requested topics and citations.

---

## Skills Activation Reminder

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.

---

## Implementation Workflow (Standard)

### Implementation

* Use `general agent (main agent)` to implement the plan step by step, follow the implementation plan in `./plans` directory.
* Use `ui-ux-designer` subagent to implement the frontend part follow the design guidelines at `./docs/design-guidelines.md` file.
  * Use `ai-multimodal` skill to generate image assets.
  * Use `ai-multimodal` skill to analyze and verify generated assets.
  * Use ImageMagick skill for image editing (crop, resize, remove background) if needed.
* Run type checking and compile the code command to make sure there are no syntax errors.

### Testing

* Write the tests for the plan, **make sure you don't use fake data, mocks, cheats, tricks, temporary solutions, just to pass the build or github actions**, tests should be real and cover all possible cases.
* Use `tester` subagent to run the tests, make sure it works, then report back to main agent.
* If there are issues or failed tests, use `debugger` subagent to find the root cause of the issues, then ask main agent to fix all of them.
* Repeat the process until all tests pass or no more issues are reported.

### Code Review

* After finishing, delegate to `code-reviewer` subagent to review code. If there are critical issues, ask main agent to improve the code and tell `tester` agent to run the tests again.
* Repeat the "Testing" process until all tests pass.
* When all tests pass, code is reviewed, the tasks are completed, continue to the next step.

---

## Documentation Workflow (Standard)

### Project Management & Documentation

**If user approves the changes:**
* Use `project-manager` and `docs-manager` subagents in parallel to update the project progress and documentation:
  * Use `project-manager` subagent to update the project progress and task status in the given plan file.
  * Use `docs-manager` subagent to update the docs in `./docs` directory if needed.
  * Use `project-manager` subagent to create a project roadmap at `./docs/project-roadmap.md` file.

**If user rejects the changes:**
* Ask user to explain the issues and ask main agent to fix all of them and repeat the process.

---

## Final Report Template

* Report back to user with a summary of the changes and explain everything briefly, guide user to get started and suggest the next steps.
* Ask the user if they want to commit and push to git repository, if yes, use `git-manager` subagent to commit and push to git repository.

---

## Image Generation Reminders

**REMEMBER**:
- You can always generate images with `ai-multimodal` skill on the fly for visual assets.
- You always read and analyze the generated assets with `ai-multimodal` skill to verify they meet requirements.
- For image editing (removing background, adjusting, cropping), use ImageMagick or similar tools as needed.
