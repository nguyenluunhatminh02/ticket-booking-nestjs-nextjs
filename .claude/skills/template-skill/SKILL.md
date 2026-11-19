---
name: template-skill
description: Template for creating new Claude Code skills with standardized structure
description_zh: 创建新 Claude Code 技能的模板，具有标准化结构
allowed-tools: Read, Write, Edit, Bash
---

# Template Skill

This is a template for creating new skills in the `.claude/skills/` directory.

## Skill Structure

Every skill should follow this structure:

```yaml
---
name: skill-name
description: Brief description of what this skill does
allowed-tools: List, of, tools, this, skill, needs
---
```

## Sections

### 1. Purpose
Clearly state what problem this skill solves.

### 2. When to Use
Describe the triggers and conditions for invoking this skill.

### 3. Implementation Steps
Provide step-by-step instructions for executing the skill.

### 4. Quality Gates
Define validation criteria and checkpoints.

### 5. Error Handling
Specify how to handle common failure scenarios.

### 6. Integration Points
Document how this skill connects with other skills and workflows.

## Best Practices

- Keep skills focused on a single responsibility
- Use clear, actionable language
- Include validation steps
- Document dependencies and integration points
- Test the skill with realistic scenarios
- Update documentation when behavior changes

## Example Usage

```bash
# Invoke the skill
/skill-name

# Or with parameters
/skill-name param1 param2
```

## Validation Checklist

- [ ] Skill has clear purpose statement
- [ ] Triggers are well-defined
- [ ] Steps are actionable and complete
- [ ] Error handling is documented
- [ ] Integration points are clear
- [ ] Quality gates are measurable
