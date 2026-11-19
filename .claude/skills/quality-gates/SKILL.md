---
name: quality-gates
description: Multi-layer quality validation system with automated gates and checkpoints
description_zh: 多层质量验证系统，具有自动化门控和检查点
allowed-tools: Read, Bash, Edit, Write
---

# Quality Gates Skill

Multi-layer quality validation system with automated gates and checkpoints.

## Purpose

Ensure code quality through systematic validation at multiple stages of development.

## When to Use

- Before committing code
- Before merging branches
- Before deployment
- During code review
- After implementing features

## Quality Gate Layers

### 1. Code Quality Gates

**Syntax and Style**
- [ ] No syntax errors
- [ ] Follows coding standards
- [ ] No linting errors
- [ ] Consistent formatting

**Complexity**
- [ ] Cyclomatic complexity < 10
- [ ] Function length < 50 lines
- [ ] File length < 500 lines
- [ ] Nesting depth < 4

**Maintainability**
- [ ] Clear naming conventions
- [ ] Appropriate comments
- [ ] No code duplication
- [ ] Proper abstraction

### 2. Test Quality Gates

**Coverage**
- [ ] Unit test coverage > 80%
- [ ] Integration test coverage > 70%
- [ ] Critical paths 100% covered
- [ ] Edge cases tested

**Quality**
- [ ] All tests pass
- [ ] No flaky tests
- [ ] Tests are deterministic
- [ ] Tests are fast (< 5s per test)

### 3. Security Quality Gates

**Input Validation**
- [ ] All inputs validated
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection

**Authentication & Authorization**
- [ ] Proper authentication
- [ ] Role-based access control
- [ ] Session management
- [ ] Secure password storage

**Data Protection**
- [ ] Sensitive data encrypted
- [ ] No hardcoded secrets
- [ ] Secure data transmission
- [ ] Proper data sanitization

### 4. Performance Quality Gates

**Response Time**
- [ ] API response < 200ms
- [ ] Page load < 2s
- [ ] Database query < 100ms
- [ ] No N+1 queries

**Resource Usage**
- [ ] Memory usage < 500MB
- [ ] CPU usage < 70%
- [ ] No memory leaks
- [ ] Efficient algorithms

### 5. Documentation Quality Gates

**Code Documentation**
- [ ] Functions documented
- [ ] Complex logic explained
- [ ] API documentation complete
- [ ] Examples provided

**User Documentation**
- [ ] README updated
- [ ] Installation guide
- [ ] Usage examples
- [ ] Troubleshooting guide

## Implementation Steps

### 1. Gate Configuration

Configure which gates to apply:
```json
{
  "gates": {
    "preCommit": ["syntax", "lint", "unitTests"],
    "preMerge": ["coverage", "security", "performance"],
    "preDeploy": ["integration", "e2e", "documentation"]
  }
}
```

### 2. Gate Execution

Execute gates in sequence:
1. Run syntax validation
2. Run linting checks
3. Run unit tests
4. Check coverage
5. Run security scans
6. Run performance tests
7. Validate documentation

### 3. Results Aggregation

Aggregate results from all gates:
```json
{
  "overallStatus": "pass|fail|warn",
  "gates": {
    "syntax": { "status": "pass", "score": 100 },
    "lint": { "status": "pass", "score": 95 },
    "tests": { "status": "pass", "score": 88 }
  },
  "blockers": [],
  "warnings": []
}
```

### 4. Gate Enforcement

Enforce gate results:
- **Pass**: Proceed to next stage
- **Warn**: Proceed with warnings
- **Fail**: Block progression

## Quality Gate Definitions

### Pre-Commit Gates

```javascript
const preCommitGates = [
  {
    name: 'syntax-check',
    command: 'npm run lint',
    threshold: 0,
    blocker: true
  },
  {
    name: 'unit-tests',
    command: 'npm test',
    threshold: 100,
    blocker: true
  },
  {
    name: 'type-check',
    command: 'npm run type-check',
    threshold: 0,
    blocker: true
  }
];
```

### Pre-Merge Gates

```javascript
const preMergeGates = [
  {
    name: 'coverage',
    command: 'npm run coverage',
    threshold: 80,
    blocker: true
  },
  {
    name: 'security-scan',
    command: 'npm audit',
    threshold: 0,
    blocker: true
  },
  {
    name: 'performance',
    command: 'npm run perf-test',
    threshold: 90,
    blocker: false
  }
];
```

## Output Format

```json
{
  "qualityReport": {
    "timestamp": "2024-01-01T12:00:00Z",
    "overallStatus": "pass",
    "overallScore": 92,
    "gates": {
      "codeQuality": {
        "status": "pass",
        "score": 95,
        "checks": [
          { "name": "syntax", "status": "pass" },
          { "name": "lint", "status": "pass" },
          { "name": "complexity", "status": "pass" }
        ]
      },
      "testQuality": {
        "status": "pass",
        "score": 88,
        "checks": [
          { "name": "coverage", "status": "pass", "value": 85 },
          { "name": "tests", "status": "pass", "value": 100 }
        ]
      },
      "securityQuality": {
        "status": "pass",
        "score": 90,
        "checks": [
          { "name": "vulnerabilities", "status": "pass" },
          { "name": "secrets", "status": "pass" }
        ]
      }
    },
    "blockers": [],
    "warnings": ["Consider adding more edge case tests"]
  }
}
```

## Error Handling

- **Gate failure**: Provide detailed failure report
- **Gate timeout**: Retry with exponential backoff
- **Gate error**: Log error and continue with other gates
- **Configuration error**: Use default gate configuration

## Integration Points

- Receives from: Code changes, test results
- Coordinates with: CI/CD pipeline, code review
- Outputs to: Quality dashboard, deployment decisions
- Feeds into: Continuous integration

## Example

```bash
# Run all quality gates
/quality-gates

# Run specific gate
/quality-gates pre-commit

# Output: Quality report with scores and status
```
