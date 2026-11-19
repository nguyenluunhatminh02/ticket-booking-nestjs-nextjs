# Troubleshooting Guide

Quick-reference for diagnosing and fixing issues with skills, agents, hooks, workflows, and commands.

---

## Table of Contents

- [Common Issues](#common-issues)
  - [Skill Not Loading](#skill-not-loading)
  - [Agent Not Spawning](#agent-not-spawning)
  - [Hook Not Triggering](#hook-not-triggering)
  - [Workflow Failing](#workflow-failing)
  - [Command Not Found](#command-not-found)
  - [Permission Errors](#permission-errors)
  - [Path Issues](#path-issues)
- [Debugging Techniques](#debugging-techniques)
  - [Checking Logs](#checking-logs)
  - [Validating Frontmatter](#validating-frontmatter)
  - [Testing Hooks](#testing-hooks)
  - [Debugging Workflows](#debugging-workflows)
- [FAQ](#faq)
  - [How to Add a New Skill](#how-to-add-a-new-skill)
  - [How to Add a New Agent](#how-to-add-a-new-agent)
  - [How to Add a New Command](#how-to-add-a-new-command)
  - [How to Create Custom Hooks](#how-to-create-custom-hooks)
  - [How to Create Custom Workflows](#how-to-create-custom-workflows)
- [Resources](#resources)

---

## Common Issues

### Skill Not Loading

**Symptoms**: Skill does not appear in the available skills list, or invoking it returns "skill not found".

**Possible Causes & Fixes**:

1. **Missing or malformed frontmatter**
   - Every skill `.md` file must start with YAML frontmatter containing at minimum `name` and `description`.
   - Example:
     ```yaml
     ---
     name: my-skill
     description: What the skill does (one line)
     ---
     ```
   - Fix: Open the skill file and verify frontmatter is present and valid YAML.

2. **Wrong directory**
   - Skills must live in `.claude/skills/<skill-name>/` (directory-scoped) or `.claude/skills/<skill-name>.md` (single-file).
   - Fix: Confirm the file is in the correct location.

3. **File permissions**
   - The skill file must be readable by the current user.
   - Fix: `chmod 644 .claude/skills/<skill-name>.md`

4. **Name mismatch**
   - The `name` field in frontmatter must match the directory/file name.
   - Fix: Align the `name` field with the actual file or directory name.

5. **Syntax errors in content**
   - Unbalanced code fences or invalid Markdown can prevent parsing.
   - Fix: Validate the Markdown structure.

---

### Agent Not Spawning

**Symptoms**: Calling `SendMessage` to an agent fails, or the agent does not appear in `ListAgents`.

**Possible Causes & Fixes**:

1. **Agent definition missing**
   - Agents are defined as `.md` files in `.claude/agents/`.
   - Fix: Verify the agent file exists at `.claude/agents/<agent-name>.md`.

2. **Invalid agent frontmatter**
   - Agent files require frontmatter with `name`, `description`, and optionally `tools`.
   - Fix: Check frontmatter syntax.

3. **Agent name mismatch**
   - The name used in `SendMessage` must exactly match the agent's `name` field.
   - Fix: Use `ListAgents` to see the exact registered names.

4. **Agent crashed on startup**
   - Check logs for errors during agent initialization.
   - Fix: Review the agent's instructions for syntax errors or invalid tool references.

5. **Resource limits**
   - Too many concurrent agents may hit limits.
   - Fix: Check active agents with `ListAgents` and stop unused ones with `TaskStop`.

---

### Hook Not Triggering

**Symptoms**: A configured hook does not run when the expected event occurs.

**Possible Causes & Fixes**:

1. **Hook not registered in settings**
   - Hooks must be declared in `.claude/settings.json` or `.claude/settings.local.json` under the `hooks` key.
   - Fix: Verify the hook is listed with the correct event name (e.g., `on_prompt_submit`, `post_tool_use`, `on_stop`).

2. **Incorrect event name**
   - Valid events: `on_prompt_submit`, `post_tool_use`, `on_stop`, `pre_tool_use`.
   - Fix: Check the event name spelling and format.

3. **Script not executable**
   - Hook scripts (`.sh`, `.js`, `.ps1`) must have execute permissions.
   - Fix: `chmod +x .claude/hooks/<script-name>.sh`

4. **Script path incorrect**
   - The `command` field in the hook config must point to a valid, absolute or relative path.
   - Fix: Verify the path resolves correctly from the project root.

5. **Hook script errors**
   - The script may be failing silently.
   - Fix: Run the script manually to check for errors. Add logging to the script.

6. **Matcher not matching**
   - If the hook uses a `matcher` field (e.g., to filter by tool name), ensure the pattern matches.
   - Fix: Test the matcher pattern against expected inputs.

---

### Workflow Failing

**Symptoms**: A workflow script exits with an error, or agents spawned by the workflow do not complete.

**Possible Causes & Fixes**:

1. **Script syntax errors**
   - Workflow scripts (`.js`) must be valid Node.js.
   - Fix: Run the script with `node --check .claude/workflows/<script>.js` to validate syntax.

2. **Missing dependencies**
   - If the workflow imports modules, they must be available.
   - Fix: Check `package.json` or install required modules.

3. **Agent spawn failures**
   - The workflow may reference agents that do not exist or have invalid definitions.
   - Fix: Verify all referenced agents exist in `.claude/agents/`.

4. **Timeout issues**
   - Long-running workflows may hit timeout limits.
   - Fix: Increase timeout in the workflow configuration or optimize agent tasks.

5. **Environment variables missing**
   - Workflows may depend on env vars that are not set.
   - Fix: Check the workflow script for required env vars and ensure they are exported.

6. **Resume state corruption**
   - If a workflow was interrupted, its resume state may be invalid.
   - Fix: Clear the workflow state or restart from scratch.

---

### Command Not Found

**Symptoms**: Invoking a slash command (e.g., `/my-command`) returns "command not found".

**Possible Causes & Fixes**:

1. **Command file missing**
   - Commands are `.md` files in `.claude/commands/`.
   - Fix: Verify the file exists at `.claude/commands/<command-name>.md`.

2. **Frontmatter missing or invalid**
   - Commands require frontmatter with `name` and `description`.
   - Fix: Add or correct the frontmatter.

3. **Name mismatch**
   - The command name in frontmatter must match the filename.
   - Fix: Align the `name` field with the filename (without `.md`).

4. **Nested command path**
   - Commands in subdirectories (e.g., `.claude/commands/fix/fast.md`) are invoked as `/fix:fast`.
   - Fix: Use the correct colon-separated syntax.

---

### Permission Errors

**Symptoms**: "Permission denied" when running hooks, scripts, or accessing files.

**Possible Causes & Fixes**:

1. **File not executable**
   - Hook scripts and workflow scripts must have execute permission.
   - Fix: `chmod +x <script-path>`

2. **File owned by different user**
   - Files created by another user or process may not be accessible.
   - Fix: `chown <user>:<group> <file-path>` or adjust permissions.

3. **Directory permissions**
   - The `.claude/` directory and subdirectories must be readable.
   - Fix: `chmod 755 .claude/` and subdirectories.

4. **SELinux or AppArmor restrictions**
   - Security modules may block execution.
   - Fix: Check system logs and adjust security policies if needed.

5. **Read-only filesystem**
   - The filesystem may be mounted read-only.
   - Fix: Remount with write permissions or check disk health.

---

### Path Issues

**Symptoms**: Scripts fail to find files, or relative paths resolve incorrectly.

**Possible Causes & Fixes**:

1. **Relative paths in hooks**
   - Hook scripts run from the project root, but relative paths may not resolve as expected.
   - Fix: Use absolute paths or paths relative to the project root.

2. **Working directory changes**
   - If a script changes the working directory, subsequent relative paths may fail.
   - Fix: Use absolute paths throughout the script.

3. **Symlinks**
   - Symlinks may cause paths to resolve differently than expected.
   - Fix: Use `realpath` to resolve symlinks, or avoid symlinks in critical paths.

4. **Spaces in paths**
   - Paths with spaces must be quoted.
   - Fix: Quote all path variables: `"$PATH_VAR"` instead of `$PATH_VAR`.

5. **Cross-platform path separators**
   - Windows uses `\`, Unix uses `/`.
   - Fix: Use `path.join()` in Node.js or ensure scripts handle both separators.

---

## Debugging Techniques

### Checking Logs

**Where to find logs**:

1. **Claude Code logs**
   - Location: `~/.claude/logs/` (varies by platform)
   - Contains general Claude Code activity and errors.

2. **Hook execution logs**
   - Hooks can write to stdout/stderr, which appears in the Claude Code transcript.
   - Add `echo` or `console.log` statements to hook scripts for debugging.

3. **Workflow logs**
   - Workflows write to the transcript and may create log files in `.claude/workflows/logs/`.
   - Check the workflow script for custom logging.

4. **Agent logs**
   - Agent activity appears in the main transcript.
   - Use `ListAgents` to see active agents and their status.

5. **Tool usage logs**
   - Location: `.claude/tool-usage.log`
   - Records all tool invocations and their results.

**How to enable verbose logging**:

- Set environment variable: `export CLAUDE_DEBUG=1`
- This increases log verbosity for debugging.

---

### Validating Frontmatter

**Manual validation**:

1. Open the `.md` file in a text editor.
2. Ensure the file starts with `---` on the first line.
3. Check that all required fields are present:
   - Skills: `name`, `description`
   - Agents: `name`, `description`
   - Commands: `name`, `description`
4. Ensure the frontmatter ends with `---`.
5. Verify YAML syntax (no tabs, proper indentation, quoted strings with special characters).

**Automated validation**:

```bash
# Extract and validate frontmatter with a simple script
head -n 20 .claude/skills/my-skill.md | grep -A 10 "^---"
```

**Common frontmatter errors**:

- Missing closing `---`
- Using tabs instead of spaces
- Unquoted strings with colons: `description: This: is wrong` (should be `description: "This: is wrong"`)
- Duplicate keys

---

### Testing Hooks

**Manual hook testing**:

1. **Run the hook script directly**:
   ```bash
   .claude/hooks/my-hook.sh
   ```
   - Observe output and exit code.

2. **Simulate hook input**:
   - Hooks receive JSON input on stdin. Test with:
   ```bash
   echo '{"event": "on_prompt_submit", "prompt": "test"}' | .claude/hooks/my-hook.sh
   ```

3. **Check hook configuration**:
   ```bash
   cat .claude/settings.json | jq '.hooks'
   ```
   - Verify the hook is registered with the correct event and command.

4. **Add debug logging**:
   - Modify the hook script to log input and output:
   ```bash
   #!/bin/bash
   input=$(cat)
   echo "Hook input: $input" >> /tmp/hook-debug.log
   # ... hook logic ...
   echo "Hook output: $result" >> /tmp/hook-debug.log
   ```

5. **Test in isolation**:
   - Temporarily disable other hooks to isolate the problematic one.

---

### Debugging Workflows

**Step-by-step debugging**:

1. **Check syntax**:
   ```bash
   node --check .claude/workflows/my-workflow.js
   ```

2. **Run with verbose output**:
   - Add `console.log` statements throughout the workflow script.
   - Run the workflow and observe the transcript.

3. **Test individual agents**:
   - Spawn agents manually with `SendMessage` to verify they work independently.
   - Check agent definitions for errors.

4. **Check agent communication**:
   - Use `ListAgents` to see if agents are spawned and active.
   - Verify agent names match between workflow and agent definitions.

5. **Inspect resume state**:
   - Workflows may save state for resumption. Check for corrupted state files.
   - Clear state and restart if needed.

6. **Monitor timeouts**:
   - Check if agents are timing out.
   - Increase timeout values in the workflow configuration.

7. **Review workflow logs**:
   - Check `.claude/workflows/logs/` for detailed execution logs.

---

## FAQ

### How to Add a New Skill

**Steps**:

1. **Create the skill file**:
   - Single-file skill: `.claude/skills/my-skill.md`
   - Directory-scoped skill: `.claude/skills/my-skill/` (with `index.md` or multiple files)

2. **Add frontmatter**:
   ```yaml
   ---
   name: my-skill
   description: Brief description of what the skill does
   ---
   ```

3. **Write the skill instructions**:
   - Provide clear, actionable instructions for Claude to follow.
   - Include examples if helpful.

4. **Test the skill**:
   - Invoke it with `/my-skill` or mention it in a prompt.
   - Verify it appears in the available skills list.

**Example**:
```markdown
---
name: code-review
description: Review code for bugs, style, and best practices
---

When reviewing code:
1. Check for common bugs (null pointers, off-by-one errors)
2. Verify coding style consistency
3. Look for performance issues
4. Suggest improvements
```

---

### How to Add a New Agent

**Steps**:

1. **Create the agent file**:
   - Location: `.claude/agents/my-agent.md`

2. **Add frontmatter**:
   ```yaml
   ---
   name: my-agent
   description: What the agent does
   tools:
     - Read
     - Write
     - Bash
   ---
   ```

3. **Write agent instructions**:
   - Define the agent's role, constraints, and behavior.
   - Specify which tools it can use.

4. **Spawn the agent**:
   - Use `SendMessage` with `to: "my-agent"`.
   - Or reference it in a workflow.

**Example**:
```markdown
---
name: researcher
description: Research topics and compile reports
tools:
  - Read
  - WebSearch
  - Write
---

You are a research agent. Your job is to:
1. Gather information on the given topic
2. Verify sources
3. Compile a comprehensive report
4. Save the report to a file
```

---

### How to Add a New Command

**Steps**:

1. **Create the command file**:
   - Location: `.claude/commands/my-command.md`
   - Nested command: `.claude/commands/category/my-command.md`

2. **Add frontmatter**:
   ```yaml
   ---
   name: my-command
   description: What the command does
   ---
   ```

3. **Write the command template**:
   - Use `$ARGUMENTS` to reference user input.
   - Provide instructions for Claude to follow.

4. **Invoke the command**:
   - Single-level: `/my-command`
   - Nested: `/category:my-command`

**Example**:
```markdown
---
name: fix
description: Fix bugs in the codebase
---

Analyze the codebase and fix the following issue:
$ARGUMENTS

Steps:
1. Identify the root cause
2. Implement a fix
3. Test the fix
4. Report results
```

---

### How to Create Custom Hooks

**Steps**:

1. **Create the hook script**:
   - Location: `.claude/hooks/my-hook.sh` (or `.js`, `.ps1`)
   - Make it executable: `chmod +x .claude/hooks/my-hook.sh`

2. **Write the hook logic**:
   - The script receives JSON input on stdin.
   - It can output JSON to modify behavior or just perform side effects.

3. **Register the hook in settings**:
   - Edit `.claude/settings.json` or `.claude/settings.local.json`:
   ```json
   {
     "hooks": {
       "on_prompt_submit": [
         {
           "command": ".claude/hooks/my-hook.sh",
           "matcher": "*"
         }
       ]
     }
   }
   ```

4. **Test the hook**:
   - Trigger the event and verify the hook runs.
   - Check logs for output.

**Example hook script** (`.claude/hooks/log-prompt.sh`):
```bash
#!/bin/bash
input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt')
echo "$(date): $prompt" >> .claude/prompt-log.txt
```

**Available events**:
- `on_prompt_submit`: Runs before processing a prompt
- `pre_tool_use`: Runs before a tool is executed
- `post_tool_use`: Runs after a tool is executed
- `on_stop`: Runs when Claude stops

---

### How to Create Custom Workflows

**Steps**:

1. **Create the workflow script**:
   - Location: `.claude/workflows/my-workflow.js`
   - Must be a valid Node.js script.

2. **Define the workflow logic**:
   - Use the workflow API to spawn agents, manage state, and coordinate tasks.
   - Refer to `.claude/workflows/README.md` for API details.

3. **Register the workflow** (optional):
   - Workflows can be invoked directly or referenced in skills/commands.

4. **Test the workflow**:
   - Run it and observe the transcript.
   - Check for errors and adjust as needed.

**Example workflow** (`.claude/workflows/review-and-fix.js`):
```javascript
module.exports = async ({ spawnAgent, waitForAgent }) => {
  // Spawn a code reviewer
  const reviewer = await spawnAgent('code-reviewer', {
    task: 'Review the codebase for bugs'
  });
  
  // Wait for review to complete
  const reviewResult = await waitForAgent(reviewer);
  
  // Spawn a fixer agent with the review results
  const fixer = await spawnAgent('debugger', {
    task: `Fix these issues: ${reviewResult.findings}`
  });
  
  await waitForAgent(fixer);
  
  return { status: 'complete' };
};
```

**Best practices**:
- Keep workflows focused on a single goal
- Handle errors gracefully
- Provide clear progress updates
- Use resume state for long-running workflows

---

## Resources

### Documentation

- **Claude Code Documentation**: https://docs.anthropic.com/en/docs/claude-code
- **Claude API Reference**: https://docs.anthropic.com/en/api/getting-started
- **Claude Code GitHub**: https://github.com/anthropics/claude-code

### Project-Specific Resources

- **Skills Directory**: `.claude/skills/`
  - `README.md`: Overview of available skills
  - `INSTALLATION.md`: How to install additional skills

- **Agents Directory**: `.claude/agents/`
  - `README.md`: Overview of available agents

- **Commands Directory**: `.claude/commands/`
  - `README.md`: Overview of available commands

- **Workflows Directory**: `.claude/workflows/`
  - `README.md`: Workflow documentation
  - `auto-orchestrate.js`: Main orchestration workflow

- **Hooks Directory**: `.claude/hooks/`
  - `README.md`: Hook documentation
  - `discord-hook-setup.md`: Discord integration guide
  - `telegram-hook-setup.md`: Telegram integration guide

### Configuration Files

- **Settings**: `.claude/settings.json` (project) and `.claude/settings.local.json` (user)
- **CLAUDE.md**: `/home/kronosss2002/Desktop/gamedb/CLAUDE.md` (project instructions)
- **Tool Usage Log**: `.claude/tool-usage.log`

### Support

- **GitHub Issues**: https://github.com/anthropics/claude-code/issues
- **Anthropic Support**: https://www.anthropic.com/contact
- **Community Forum**: https://github.com/anthropics/claude-code/discussions

### Quick Reference

| Issue | First Step |
|-------|-----------|
| Skill not loading | Check frontmatter in `.claude/skills/<skill>.md` |
| Agent not spawning | Verify agent file in `.claude/agents/<agent>.md` |
| Hook not triggering | Check `.claude/settings.json` hooks configuration |
| Workflow failing | Run `node --check` on the workflow script |
| Command not found | Verify command file in `.claude/commands/<command>.md` |
| Permission errors | Run `chmod +x` on scripts |
| Path issues | Use absolute paths or verify relative paths |

---

## Getting More Help

If this guide does not resolve your issue:

1. **Check the logs**: Review `.claude/tool-usage.log` and relevant hook/workflow logs.
2. **Validate configuration**: Ensure all frontmatter and JSON files are syntactically correct.
3. **Test in isolation**: Run scripts and hooks manually to identify the failure point.
4. **Consult documentation**: Refer to the resources listed above.
5. **Search issues**: Check GitHub issues for similar problems.
6. **Ask for help**: Post in the community forum or contact support.

---

*Last updated: 2026-11-07*
