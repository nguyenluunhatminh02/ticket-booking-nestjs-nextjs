---
name: parallel-execution
description: Git worktree-based parallel execution using worktrunk CLI for running multiple AI agents simultaneously. Covers worktree management, merge strategies, conflict resolution, and integration with auto-orchestrate workflow. Use when implementing parallel agent execution, managing multiple worktrees, or optimizing development velocity with concurrent tasks.
license: MIT
version: 1.0.0
trigger: When implementing parallel agent execution, managing multiple worktrees, optimizing development velocity with concurrent tasks, or integrating worktrunk with auto-orchestrate workflows.
---

# Parallel Execution with Git Worktrees

Master parallel development using git worktrees and worktrunk CLI to run multiple AI agents simultaneously without conflicts.

## When to Use

- Running multiple AI agents in parallel
- Implementing parallel task execution
- Managing multiple feature branches simultaneously
- Optimizing development velocity
- Avoiding merge conflicts in concurrent work
- Integrating with auto-orchestrate workflows

## Prerequisites

**Install worktrunk:**

```bash
# macOS/Linux
brew install worktrunk && wt config shell install

# Cargo
cargo install worktrunk && wt config shell install

# Arch Linux
sudo pacman -S worktrunk && wt config shell install
```

Shell integration is required for directory switching commands.

## Core Worktrunk Commands

### Create and Switch Worktrees

```bash
# Create new worktree with branch
wt switch --create feature-auth
# Creates branch and worktree, switches to it

# Create and immediately start Claude
wt switch -c -x claude feature-auth

# Switch to existing worktree
wt switch feature-auth

# Checkout PR branch
wt switch pr:123
```

### List and Monitor Worktrees

```bash
# List all worktrees with status
wt list

# Full mode with CI status and AI summaries
wt list --full

# Output shows:
# @ feature-auth  +   ↑      +27   -8   ↑1       +31    4bc72dc    2h  Add authentication...
# ^ main              ^⇡                                    ⇡1      0e631ad    1d  Initial commit
```

**Status indicators:**
- `@` - current worktree
- `+` - staged changes
- `↑` - commits ahead of main
- `⇡` - unpushed commits

### Clean Up Worktrees

```bash
# Remove current worktree and branch
wt remove

# Remove specific worktree
wt remove feature-auth
```

## Merge Strategies

### Strategy 1: PR Workflow (Recommended for Team Collaboration)

Best for: Code review, CI/CD integration, team workflows

```bash
# 1. Do work in worktree
wt switch feature-auth
# ... make changes ...

# 2. Commit changes
wt step commit

# 3. Push and create PR
gh pr create

# 4. After PR is merged, clean up
wt remove
```

**Benefits:**
- Full code review process
- CI/CD validation
- Clear audit trail
- Safe for production

### Strategy 2: Local Merge (Fast Iteration)

Best for: Rapid prototyping, solo development, quick iterations

```bash
# 1. Do work in worktree
wt switch feature-auth
# ... make changes ...

# 2. Squash, rebase, and merge to main in one command
wt merge main

# Output:
# ✓ Committed changes @ a1b2c3d
# ✓ Merged to main (1 commit, 2 files, +53)
# ○ Switched to worktree for main @ ~/repo
```

**What happens:**
1. Generates commit message from diff (optional LLM integration)
2. Squashes commits if needed
3. Rebases onto main
4. Fast-forward merges to main
5. Removes worktree and branch automatically

**Benefits:**
- Single command workflow
- Clean git history
- Automatic cleanup
- Fast iteration cycles

### Strategy 3: Selective Merge (Complex Features)

Best for: Large features, partial implementations, experimental work

```bash
# 1. Do work in worktree
wt switch feature-auth

# 2. Commit specific files
wt step commit --include src/auth/

# 3. Merge only certain commits
wt merge main --interactive

# 4. Or merge without cleanup
wt merge main --no-remove
```

**Benefits:**
- Fine-grained control
- Partial merges
- Keep worktree for further work

## Integration with Auto-Orchestrate

### Pattern 1: Parallel Agent Spawning

When auto-orchestrate detects independent tasks, spawn agents in separate worktrees:

```bash
# Main orchestrator creates worktrees for each task
wt switch -c -x claude task-auth
wt switch -c -x claude task-api
wt switch -c -x claude task-ui

# Each agent works independently in its worktree
# No file conflicts, no git lock contention
```

**Auto-orchestrate integration:**

```javascript
// In auto-orchestrate workflow
const tasks = [
  { name: 'auth', description: 'Implement authentication' },
  { name: 'api', description: 'Create API endpoints' },
  { name: 'ui', description: 'Build UI components' }
];

// Spawn parallel agents
for (const task of tasks) {
  const branchName = `task-${task.name}`;
  await spawnAgent({
    command: `wt switch -c -x claude ${branchName}`,
    task: task.description,
    worktree: true
  });
}

// Wait for all agents to complete
await Promise.all(agents.map(a => a.waitForCompletion()));

// Merge results
for (const task of tasks) {
  await executeCommand(`wt switch task-${task.name}`);
  await executeCommand('wt merge main');
}
```

### Pattern 2: Task-Based Worktree Allocation

Allocate worktrees based on task type:

```bash
# Feature work
wt switch -c feature/user-profile

# Bug fixes
wt switch -c fix/login-error

# Refactoring
wt switch -c refactor/database-queries

# Documentation
wt switch -c docs/api-reference
```

### Pattern 3: Agent Isolation with Hooks

Configure worktrunk hooks for automatic setup:

```bash
# Create .worktrunk/config.toml
[hooks]
post-create = "npm install && npm run build"
pre-merge = "npm test"
post-merge = "npm run lint"
```

**Hook types:**
- `post-create` - Run after worktree creation (install deps, build)
- `pre-merge` - Run before merge (tests, validation)
- `post-merge` - Run after merge (lint, format, deploy)

## Best Practices

### 1. Branch Naming Conventions

```bash
# Task-based branches
task-auth-implementation
task-api-endpoints
task-ui-components

# Feature branches
feature/user-authentication
feature/payment-integration

# Bug fix branches
fix/null-pointer-exception
fix/race-condition-handler

# Refactor branches
refactor/database-layer
refactor/api-structure
```

### 2. Worktree Limits

**Recommended limits:**
- Maximum 5-10 parallel worktrees (depends on system resources)
- Each worktree needs disk space for dependencies
- Monitor memory usage with many parallel agents

**Check resource usage:**
```bash
# List all worktrees
wt list

# Check disk usage
du -sh ~/repo.*

# Monitor active processes
ps aux | grep claude
```

### 3. Conflict Prevention

**File ownership rules:**
- Each agent should own distinct files/directories
- Avoid concurrent edits to same files
- Use clear boundaries (auth agent owns `src/auth/`, etc.)

**Merge order strategy:**
```bash
# 1. Merge foundational changes first
wt switch task-database
wt merge main

# 2. Then merge dependent changes
wt switch task-api
wt merge main

# 3. Finally merge UI changes
wt switch task-ui
wt merge main
```

### 4. Conflict Resolution

When conflicts occur during merge:

```bash
# 1. Attempt merge
wt merge main

# 2. If conflicts, resolve manually
git status
# Edit conflicting files

# 3. Stage resolved files
git add .

# 4. Complete merge
git commit

# 5. Continue with cleanup
wt remove
```

### 5. Dev Server per Worktree

Assign unique ports to each worktree:

```bash
# In .worktrunk/config.toml
[variables]
port = "{{ hash_port 3000 4000 }}"

[hooks]
post-create = "npm run dev -- --port {{ port }}"
```

This gives each worktree a unique port (3000-4000 range) based on branch name hash.

### 6. Build Cache Sharing

Share `node_modules`, `target/`, etc. across worktrees:

```bash
# Copy ignored files (APFS, btrfs, XFS only)
wt step copy-ignored

# Or use symlinks
[hooks]
post-create = "ln -s ../repo.main/node_modules ./node_modules"
```

### 7. LLM-Generated Commit Messages

Enable automatic commit message generation:

```bash
# Configure LLM for commit messages
wt config llm.provider anthropic
wt config llm.model claude-sonnet-4-5

# Now wt step commit generates messages from diffs
wt step commit
```

## Advanced Patterns

### Pattern: Parallel Testing Matrix

Run tests across multiple worktrees simultaneously:

```bash
# Create worktrees for different test scenarios
wt switch -c test-unit
wt switch -c test-integration
wt switch -c test-e2e

# Run tests in parallel (from each worktree)
# Worktree 1: npm run test:unit
# Worktree 2: npm run test:integration
# Worktree 3: npm run test:e2e

# Collect results
wt list --full  # Shows CI status for each
```

### Pattern: Feature Flag Development

Develop multiple features behind flags:

```bash
# Each feature in separate worktree
wt switch -c feature/flag-dark-mode
wt switch -c feature/flag-new-dashboard
wt switch -c feature/flag-export-csv

# All features merge to main with flags disabled
# Enable features gradually in production
```

### Pattern: Hotfix While Developing

Work on feature while fixing urgent bug:

```bash
# Currently working on feature
wt switch feature-auth

# Urgent bug reported - create hotfix worktree
wt switch -c hotfix/critical-error

# Fix bug, merge to main
wt merge main

# Return to feature work
wt switch feature-auth
```

## Troubleshooting

### Worktree Won't Remove

```bash
# Force remove
wt remove --force

# Or manually
git worktree remove ../repo.feature-auth --force
git branch -D feature-auth
```

### Merge Conflicts

```bash
# Abort merge
wt merge --abort

# Or resolve and continue
git add .
git commit
wt remove
```

### Disk Space Issues

```bash
# List worktree sizes
du -sh ~/repo.*

# Remove old worktrees
wt remove old-feature

# Clean up unused branches
git branch -d $(git branch --merged main)
```

### Shell Integration Not Working

```bash
# Reinstall shell integration
wt config shell install

# Restart terminal or source shell config
source ~/.bashrc  # or ~/.zshrc
```

## Performance Optimization

### 1. Parallel Agent Limits

```bash
# Monitor system resources
top  # or htop

# Limit concurrent agents based on:
# - CPU cores (1 agent per 2 cores recommended)
# - RAM (2-4GB per agent)
# - Disk I/O (SSD recommended for many worktrees)
```

### 2. Dependency Caching

```bash
# Share node_modules across worktrees
[hooks]
post-create = """
  if [ -d ../repo.main/node_modules ]; then
    ln -s ../repo.main/node_modules ./node_modules
  else
    npm install
  fi
"""
```

### 3. Incremental Builds

```bash
# Use build tools that support incremental builds
# - webpack with cache
# - vite with cache
# - cargo with target/ sharing

[hooks]
post-create = "wt step copy-ignored"  # Copy target/, .next/, etc.
```

## Integration Checklist

Before implementing parallel execution:

- [ ] Install worktrunk: `brew install worktrunk && wt config shell install`
- [ ] Configure shell integration
- [ ] Set up hooks in `.worktrunk/config.toml`
- [ ] Define branch naming conventions
- [ ] Establish file ownership boundaries
- [ ] Configure LLM commit messages (optional)
- [ ] Set up dev server port allocation
- [ ] Test merge strategies
- [ ] Document team workflows
- [ ] Monitor resource usage

## Example: Full Parallel Workflow

```bash
# 1. Start from clean main
wt switch main
git pull

# 2. Create parallel worktrees for independent tasks
wt switch -c -x claude task-auth
wt switch -c -x claude task-api
wt switch -c -x claude task-ui

# 3. Each agent works independently
# Agent 1: Implements authentication in src/auth/
# Agent 2: Creates API endpoints in src/api/
# Agent 3: Builds UI components in src/components/

# 4. Monitor progress
wt list --full

# 5. Merge in dependency order
wt switch task-auth && wt merge main
wt switch task-api && wt merge main
wt switch task-ui && wt merge main

# 6. Final verification
wt switch main
git log --oneline -5
npm test
npm run build

# 7. Deploy
git push
npm run deploy
```

## Additional Resources

- [Worktrunk Documentation](https://worktrunk.dev)
- [Git Worktree Reference](https://git-scm.com/docs/git-worktree)
- [Auto-Orchestrate Workflow](../workflows/auto-orchestrate.js)
- [Git Workflow Skill](../git-workflow/)
