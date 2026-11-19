---
name: specificity-enforcer
description: Detects generic, vague, and non-specific content in Claude output and enforces concrete examples, exact numbers, and actionable details. Rewrites vague passages into specific, useful content. Use when Claude output feels generic or unhelpful.
description_zh: 检测 Claude 输出中的通用、模糊和非特定内容，并强制要求具体示例、精确数字和可操作的细节。将模糊的段落重写为具体、有用的内容。
allowed-tools: Read, Bash, Edit
---

# Specificity Enforcer

Detects generic, vague content and enforces concrete examples, exact numbers, and actionable details.

## Purpose

AI output often feels "generic" because it lacks specificity. It says "use best practices" without naming them, "optimize performance" without saying how, "several approaches" without listing them. This skill finds vague passages and rewrites them with concrete details, exact numbers, named examples, and actionable steps. It turns AI slop into useful content.

## When to Use

- When Claude output feels generic or unhelpful
- When documentation says "configure appropriately" without saying how
- When guides say "use best practices" without naming them
- When content uses "various", "many", "several" without specifics
- When advice lacks concrete examples
- When recommendations lack trade-offs or constraints
- When steps skip the hard parts
- After anti-slop-validator flags vague language

## Vagueness Patterns Detected

### 1. Unspecified Quantities
- "various methods" -> which methods?
- "several options" -> what options?
- "many ways" -> list the ways
- "a few things" -> name the things
- "some cases" -> which cases?
- "often" -> how often? what percentage?
- "usually" -> what is the usual case?
- "sometimes" -> under what conditions?

### 2. Unspecified Quality
- "better performance" -> how much better? what metric?
- "improved security" -> what was improved? by how much?
- "more efficient" -> efficient by what measure?
- "robust solution" -> what makes it robust?
- "scalable architecture" -> at what scale? what is the limit?
- "flexible design" -> what can it do? what are the constraints?

### 3. Unspecified Actions
- "configure appropriately" -> what is the appropriate configuration?
- "use best practices" -> which practices?
- "follow the guidelines" -> what guidelines? where?
- "implement properly" -> what does proper implementation look like?
- "handle errors" -> what errors? how?
- "optimize the query" -> what optimization? what is the before/after?

### 4. Missing Examples
- Advice without examples
- Concepts without concrete instances
- Steps without sample input/output
- Recommendations without use cases
- Warnings without failure scenarios

### 5. Missing Constraints
- Recommendations without trade-offs
- Solutions without limitations
- Approaches without when-not-to-use
- Benefits without costs
- Shortcuts without risks

## Enforcement Process

### Step 1: Scan for Vagueness
Read the content and flag every instance of vague language using the patterns above.

### Step 2: Classify Each Instance
For each vague instance, classify:
- **Fixable from context**: Can be made specific using information in the project or surrounding text
- **Fixable with common knowledge**: Can be made specific using domain knowledge
- **Needs human input**: Requires information only the author can provide

### Step 3: Rewrite Fixable Instances
For each fixable instance, rewrite with specifics:

**Before**: "Use various optimization techniques to improve performance."
**After**: "Add query caching (reduces DB calls by 60%), implement pagination (cuts response size by 80%), and use connection pooling (handles 3x more concurrent requests)."

**Before**: "Configure the database appropriately."
**After**: "Set `poolSize: 10` for development, `poolSize: 50` for production. Enable `retryWrites: true` and set `serverSelectionTimeoutMS: 5000`."

**Before**: "Handle errors properly."
**After**: "Wrap DB calls in try/catch. On `ECONNREFUSED`, retry 3 times with exponential backoff. On `ValidationError`, return 400 with field-level details. On other errors, log with context and return 500."

### Step 4: Add Missing Examples
For concepts or advice without examples, add concrete ones:

**Before**: "Use caching to speed up your API."
**After**: "Use caching to speed up your API. Example: cache user profile responses for 5 minutes with `cacheKey: user:{id}:profile`. This cuts average response time from 120ms to 15ms for repeat requests."

### Step 5: Add Missing Constraints
For recommendations without trade-offs, add them:

**Before**: "Use a microservices architecture."
**After**: "Use a microservices architecture for teams >10 developers or when services need independent deployment. Trade-off: adds operational complexity (need service mesh, distributed tracing, and inter-service auth). Not recommended for teams <5 or projects with <6 months timeline."

### Step 6: Flag for Human Input
For instances that need human input, generate a prompt:

**Before**: "Our solution improved customer satisfaction."
**Human prompt needed**: "By how much? What was the before/after metric? What specific change drove the improvement?"

## Output Format

```json
{
  "enforcement": {
    "timestamp": "2026-11-10T12:00:00Z",
    "vaguenessInstances": 12,
    "fixedAutomatically": 8,
    "needsHumanInput": 4,
    "specificityScoreBefore": 45,
    "specificityScoreAfter": 82,
    "changes": [
      {
        "type": "unspecified_quantity",
        "location": "Line 5",
        "before": "several optimization techniques",
        "after": "query caching, index optimization, and connection pooling",
        "method": "context_inference"
      },
      {
        "type": "unspecified_action",
        "location": "Line 12",
        "before": "configure appropriately",
        "after": "set poolSize: 10 (dev) or 50 (prod), enable retryWrites: true",
        "method": "domain_knowledge"
      },
      {
        "type": "missing_example",
        "location": "Line 18",
        "before": "Use caching to speed up your API.",
        "after": "Use caching to speed up your API. Example: cache user profile responses for 5 minutes with cacheKey: user:{id}:profile. This cuts average response time from 120ms to 15ms.",
        "method": "added_example"
      },
      {
        "type": "needs_human_input",
        "location": "Line 25",
        "text": "Our solution improved customer satisfaction.",
        "prompt": "By how much? What was the before/after metric? What specific change drove the improvement?"
      }
    ]
  }
}
```

## Specificity Score

Score 0-100 based on:
- Percentage of vague instances fixed (40%)
- Presence of concrete examples (20%)
- Presence of specific numbers (20%)
- Presence of named tools/techniques (20%)

## Rewriting Rules

1. **Replace vague quantities with lists**: "various methods" -> "methods A, B, and C"
2. **Replace vague quality with metrics**: "better performance" -> "40% faster (120ms -> 70ms)"
3. **Replace vague actions with steps**: "configure appropriately" -> "set X=Y, enable Z"
4. **Add examples after every concept**: One example per concept minimum
5. **Add trade-offs after every recommendation**: One trade-off per recommendation minimum
6. **Replace adverbs with numbers**: "significantly faster" -> "3x faster"
7. **Replace "should" with "must" or "may"**: Be explicit about requirement level

## Error Handling

- **Cannot infer specifics from context**: Flag for human input, do not guess
- **Rewrite changes meaning**: Revert and flag for human review
- **Content is already specific**: Return with score 100, no changes
- **Very short content**: May not have enough context to enforce specificity. Warn.
- **Non-technical content**: Specificity rules still apply but examples may be qualitative rather than quantitative

## Integration Points

- Receives from: anti-slop-validator (after it flags vague language), any content generation skill
- Coordinates with: quality-gate-ai (feeds into gate), hallucination-detector (ensures specifics are accurate)
- Outputs to: Content pipeline, documentation workflow
- Feeds into: quality-gate-ai as a specificity check

## Example

```bash
# Enforce specificity on a file
/specificity-enforcer docs/guide.md

# Enforce on inline content
/specificity-enforcer "Use various methods to optimize your database."

# Output: Rewritten content with specifics, list of changes, human prompts for unfixable items
```
