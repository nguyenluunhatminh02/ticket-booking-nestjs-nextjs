---
name: self-improvement
description: Self-Improvement Orchestrator that learns from session history, detects breakthroughs, and evolves Claude's approach over time. Mines corrections, patterns, and successful strategies to continuously improve performance.
---

# Self-Improvement Orchestrator

**Description**: Advanced learning system that mines session history to detect patterns, identify breakthroughs, and evolve Claude's problem-solving approach. Goes beyond simple correction logging to discover implicit learnings and successful strategies.

## When to Use

- At session start to load accumulated wisdom
- Before complex tasks to apply learned strategies
- After completing work to extract new learnings
- When encountering similar problems to past sessions
- During retrospectives to identify improvement opportunities

## Core Concepts

### 1. Session History Mining

The system analyzes three types of session data:

**Explicit Corrections** (user says "don't do X, do Y")
- Direct feedback on mistakes
- Preferred approaches stated by user
- Anti-patterns to avoid

**Implicit Learnings** (inferred from session flow)
- Approaches that required multiple attempts
- Solutions that worked after debugging
- Patterns in successful vs unsuccessful attempts

**Breakthrough Discoveries** (novel solutions)
- Creative problem-solving approaches
- Unexpected combinations that worked
- New patterns discovered during work

### 2. Pattern Detection Algorithms

The mining script identifies these patterns:

**Correction Patterns**
- Repeated mistakes in same category (frequency > 3)
- Corrections that cluster around specific technologies
- Time-based patterns (mistakes more common in certain contexts)

**Success Patterns**
- Approaches that consistently work
- Problem-solving sequences that lead to solutions
- Code patterns that appear in successful implementations

**Breakthrough Indicators**
- Solutions that required significant refactoring
- Novel combinations of existing patterns
- Approaches that solved multiple problems at once
- "Aha moments" where a simpler solution emerged

### 3. Learning Evolution

The system maintains three knowledge layers:

**Layer 1: Corrections** (`.claude/memory/corrections.json`)
- Raw correction data with frequency tracking
- Direct user feedback
- Basic pattern matching

**Layer 2: Strategies** (`.claude/memory/strategies.json`)
- Synthesized approaches from multiple corrections
- Proven problem-solving sequences
- Context-specific recommendations

**Layer 3: Breakthroughs** (`.claude/memory/breakthroughs.json`)
- Novel solutions and discoveries
- Creative approaches worth repeating
- Innovation patterns

## Session Startup Protocol

Before starting work:

1. **Load all knowledge layers**:
   ```bash
   Read corrections.json, strategies.json, breakthroughs.json
   ```

2. **Identify high-frequency patterns**:
   - Corrections with frequency > 5
   - Strategies marked as "proven"
   - Recent breakthroughs (< 30 days)

3. **Match current task to history**:
   - Check if similar tasks exist in history
   - Load relevant strategies
   - Note past corrections in this domain

4. **Apply learned wisdom**:
   - Use proven strategies when applicable
   - Avoid approaches in anti-patterns
   - Consider breakthrough approaches for complex problems

## Mining Protocol

After completing significant work:

1. **Extract explicit corrections**:
   - User said "don't" or "avoid" → add to corrections
   - User said "prefer" or "use" → add to strategies
   - User expressed surprise → check for breakthrough

2. **Analyze session flow**:
   - Count retry attempts (indicates learning opportunity)
   - Track debugging sequences (reveals problem patterns)
   - Note solution evolution (shows breakthrough potential)

3. **Detect breakthroughs**:
   - Solution required > 3 iterations
   - Final approach differs significantly from initial
   - Multiple problems solved with one insight
   - User expressed strong positive reaction

4. **Update knowledge bases**:
   - Add new corrections with context
   - Synthesize strategies from correction clusters
   - Document breakthroughs with full context

## Breakthrough Detection Algorithm

```javascript
function detectBreakthrough(session) {
  const indicators = {
    iterations: countSolutionAttempts(session),
    refactoring: measureCodeChanges(session),
    novelty: compareApproaches(session),
    impact: countProblemsSolved(session),
    userReaction: analyzeUserFeedback(session)
  };

  // Breakthrough score calculation
  const score = 
    (indicators.iterations > 3 ? 2 : 0) +
    (indicators.refactoring > 50 ? 2 : 0) +
    (indicators.novelty === 'high' ? 3 : 0) +
    (indicators.impact > 1 ? 2 : 0) +
    (indicators.userReaction === 'positive' ? 1 : 0);

  return score >= 7; // Threshold for breakthrough classification
}
```

## Strategy Synthesis

When corrections cluster (3+ in same category within 30 days):

1. **Identify common theme**:
   - What problem are these corrections addressing?
   - What's the underlying principle?

2. **Formulate strategy**:
   - Create general approach that prevents these corrections
   - Document as "proven strategy" with context

3. **Validate against history**:
   - Check if strategy conflicts with existing strategies
   - Ensure it doesn't create new anti-patterns

4. **Promote to strategies.json**:
   - Add with full context and examples
   - Mark as "synthesized" for traceability

## Knowledge Base Structures

### corrections.json
```json
{
  "corrections": [
    {
      "id": "uuid",
      "timestamp": "ISO-8601",
      "context": "What was being done",
      "wrong": "What was incorrect",
      "right": "What should have been done",
      "category": "bug|architecture|style|logic|api|database",
      "frequency": 1,
      "lastSeen": "ISO-8601",
      "patterns": ["related-patterns"],
      "sessionRef": "session-id"
    }
  ]
}
```

### strategies.json
```json
{
  "strategies": [
    {
      "id": "uuid",
      "name": "Strategy name",
      "description": "When and how to apply",
      "context": "Situations where this works",
      "source": "synthesized|breakthrough|user-stated",
      "confidence": "high|medium|low",
      "applications": 0,
      "successes": 0,
      "created": "ISO-8601",
      "lastUsed": "ISO-8601",
      "examples": ["example-1", "example-2"],
      "antiPatterns": ["what-to-avoid"]
    }
  ]
}
```

### breakthroughs.json
```json
{
  "breakthroughs": [
    {
      "id": "uuid",
      "timestamp": "ISO-8601",
      "problem": "What was being solved",
      "initialApproach": "First attempt",
      "breakthrough": "The key insight",
      "finalSolution": "What worked",
      "whyItWorked": "Underlying principle",
      "applicability": "Where else this applies",
      "novelty": "high|medium",
      "impact": "high|medium|low",
      "sessionRef": "session-id",
      "tags": ["related-concepts"]
    }
  ]
}
```

## Integration with Auto-Orchestrate

When auto-orchestrate workflow runs:

1. **Pre-planning**: Load strategies and breakthroughs
2. **Agent spawning**: Pass relevant strategies to agents
3. **During execution**: Agents check strategies before major decisions
4. **Post-execution**: Mine session for new learnings
5. **Knowledge update**: Add corrections, synthesize strategies, document breakthroughs

## Example Workflows

### Example 1: Learning from Corrections

```
Session 1: User corrects useEffect usage → logs correction
Session 2: Similar task → loads correction → uses useMemo
Session 3: Mining detects 3 useEffect corrections → synthesizes strategy
Strategy: "Prefer useMemo for derived state, avoid useEffect for calculations"
Future sessions: Automatically apply this strategy
```

### Example 2: Breakthrough Discovery

```
Session: Complex state management problem
Initial: Complex Redux setup with many actions
Iterations: 4 attempts, significant refactoring
Breakthrough: Realize Zustand with middleware is simpler
Result: 70% less code, easier to maintain
Mining: Detects breakthrough, documents approach
Future: Apply similar simplification patterns to state problems
```

### Example 3: Pattern Recognition

```
History: 5 corrections about API error handling
Mining: Detects cluster in "error-handling" category
Synthesis: Creates strategy for API error handling
Strategy includes:
  - Always use try-catch with specific error types
  - Log errors with context
  - Provide user-friendly messages
  - Implement retry logic for transient errors
Application: Automatically apply to new API work
```

## Maintenance

**Weekly**:
- Review new corrections
- Check for strategy synthesis opportunities
- Archive low-frequency corrections (> 90 days, frequency = 1)

**Monthly**:
- Analyze strategy effectiveness (successes vs applications)
- Retire low-confidence strategies
- Promote high-confidence patterns
- Review breakthroughs for reusable principles

**Quarterly**:
- Comprehensive knowledge base review
- Identify meta-patterns across categories
- Update mining algorithms based on new insights
- Clean up and optimize knowledge bases

## Error Handling

- If knowledge files are missing, create fresh structures
- If mining fails, continue session but log error
- If pattern detection produces conflicts, flag for review
- Always validate JSON before writing
- Keep knowledge bases under 5MB total for performance

## Metrics

Track these to measure improvement:

- **Correction frequency**: Should decrease over time
- **Strategy application rate**: How often strategies are used
- **Strategy success rate**: Percentage of successful applications
- **Breakthrough frequency**: Novel solutions per month
- **Time to solution**: Should decrease as wisdom accumulates
