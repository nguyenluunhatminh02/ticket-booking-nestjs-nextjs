# Quality Gates Skill

Enforce rigorous quality standards throughout the development workflow. This skill provides automated checks for test honesty, code review integrity, and evidence-based completion verification.

## When to Apply

Activate these quality gates when:
- Writing or modifying tests
- Conducting code reviews
- Completing features or bug fixes
- Preparing pull requests
- Running CI/CD pipelines

## Gate 1: Test Honesty Enforcement

### Purpose
Ensure tests genuinely verify behavior rather than just passing.

### Patterns to Enforce

#### 1.1 No Mock-Driven False Positives
**BAD**: Tests that pass only because mocks return expected values
```javascript
// BAD: Mock makes test pass without testing real logic
jest.mock('./api', () => ({ fetchUser: () => ({ id: 1, name: 'John' }) }));
test('fetches user', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('John'); // Always passes
});
```

**GOOD**: Tests that verify actual behavior
```javascript
// GOOD: Test verifies real API call or uses integration test
test('fetches user from API', async () => {
  const user = await realApi.fetchUser(1);
  expect(user).toHaveProperty('id', 1);
  expect(user).toHaveProperty('name');
});
```

#### 1.2 Assertions Must Verify Meaningful Behavior
**BAD**: Assertions that check implementation details
```javascript
// BAD: Tests internal state, not behavior
expect(component.state.loading).toBe(false);
expect(mockFn).toHaveBeenCalled(); // Without checking result
```

**GOOD**: Assertions that verify observable outcomes
```javascript
// GOOD: Tests user-visible behavior
expect(screen.getByText('Success')).toBeInTheDocument();
expect(await screen.findByRole('button', { name: 'Submit' })).toBeEnabled();
```

#### 1.3 Test Isolation and Independence
**BAD**: Tests that depend on execution order or shared state
```javascript
// BAD: Test B depends on Test A's side effects
test('creates user', () => { createUser('John'); });
test('finds user', () => { expect(findUser('John')).toBeTruthy(); });
```

**GOOD**: Each test sets up its own state
```javascript
// GOOD: Each test is self-contained
test('creates user', () => {
  const user = createUser('John');
  expect(user).toHaveProperty('id');
});

test('finds existing user', () => {
  const user = createUser('Jane');
  const found = findUser('Jane');
  expect(found).toEqual(user);
});
```

#### 1.4 No Hardcoded Timestamps or IDs
**BAD**: Tests with hardcoded values that break over time
```javascript
// BAD: Hardcoded date will fail
expect(user.createdAt).toBe('2024-01-01T00:00:00Z');
```

**GOOD**: Tests use relative or dynamic values
```javascript
// GOOD: Verify structure, not exact value
expect(user.createdAt).toBeInstanceOf(Date);
expect(user.createdAt.getTime()).toBeLessThan(Date.now());
```

### Verification Checklist
- [ ] Tests fail when implementation is broken (mutation testing)
- [ ] No test passes solely due to mocks
- [ ] Assertions check behavior, not implementation
- [ ] Tests run independently in any order
- [ ] No hardcoded timestamps, IDs, or environment-specific values
- [ ] Edge cases and error paths are tested
- [ ] Test names describe the behavior being verified

## Gate 2: Anti-Anchored Review Patterns

### Purpose
Prevent reviewers from anchoring on the author's description rather than examining the actual code.

### Patterns to Enforce

#### 2.1 Review the Diff, Not the Description
**BAD**: Accepting code because "it does what the PR says"
```
PR Description: "Fixed the login bug"
Review: "Looks good, merges the fix"
```

**GOOD**: Verify the code actually fixes the issue
```
1. Read the bug report/issue
2. Examine the code changes
3. Verify the fix addresses the root cause
4. Check for side effects
5. Ensure tests cover the fix
```

#### 2.2 Question Assumptions in Code
**BAD**: Accepting comments at face value
```javascript
// This optimization improves performance by 50%
const result = expensiveOperation();
```

**GOOD**: Verify claims with evidence
```javascript
// Verify: Does this actually improve performance?
// Check: Are there benchmarks or profiling data?
// Question: Is the complexity worth the gain?
```

#### 2.3 Check for Hidden Complexity
**BAD**: Approving because "it looks simple"
```javascript
// Appears simple but hides complexity
const data = transform(input);
```

**GOOD**: Trace the full execution path
```javascript
// Review checklist:
// - What does transform() actually do?
// - What are the edge cases?
// - What happens on error?
// - What are the performance implications?
// - Is this the simplest solution?
```

#### 2.4 Verify Error Handling
**BAD**: Assuming errors are handled
```javascript
try {
  await riskyOperation();
} catch (e) {
  // Error "handled" but not logged or recovered
}
```

**GOOD**: Verify proper error handling
```javascript
// Review checklist:
// - Is the error logged with context?
// - Is the user notified appropriately?
// - Is there a recovery path?
// - Are resources cleaned up?
// - Is the error type correct?
```

### Review Process
1. **Read the issue/requirement first** - understand what problem is being solved
2. **Examine the diff line-by-line** - don't skim
3. **Trace execution paths** - follow the code flow
4. **Check edge cases** - what happens with unusual inputs?
5. **Verify error handling** - what happens when things fail?
6. **Question abstractions** - are they necessary and clear?
7. **Look for side effects** - what else does this change affect?
8. **Check test coverage** - are new paths tested?

### Red Flags
- Vague commit messages like "fix stuff" or "update code"
- Large diffs without clear structure
- Comments that don't match the code
- Missing error handling
- Tests that don't verify the fix
- Performance claims without benchmarks
- "Temporary" solutions without TODO comments

## Gate 3: Evidence-Based Completion Checks

### Purpose
Ensure features are genuinely complete, not just "code complete."

### Patterns to Enforce

#### 3.1 Functional Completeness
**Evidence Required**:
- [ ] All acceptance criteria met (with proof)
- [ ] Feature works end-to-end (with demo/screenshots)
- [ ] Edge cases handled (with test cases)
- [ ] Error scenarios covered (with examples)

**BAD**: "I implemented the feature"
**GOOD**: "Feature implemented. Here's a video showing it working with these edge cases handled."

#### 3.2 Test Coverage Completeness
**Evidence Required**:
- [ ] Unit tests for all new functions (coverage report)
- [ ] Integration tests for new workflows (passing tests)
- [ ] E2E tests for critical paths (screenshots/video)
- [ ] Edge case tests (test file locations)

**BAD**: "Tests added"
**GOOD**: "Added 15 unit tests (95% coverage), 3 integration tests, 2 E2E tests. Coverage report attached."

#### 3.3 Documentation Completeness
**Evidence Required**:
- [ ] API documentation updated (link to docs)
- [ ] README updated if needed (diff shown)
- [ ] Code comments for complex logic (file locations)
- [ ] User-facing documentation (link)

**BAD**: "Docs updated"
**GOOD**: "Updated API docs at /docs/api.md lines 45-67. Added JSDoc comments to utils.js:23-45."

#### 3.4 Quality Completeness
**Evidence Required**:
- [ ] Code review completed (PR link)
- [ ] No linting errors (lint output)
- [ ] No TypeScript errors (tsc output)
- [ ] Performance benchmarks (if applicable)
- [ ] Security review (if applicable)

**BAD**: "Code is clean"
**GOOD**: "ESLint: 0 errors. TypeScript: 0 errors. Performance: 50ms avg response time (benchmarks attached)."

#### 3.5 Deployment Readiness
**Evidence Required**:
- [ ] Environment variables documented (list)
- [ ] Database migrations tested (migration files)
- [ ] Rollback plan documented (steps)
- [ ] Monitoring/alerts configured (screenshots)
- [ ] Feature flags set up (if applicable)

**BAD**: "Ready to deploy"
**GOOD**: "Deployment ready. Env vars: DB_URL, API_KEY. Migration: 20240115_add_users.sql tested on staging. Rollback: revert migration, disable feature flag."

### Completion Verification Template

When marking a task complete, provide:

```markdown
## Completion Evidence

### Functional
- [ ] Acceptance criteria met: [list each criterion with proof]
- [ ] Works end-to-end: [demo link/screenshot/video]
- [ ] Edge cases: [list cases and how handled]

### Testing
- [ ] Unit tests: [count, coverage %, file locations]
- [ ] Integration tests: [count, file locations]
- [ ] E2E tests: [count, file locations]
- [ ] All tests passing: [test output or CI link]

### Documentation
- [ ] Code comments: [file locations]
- [ ] API docs: [link or "N/A"]
- [ ] README: [updated/not needed]
- [ ] User docs: [link or "N/A"]

### Quality
- [ ] Code review: [PR link, reviewer names]
- [ ] Linting: [0 errors, output attached]
- [ ] Type checking: [0 errors, output attached]
- [ ] Performance: [metrics or "N/A"]

### Deployment
- [ ] Env vars: [list or "none needed"]
- [ ] Migrations: [files or "none needed"]
- [ ] Rollback plan: [steps or "N/A"]
- [ ] Monitoring: [configured or "N/A"]
```

## Gate 4: Automated Quality Checks

### Pre-Commit Hooks
Implement these checks in `.husky/pre-commit` or equivalent:

```bash
#!/bin/sh
# Run quality gates before commit

# 1. Linting
npm run lint || exit 1

# 2. Type checking
npm run type-check || exit 1

# 3. Unit tests
npm run test:unit || exit 1

# 4. Test coverage check
npm run test:coverage -- --coverageThreshold='{"global":{"branches":80,"functions":80,"lines":80,"statements":80}}' || exit 1

# 5. Security audit
npm audit --audit-level=moderate || exit 1
```

### CI/CD Pipeline Checks
Add these to your CI configuration:

```yaml
# Example GitHub Actions
quality-gates:
  steps:
    - name: Lint
      run: npm run lint
    
    - name: Type Check
      run: npm run type-check
    
    - name: Unit Tests
      run: npm run test:unit
    
    - name: Integration Tests
      run: npm run test:integration
    
    - name: E2E Tests
      run: npm run test:e2e
    
    - name: Coverage Report
      run: |
        npm run test:coverage
        # Fail if coverage < 80%
        COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
        if (( $(echo "$COVERAGE < 80" | bc -l) )); then
          echo "Coverage $COVERAGE% is below 80% threshold"
          exit 1
        fi
    
    - name: Security Audit
      run: npm audit --audit-level=moderate
    
    - name: Bundle Size Check
      run: |
        npm run build
        # Check bundle size doesn't exceed threshold
        SIZE=$(du -m dist/bundle.js | cut -f1)
        if [ $SIZE -gt 5 ]; then
          echo "Bundle size ${SIZE}MB exceeds 5MB limit"
          exit 1
        fi
```

### Quality Metrics Dashboard
Track these metrics:

1. **Test Coverage**
   - Line coverage: target > 80%
   - Branch coverage: target > 80%
   - Function coverage: target > 80%

2. **Code Quality**
   - ESLint errors: target = 0
   - TypeScript errors: target = 0
   - Code duplication: target < 5%

3. **Performance**
   - Build time: track trend
   - Bundle size: track trend
   - Test execution time: track trend

4. **Security**
   - Vulnerabilities: target = 0 critical/high
   - Dependency updates: target < 7 days old

## Gate 5: Test Mutation Verification

### Purpose
Ensure tests actually catch bugs by mutating the code.

### Process

1. **Run mutation tests** using a tool like Stryker:
```bash
npx stryker run
```

2. **Review mutation score**:
   - Target: > 80% mutation score
   - If < 80%, add tests for unmutated code paths

3. **Analyze survived mutations**:
   - Each survived mutation = a bug your tests don't catch
   - Add tests to catch these mutations

### Example Mutation Report
```
Mutation testing report:
- Killed: 150 (85%)
- Survived: 25 (14%)
- Timeout: 2 (1%)

Survived mutations to address:
1. src/utils.js:23 - Changed > to >= (not caught by tests)
2. src/api.js:45 - Removed null check (not caught by tests)
3. src/auth.js:67 - Changed && to || (not caught by tests)
```

## Integration with Development Workflow

### For Developers
1. Before committing: Run local quality gates
2. Before PR: Complete the completion evidence template
3. During review: Follow anti-anchored review patterns
4. After merge: Verify deployment readiness

### For Reviewers
1. Read the issue first, then the code
2. Question assumptions and claims
3. Verify test honesty (do tests actually test?)
4. Check for evidence of completion
5. Trace execution paths and edge cases

### For Tech Leads
1. Set up automated quality gates in CI/CD
2. Monitor quality metrics dashboard
3. Enforce completion evidence in PR templates
4. Conduct regular mutation testing
5. Review and update quality standards quarterly

## Common Violations and Fixes

### Violation 1: Tests That Always Pass
**Symptom**: Tests pass even when code is broken
**Fix**: Add mutation testing, review test assertions

### Violation 2: Rubber-Stamp Reviews
**Symptom**: PRs approved without substantive feedback
**Fix**: Require reviewers to comment on specific lines, use anti-anchored patterns

### Violation 3: "Done" Without Evidence
**Symptom**: Tasks marked complete without proof
**Fix**: Require completion evidence template, block merge without evidence

### Violation 4: Coverage Without Quality
**Symptom**: High coverage but tests don't catch bugs
**Fix**: Add mutation testing, review test quality not just quantity

### Violation 5: Ignoring Edge Cases
**Symptom**: Happy path works, edge cases fail in production
**Fix**: Require edge case tests, use property-based testing

## Tools and Resources

### Recommended Tools
- **Mutation Testing**: Stryker, Mutation Testing Element
- **Coverage**: Istanbul, c8, Coverage.py
- **Linting**: ESLint, Pylint, RuboCop
- **Type Checking**: TypeScript, mypy, Sorbet
- **Security**: npm audit, Snyk, Dependabot
- **Performance**: Lighthouse, WebPageTest, k6

### Further Reading
- "Working Effectively with Legacy Code" - Michael Feathers
- "The Art of Unit Testing" - Roy Osherove
- "Accelerate" - Nicole Forsgren et al.
- Google's Testing Blog: testing.googleblog.com
- Martin Fowler's Refactoring: martinfowler.com/refactoring

## Conclusion

Quality gates are not about slowing down development—they're about catching problems early when they're cheap to fix. By enforcing test honesty, anti-anchored reviews, and evidence-based completion, you build a culture of quality that pays dividends in reduced bugs, faster reviews, and more reliable deployments.

Remember: **Quality is not an act, it is a habit.** - Aristotle