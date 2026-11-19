---
name: git-workflow
description: Git best practices, branching strategies (GitFlow, GitHub Flow, trunk-based), commit conventions (Conventional Commits), merge vs rebase, pull request workflows, code review processes, release management, and version control automation. Use when setting up Git workflows, establishing commit standards, managing branches, creating pull requests, handling merge conflicts, or automating Git operations.
license: MIT
version: 1.0.0
trigger: When setting up Git workflows, establishing commit standards, managing branches, creating pull requests, handling merge conflicts, or automating Git operations.
---

# Git Workflow Skill

Master version control with proven branching strategies, commit conventions, and collaborative workflows.

## When to Use

- Setting up team Git workflows
- Establishing commit message standards
- Managing feature branches and releases
- Resolving merge conflicts
- Automating Git operations
- Code review processes
- Release management
- Hotfix workflows

## Branching Strategies

**GitHub Flow (Simple):**
- Single main branch
- Feature branches from main
- Pull requests for review
- Merge to main, deploy immediately
- Best for: Continuous deployment, small teams

**GitFlow (Structured):**
- main: Production-ready code
- develop: Integration branch
- feature/*: New features
- release/*: Release preparation
- hotfix/*: Emergency fixes
- Best for: Scheduled releases, larger teams

**Trunk-Based Development:**
- Single main branch
- Short-lived feature branches (<1 day)
- Feature flags for incomplete work
- Continuous integration
- Best for: High-velocity teams, DevOps

## Commit Message Conventions

**Conventional Commits Format:**
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting (no code change)
- refactor: Code restructuring
- perf: Performance improvement
- test: Adding tests
- chore: Maintenance tasks
- ci: CI/CD changes
- build: Build system changes

**Examples:**
```
feat(auth): add OAuth 2.1 support

fix(api): resolve null pointer in user endpoint

docs(readme): update installation instructions

perf(query): optimize database index for 30% faster reads
```

**Benefits:**
- Automated changelog generation
- Semantic versioning automation
- Clear commit history
- Easier code review

## Pull Request Best Practices

**PR Size:**
- Small: <200 lines (ideal)
- Medium: 200-500 lines
- Large: 500+ lines (avoid when possible)

**PR Structure:**
```markdown
## What
Brief description of changes

## Why
Business/technical context

## How
Implementation approach

## Testing
How to verify the changes

## Screenshots
If UI changes
```

**Review Checklist:**
- Code follows style guide
- Tests included and passing
- Documentation updated
- No security vulnerabilities
- Performance impact considered
- Edge cases handled

## Merge Strategies

**Squash and Merge:**
- Combines all commits into one
- Clean linear history
- Best for: Feature branches, small PRs

**Rebase and Merge:**
- Replays commits on top of main
- Linear history, preserves commits
- Best for: Trunk-based development

**Merge Commit:**
- Preserves branch history
- Creates merge commit
- Best for: GitFlow, long-running branches

**Avoid:**
- Merge conflicts in production
- Force pushing shared branches
- Large merge commits

## Handling Merge Conflicts

**Prevention:**
- Pull main frequently
- Keep branches short-lived
- Communicate with team
- Use feature flags

**Resolution Process:**
1. Pull latest main
2. Identify conflicting files
3. Resolve conflicts carefully
4. Test thoroughly
5. Commit with clear message

**Tools:**
- VS Code merge editor
- Git mergetool
- IDE conflict resolution

## Release Management

**Semantic Versioning:**
- MAJOR.MINOR.PATCH
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

**Release Process:**
1. Create release branch
2. Update version numbers
3. Update changelog
4. Test thoroughly
5. Tag release
6. Deploy to production

**Automation:**
- semantic-release
- release-please
- GitHub Actions workflows

## Git Hooks

**Pre-commit:**
- Lint code
- Run tests
- Check commit message format

**Pre-push:**
- Run full test suite
- Check for secrets
- Validate build

**Tools:**
- Husky (Node.js)
- pre-commit (Python)
- lefthook (cross-language)

## Common Commands

**Daily Workflow:**
```bash
git status                    # Check state
git pull --rebase            # Update main
git checkout -b feature/x    # New branch
git add -p                   # Stage changes
git commit                   # Commit
git push -u origin feature/x # Push branch
```

**Cleanup:**
```bash
git branch -d feature/x      # Delete branch
git fetch -p                 # Prune remote
git rebase -i HEAD~3         # Interactive rebase
```

**Troubleshooting:**
```bash
git log --oneline --graph    # Visual history
git reflog                   # Recover lost commits
git stash                    # Save changes
git cherry-pick <commit>     # Apply specific commit
```

## Security Best Practices

- Never commit secrets
- Use .gitignore properly
- Sign commits with GPG
- Review before force push
- Protect main branch
- Require PR reviews
- Enable branch protection rules

## Resources

- Conventional Commits: https://www.conventionalcommits.org/
- Semantic Versioning: https://semver.org/
- GitHub Flow: https://docs.github.com/en/get-started/quickstart/github-flow
- Git Best Practices: https://sethrobertson.github.io/GitBestPractices/
