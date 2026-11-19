---
name: testing-qa
description: Comprehensive testing and quality assurance for code changes with multi-layer validation
description_zh: 代码变更的全面测试和质量保证，具有多层验证
allowed-tools: Read, Bash, Edit, Write
---

# Testing & QA Skill

Comprehensive testing and quality assurance with multi-layer validation.

## Purpose

Ensure code quality through systematic testing, validation, and quality gates.

## When to Use

- After implementing new features
- Before committing changes
- During code review process
- When fixing bugs
- Before deployment

## Testing Layers

### 1. Unit Testing

Test individual components in isolation:
- Function-level tests
- Module-level tests
- Edge case coverage
- Error path validation

```javascript
// Example unit test structure
describe('ComponentName', () => {
  test('should handle normal case', () => {
    // Arrange
    const input = createInput();
    
    // Act
    const result = component.process(input);
    
    // Assert
    expect(result).toBe(expected);
  });

  test('should handle edge case', () => {
    // Edge case test
  });

  test('should handle error case', () => {
    // Error handling test
  });
});
```

### 2. Integration Testing

Test component interactions:
- API endpoint tests
- Database integration tests
- Service communication tests
- Data flow validation

### 3. Validation Testing

Validate against requirements:
- Business logic validation
- Data integrity checks
- Constraint validation
- Schema validation

### 4. Performance Testing

Validate performance characteristics:
- Response time tests
- Load testing
- Stress testing
- Resource usage monitoring

### 5. Security Testing

Validate security properties:
- Input validation
- Authentication checks
- Authorization validation
- Injection prevention

## Quality Gates

### Pre-Commit Gates

- [ ] All unit tests pass
- [ ] Code coverage > 80%
- [ ] No linting errors
- [ ] No type errors
- [ ] No security vulnerabilities

### Pre-Integration Gates

- [ ] Integration tests pass
- [ ] API contracts validated
- [ ] Database migrations tested
- [ ] Performance benchmarks met

### Pre-Deployment Gates

- [ ] End-to-end tests pass
- [ ] Security audit complete
- [ ] Performance tests pass
- [ ] Documentation updated

## Implementation Steps

### 1. Test Planning

Identify what needs testing:
- New features
- Modified code
- Integration points
- Edge cases

### 2. Test Design

Design test cases:
- Normal path tests
- Edge case tests
- Error path tests
- Performance tests

### 3. Test Implementation

Write test code:
- Unit tests
- Integration tests
- Validation tests
- Performance tests

### 4. Test Execution

Run tests systematically:
- Execute unit tests
- Execute integration tests
- Execute validation tests
- Execute performance tests

### 5. Results Analysis

Analyze test results:
- Identify failures
- Analyze coverage
- Identify performance issues
- Identify security issues

### 6. Quality Report

Generate quality report:
- Test results summary
- Coverage metrics
- Performance metrics
- Security findings
- Recommendations

## Output Format

```json
{
  "testResults": {
    "unit": {
      "total": 100,
      "passed": 95,
      "failed": 5,
      "coverage": 85
    },
    "integration": {
      "total": 20,
      "passed": 20,
      "failed": 0
    },
    "validation": {
      "total": 10,
      "passed": 10,
      "failed": 0
    },
    "performance": {
      "avgResponseTime": 150,
      "p95ResponseTime": 300,
      "throughput": 1000
    }
  },
  "qualityGates": {
    "preCommit": "pass",
    "preIntegration": "pass",
    "preDeployment": "pending"
  },
  "recommendations": [
    "Add more edge case tests",
    "Optimize database queries"
  ]
}
```

## Error Handling

- **Test failures**: Provide detailed failure analysis
- **Coverage gaps**: Identify untested code paths
- **Performance issues**: Provide optimization recommendations
- **Security issues**: Provide remediation steps

## Integration Points

- Receives from: Code changes, implementation tasks
- Coordinates with: Code review, deployment pipeline
- Outputs to: Quality dashboard, deployment decisions
- Feeds into: Continuous integration

## Example

```bash
# Run comprehensive testing
/testing-qa

# Output: Test results, coverage, quality gates status
```
