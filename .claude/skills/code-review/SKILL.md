---
name: code-review
description: Comprehensive code review with multi-dimensional analysis and automated quality checks
description_zh: 具有多维分析和自动化质量检查的全面代码审查
allowed-tools: Read, Bash, Edit, Write
---

# Code Review Skill

Comprehensive code review with multi-dimensional analysis and automated quality checks.

## Purpose

Ensure code quality through systematic review covering correctness, maintainability, performance, and security.

## When to Use

- Before merging pull requests
- After implementing features
- During refactoring
- When fixing bugs
- Before deployment

## Review Dimensions

### 1. Correctness

**Logic Validation**
- [ ] Business logic is correct
- [ ] Edge cases handled
- [ ] Error paths validated
- [ ] Return values correct

**Data Integrity**
- [ ] Input validation present
- [ ] Type safety maintained
- [ ] Null/undefined checks
- [ ] Boundary conditions tested

### 2. Maintainability

**Code Structure**
- [ ] Clear naming conventions
- [ ] Appropriate abstraction
- [ ] No code duplication
- [ ] Single responsibility principle

**Documentation**
- [ ] Complex logic commented
- [ ] API documentation complete
- [ ] Examples provided
- [ ] README updated if needed

**Readability**
- [ ] Code is self-documenting
- [ ] Consistent formatting
- [ ] Appropriate function length
- [ ] Clear control flow

### 3. Performance

**Efficiency**
- [ ] No N+1 queries
- [ ] Appropriate algorithms
- [ ] No unnecessary loops
- [ ] Memory usage optimized

**Resource Usage**
- [ ] Database queries optimized
- [ ] Caching used appropriately
- [ ] No memory leaks
- [ ] Async operations correct

### 4. Security

**Input Validation**
- [ ] All inputs validated
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection

**Authentication & Authorization**
- [ ] Proper auth checks
- [ ] Role-based access control
- [ ] Session management
- [ ] Secure password handling

**Data Protection**
- [ ] Sensitive data encrypted
- [ ] No hardcoded secrets
- [ ] Secure transmission
- [ ] Proper sanitization

### 5. Testing

**Test Coverage**
- [ ] Unit tests present
- [ ] Integration tests present
- [ ] Edge cases tested
- [ ] Error paths tested

**Test Quality**
- [ ] Tests are deterministic
- [ ] Tests are fast
- [ ] Tests are readable
- [ ] Mocks used appropriately

## Review Process

### 1. Initial Scan

Quick scan for obvious issues:
- Syntax errors
- Missing imports
- Type errors
- Linting issues

### 2. Deep Analysis

Detailed analysis of each dimension:
- Logic correctness
- Code structure
- Performance characteristics
- Security vulnerabilities
- Test coverage

### 3. Pattern Detection

Identify common patterns:
- Code smells
- Anti-patterns
- Best practices violations
- Optimization opportunities

### 4. Recommendations

Provide actionable recommendations:
- Critical issues (must fix)
- Important issues (should fix)
- Suggestions (nice to have)
- Positive observations

## Output Format

```json
{
  "review": {
    "timestamp": "2024-01-01T12:00:00Z",
    "files": ["file1.js", "file2.js"],
    "overallScore": 85,
    "dimensions": {
      "correctness": {
        "score": 90,
        "issues": [],
        "strengths": ["Good error handling"]
      },
      "maintainability": {
        "score": 85,
        "issues": ["Function too long"],
        "strengths": ["Clear naming"]
      },
      "performance": {
        "score": 80,
        "issues": ["N+1 query detected"],
        "strengths": []
      },
      "security": {
        "score": 95,
        "issues": [],
        "strengths": ["Input validation present"]
      },
      "testing": {
        "score": 75,
        "issues": ["Missing edge case tests"],
        "strengths": ["Good unit test coverage"]
      }
    },
    "critical": [],
    "important": [
      {
        "file": "file1.js",
        "line": 42,
        "issue": "N+1 query detected",
        "recommendation": "Use eager loading"
      }
    ],
    "suggestions": [
      "Consider extracting helper function"
    ],
    "positive": [
      "Good error handling",
      "Clear naming conventions"
    ]
  }
}
```

## Review Checklist

### Pre-Review

- [ ] Understand the context and requirements
- [ ] Review related code and dependencies
- [ ] Check test coverage
- [ ] Run automated checks

### During Review

- [ ] Check correctness of logic
- [ ] Evaluate code structure
- [ ] Assess performance impact
- [ ] Verify security measures
- [ ] Validate test quality

### Post-Review

- [ ] Provide clear, actionable feedback
- [ ] Prioritize issues by severity
- [ ] Suggest improvements
- [ ] Acknowledge good practices

## Error Handling

- **Review timeout**: Provide partial results with warning
- **File access error**: Skip file and note in report
- **Analysis error**: Continue with other dimensions
- **Configuration error**: Use default review settings

## Integration Points

- Receives from: Code changes, pull requests
- Coordinates with: CI/CD pipeline, testing
- Outputs to: Quality dashboard, merge decisions
- Feeds into: Continuous improvement

## Example

```bash
# Review code changes
/code-review

# Review specific files
/code-review file1.js file2.js

# Output: Comprehensive review report with scores and recommendations
```
