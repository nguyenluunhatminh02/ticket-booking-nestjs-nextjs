# Scripts Directory

This directory contains utility scripts for the Claude Code workflow system.

## Available Scripts

### mine-history.js
**Self-Improvement Orchestrator - Session History Miner**

Analyzes session logs to detect patterns, corrections, breakthroughs, and synthesize strategies for continuous learning.

**Usage:**
```bash
node .claude/scripts/mine-history.js [options]
```

**Options:**
- `--help, -h` - Show help message
- `--json` - Output report as JSON
- `--verbose` - Show detailed analysis

**What it does:**
- Extracts corrections from user feedback
- Detects patterns in mistakes and solutions
- Synthesizes strategies from correction clusters
- Identifies breakthrough discoveries
- Updates knowledge bases for future sessions

**Knowledge Bases:**
- `.claude/memory/corrections.json` - Raw correction data
- `.claude/memory/strategies.json` - Synthesized approaches
- `.claude/memory/breakthroughs.json` - Novel solutions

**When to run:**
- After completing significant work sessions
- Weekly for pattern analysis
- Monthly for strategy synthesis
- Quarterly for comprehensive review

### loop-audit.js
**Loop Engineering Audit Tool**

Analyzes JavaScript/TypeScript files for loop patterns and safety practices.

**Usage:**
```bash
node .claude/scripts/loop-audit.js <file-or-directory>
```

**Checks for:**
- Missing iteration counters in while loops
- Missing maximum iteration guards
- Missing progress logging
- Missing error handling
- Potential infinite loops
- Unbounded for loops

### Other Scripts

- `generate_catalogs.py` - Generate skill and command catalogs
- `scan_commands.py` - Scan and catalog available commands
- `scan_skills.py` - Scan and catalog available skills
- `task-graph.js` - Visualize task dependencies
- `validate-frontmatter.js` - Validate YAML frontmatter in skill files
- `resolve_env.py` - Resolve environment variables
- `commands_data.json/yaml` - Command catalog data
- `skills_data.json/yaml` - Skills catalog data

## Integration with Auto-Orchestrate

The `mine-history.js` script integrates with the auto-orchestrate workflow:

1. **Pre-planning**: Load strategies and breakthroughs before spawning agents
2. **During execution**: Agents check strategies before major decisions
3. **Post-execution**: Mine session for new learnings
4. **Knowledge update**: Add corrections, synthesize strategies, document breakthroughs

## Maintenance

Run these scripts regularly to keep the knowledge bases current:

```bash
# After each significant session
node .claude/scripts/mine-history.js

# Weekly review
node .claude/scripts/mine-history.js --verbose

# Monthly comprehensive review
node .claude/scripts/mine-history.js --json > monthly-report.json
```
