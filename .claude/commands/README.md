---
description: Complete reference for Claude Code slash commands organized by category including planning, implementation, search, design, documentation, git operations, and utility commands with usage examples
---

# Claude Code Commands

Slash commands that provide quick access to common workflows and specialized tasks. Commands are invoked with `/command-name` syntax.

## Available Commands

### Planning & Analysis

#### `/plan [task]`
- **Purpose**: Intelligent plan creation with prompt enhancement
- **Usage**: `/plan Implement user authentication system`
- **Behavior**: Analyzes task complexity and routes to `/plan:fast` or `/plan:hard` based on requirements
- **Output**: Comprehensive implementation plan in Markdown format

#### `/plan:fast [task]`
- **Purpose**: Quick planning for straightforward tasks
- **Usage**: `/plan:fast Add login button to homepage`
- **When to use**: Simple features, small changes, well-defined tasks

#### `/plan:hard [task]`
- **Purpose**: Deep planning for complex tasks
- **Usage**: `/plan:hard Refactor database layer for multi-tenancy`
- **When to use**: Complex architectures, system-wide changes, ambiguous requirements

#### `/plan:ci [task]`
- **Purpose**: Plan CI/CD pipeline improvements
- **Usage**: `/plan:ci Optimize GitHub Actions workflow`

#### `/plan:cro [task]`
- **Purpose**: Plan conversion rate optimization
- **Usage**: `/plan:cro Improve checkout flow conversion`

#### `/plan:two [task]`
- **Purpose**: Create two alternative plans for comparison
- **Usage**: `/plan:two Compare REST vs GraphQL for API`

### Code & Implementation

#### `/code [plan]`
- **Purpose**: Start coding and testing from an existing plan
- **Usage**: `/code plans/auth-implementation/plan.md`
- **Behavior**: Reads plan, implements phases sequentially, validates each milestone
- **Workflow**: Analysis → Implementation → Testing → Progress Updates

#### `/fix [issue]`
- **Purpose**: Quick bug fixes and issue resolution
- **Usage**: `/fix Login button not responding on mobile`
- **When to use**: Small bugs, quick fixes, error resolution

#### `/fix:fast [issue]`
- **Purpose**: Fast fix for simple issues
- **Usage**: `/fix:fast Typo in error message`

#### `/fix:hard [issue]`
- **Purpose**: Complex bug investigation and resolution
- **Usage**: `/fix:hard Race condition in WebSocket handler`

#### `/fix:ui [issue]`
- **Purpose**: UI/UX bug fixes
- **Usage**: `/fix:ui Modal not closing on backdrop click`

#### `/fix:test [issue]`
- **Purpose**: Test-related fixes
- **Usage**: `/fix:test Flaky integration test in auth module`

#### `/fix:types [issue]`
- **Purpose**: TypeScript type errors
- **Usage**: `/fix:types Type mismatch in API response handler`

#### `/fix:logs [issue]`
- **Purpose**: Logging and debugging fixes
- **Usage**: `/fix:logs Missing error logs in payment flow`

#### `/fix:ci [issue]`
- **Purpose**: CI/CD pipeline fixes
- **Usage**: `/fix:ci Build failing on GitHub Actions`

### Search & Discovery

#### `/scout [prompt] [scale]`
- **Purpose**: Search codebase for relevant files using parallel agents
- **Usage**: `/scout Find all payment-related files 5`
- **Parameters**: 
  - `[prompt]`: What to search for
  - `[scale]`: Number of parallel agents (default: 3)
- **Behavior**: Spawns multiple agents to search different directories in parallel
- **Output**: Comprehensive file list with locations

#### `/scout:ext [prompt]`
- **Purpose**: Search external resources and documentation
- **Usage**: `/scout:ext Find Stripe API documentation for webhooks`
- **When to use**: Need external docs, third-party library info, web resources

### Design & Content

#### `/design:3d [description]`
- **Purpose**: Create 3D designs and models
- **Usage**: `/design:3d Product showcase with rotating animation`

#### `/design:describe [image]`
- **Purpose**: Analyze and describe visual designs
- **Usage**: `/design:describe Analyze this UI mockup`

#### `/design:fast [description]`
- **Purpose**: Quick design tasks
- **Usage**: `/design:fast Simple button component`

#### `/design:good [description]`
- **Purpose**: High-quality design work
- **Usage**: `/design:good Landing page with hero section`

#### `/design:screenshot [url]`
- **Purpose**: Capture and analyze screenshots
- **Usage**: `/design:screenshot https://example.com`

#### `/design:video [description]`
- **Purpose**: Create video content or animations
- **Usage**: `/design:video Product demo animation`

#### `/content:fast [task]`
- **Purpose**: Quick content creation
- **Usage**: `/content:fast Write product description`

#### `/content:good [task]`
- **Purpose**: High-quality content creation
- **Usage**: `/content:good Write comprehensive API documentation`

#### `/content:enhance [content]`
- **Purpose**: Improve existing content
- **Usage**: `/content:enhance Improve this README file`

#### `/content:cro [task]`
- **Purpose**: Conversion-focused content
- **Usage**: `/content:cro Write compelling CTA for signup page`

### Documentation

#### `/docs:init`
- **Purpose**: Initialize documentation structure
- **Usage**: `/docs:init`
- **Behavior**: Creates standard documentation folder structure

#### `/docs:update [topic]`
- **Purpose**: Update specific documentation
- **Usage**: `/docs:update API endpoints`

#### `/docs:summarize [content]`
- **Purpose**: Create documentation summaries
- **Usage**: `/docs:summarize This technical specification`

### Development Workflow

#### `/ask [question]`
- **Purpose**: Answer technical and architectural questions
- **Usage**: `/ask What's the best approach for handling real-time updates?`
- **Behavior**: Consults multiple architectural advisors (Systems Designer, Technology Strategist, Scalability Consultant, Risk Analyst)
- **Output**: Expert consultation with recommendations

#### `/test [scope]`
- **Purpose**: Run tests and validate code
- **Usage**: `/test Run all unit tests`
- **Behavior**: Executes test suites, analyzes coverage, reports results

#### `/debug [issue]`
- **Purpose**: Investigate and debug issues
- **Usage**: `/debug API returning 500 errors`
- **Behavior**: Systematic investigation, log analysis, root cause identification

#### `/review:codebase`
- **Purpose**: Comprehensive codebase review
- **Usage**: `/review:codebase`
- **Behavior**: Analyzes code quality, identifies issues, suggests improvements

### Git & Version Control

#### `/git:cm [message]`
- **Purpose**: Create commit with message
- **Usage**: `/git:cm Add user authentication feature`

#### `/git:cp`
- **Purpose**: Cherry-pick commits
- **Usage**: `/git:cp`

#### `/git:pr [title]`
- **Purpose**: Create pull request
- **Usage**: `/git:pr Implement OAuth2 authentication`

### Integration

#### `/integrate:polar [service]`
- **Purpose**: Integrate Polar services
- **Usage**: `/integrate:polar Payment processing`

#### `/integrate:sepay [service]`
- **Purpose**: Integrate SePay services
- **Usage**: `/integrate:sepay Vietnamese payment gateway`

### Utility

#### `/journal [entry]`
- **Purpose**: Create development journal entries
- **Usage**: `/journal Today's progress on authentication`

#### `/watzup`
- **Purpose**: Quick status check
- **Usage**: `/watzup`
- **Behavior**: Shows current project status and recent activity

#### `/use-mcp [server]`
- **Purpose**: Use MCP (Model Context Protocol) tools
- **Usage**: `/use-mcp filesystem`

#### `/bootstrap`
- **Purpose**: Bootstrap project setup
- **Usage**: `/bootstrap`
- **Behavior**: Initializes project with recommended structure and configurations

#### `/bootstrap:auto`
- **Purpose**: Automatic project bootstrap
- **Usage**: `/bootstrap:auto`

#### `/bootstrap:auto:fast`
- **Purpose**: Fast automatic bootstrap
- **Usage**: `/bootstrap:auto:fast`

### Cooking (Iterative Development)

#### `/cook [recipe]`
- **Purpose**: Iterative development with feedback loops
- **Usage**: `/cook Implement feature X`
- **Behavior**: Develop, test, refine cycle

#### `/cook:auto [recipe]`
- **Purpose**: Automatic cooking workflow
- **Usage**: `/cook:auto Build API endpoint`

#### `/cook:auto:fast [recipe]`
- **Purpose**: Fast automatic cooking
- **Usage**: `/cook:auto:fast Quick prototype`

### Skill Management

#### `/skill:add [skill]`
- **Purpose**: Add a new skill
- **Usage**: `/skill:add custom-skill`

#### `/skill:create [name]`
- **Purpose**: Create custom skill
- **Usage**: `/skill:create my-skill`

#### `/skill:fix-logs [skill]`
- **Purpose**: Fix skill logging issues
- **Usage**: `/skill:fix-logs broken-skill`

#### `/skill:optimize [skill]`
- **Purpose**: Optimize skill performance
- **Usage**: `/skill:optimize slow-skill`

#### `/skill:optimize:auto [skill]`
- **Purpose**: Automatic skill optimization
- **Usage**: `/skill:optimize:auto inefficient-skill`

## Command Categories

### By Purpose

| Category | Commands |
|----------|----------|
| **Planning** | `/plan`, `/plan:fast`, `/plan:hard`, `/plan:ci`, `/plan:cro`, `/plan:two` |
| **Implementation** | `/code`, `/fix`, `/fix:fast`, `/fix:hard`, `/fix:ui`, `/fix:test`, `/fix:types`, `/fix:logs`, `/fix:ci` |
| **Search** | `/scout`, `/scout:ext` |
| **Design** | `/design:3d`, `/design:describe`, `/design:fast`, `/design:good`, `/design:screenshot`, `/design:video` |
| **Content** | `/content:fast`, `/content:good`, `/content:enhance`, `/content:cro` |
| **Documentation** | `/docs:init`, `/docs:update`, `/docs:summarize` |
| **Development** | `/ask`, `/test`, `/debug`, `/review:codebase` |
| **Git** | `/git:cm`, `/git:cp`, `/git:pr` |
| **Integration** | `/integrate:polar`, `/integrate:sepay` |
| **Utility** | `/journal`, `/watzup`, `/use-mcp`, `/bootstrap`, `/bootstrap:auto`, `/bootstrap:auto:fast` |
| **Iterative** | `/cook`, `/cook:auto`, `/cook:auto:fast` |
| **Skills** | `/skill:add`, `/skill:create`, `/skill:fix-logs`, `/skill:optimize`, `/skill:optimize:auto` |

### By Complexity

**Quick Commands** (simple tasks):
- `/fix:fast`, `/plan:fast`, `/design:fast`, `/content:fast`, `/bootstrap:auto:fast`

**Standard Commands** (moderate complexity):
- `/fix`, `/plan`, `/design:good`, `/content:good`, `/test`, `/debug`

**Deep Commands** (complex tasks):
- `/fix:hard`, `/plan:hard`, `/review:codebase`, `/ask`

## Usage Patterns

### Planning Workflow
```bash
/plan Implement user authentication
# → Analyzes complexity, creates comprehensive plan

/code plans/auth-implementation/plan.md
# → Implements the plan phase by phase

/test
# → Validates implementation

/review:codebase
# → Reviews code quality
```

### Debugging Workflow
```bash
/debug API returning 500 errors
# → Investigates issue

/fix:hard Race condition in WebSocket handler
# → Fixes complex bug

/test
# → Validates fix
```

### Search & Implement Workflow
```bash
/scout Find all payment-related files 5
# → Locates relevant files

/code plans/payment-integration/plan.md
# → Implements using located files
```

## Command Arguments

Most commands accept arguments:
- `$ARGUMENTS` or `$1`: Primary argument (task description, file path, etc.)
- `$2`, `$3`, etc.: Additional parameters (scale, options, etc.)

Example:
```bash
/scout Find payment files 5
# $1 = "Find payment files"
# $2 = "5" (scale)
```

## Best Practices

1. **Be specific**: Provide clear, detailed task descriptions
2. **Use the right command**: Match command complexity to task complexity
3. **Chain commands**: Use outputs from one command as inputs to another
4. **Review outputs**: Always validate command results before proceeding
5. **Combine with agents**: Commands often invoke specialized agents automatically

## Related Documentation

- [Agents Overview](../agents/README.md) - Agents that commands invoke
- [Skills Reference](../skills/README.md) - Skills that commands activate
- [Workflows Guide](../workflows/README.md) - Automated workflows
