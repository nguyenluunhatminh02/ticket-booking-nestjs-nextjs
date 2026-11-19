# Session Memory System

**Description**: Self-correcting memory system that learns from user corrections and patterns to improve future interactions.

## When to Use

- At the start of every session to review past corrections
- When making decisions that might repeat past mistakes
- Before implementing features where corrections were previously made
- When user provides feedback or corrections

## Memory Structure

The system maintains corrections in `.claude/memory/corrections.json` with this structure:

```json
{
  "corrections": [
    {
      "id": "unique-id",
      "timestamp": "ISO-8601",
      "context": "What was being done",
      "wrong": "What was incorrect",
      "right": "What should have been done",
      "category": "bug|architecture|style|logic|api|database",
      "frequency": 1,
      "lastSeen": "ISO-8601",
      "patterns": ["related-patterns"]
    }
  ],
  "patterns": {
    "repeatedMistakes": [],
    "preferredApproaches": [],
    "avoidApproaches": []
  }
}
```

## Session Startup Protocol

Before starting any work:

1. **Load corrections**: Read `.claude/memory/corrections.json`
2. **Identify patterns**: Look for corrections with frequency > 2
3. **Check context**: Match current task to past correction contexts
4. **Apply lessons**: Avoid approaches marked in `avoidApproaches`
5. **Prefer patterns**: Use approaches from `preferredApproaches`

## Correction Logging

When a user corrects you:

1. **Acknowledge immediately**: "I understand, I'll remember that."
2. **Extract key info**:
   - What was wrong (the mistake)
   - What was right (the correction)
   - Context (what you were doing)
   - Category (type of mistake)
3. **Update memory**: Add to corrections.json via the hook
4. **Check patterns**: If similar correction exists, increment frequency

## Pattern Detection

The system automatically identifies:

- **Repeated mistakes**: Same category/context appears 3+ times
- **Preferred approaches**: Corrections consistently favor a specific pattern
- **Anti-patterns**: Approaches that were corrected multiple times

## Auto-Suggestion System

Before implementing, check:

```javascript
// Pseudo-code for pattern matching
if (currentTask.matches(correction.context)) {
  suggest(correction.right);
  warn("Past correction suggests avoiding: " + correction.wrong);
}

if (category.hasHighFrequency()) {
  alert("This category has been corrected " + category.frequency + " times");
  showPreferredApproaches(category);
}
```

## Learning Loop

1. **Detect**: User provides correction
2. **Log**: Hook captures correction details
3. **Analyze**: System checks for patterns
4. **Store**: Update corrections.json with frequency/patterns
5. **Apply**: Future sessions load and use these patterns
6. **Refine**: Patterns evolve as more corrections accumulate

## Error Handling

- If corrections.json is missing or corrupted, create fresh structure
- If hook fails to log, continue session but warn user
- If pattern detection fails, fall back to raw correction list
- Always validate JSON before writing

## Integration Points

- **Pre-session**: Load and analyze corrections
- **During work**: Check patterns before major decisions
- **Post-correction**: Log via hook immediately
- **Session end**: Summarize new corrections learned

## Example Usage

```markdown
User: "Don't use useEffect for this, use useMemo instead"

System actions:
1. Acknowledge correction
2. Log: {context: "state derivation", wrong: "useEffect", right: "useMemo", category: "react-patterns"}
3. Check if similar corrections exist
4. Update frequency if pattern detected
5. Apply to future React state derivation tasks
```

## Maintenance

- Review corrections monthly
- Archive low-frequency corrections (>90 days old, frequency=1)
- Promote high-frequency patterns to preferred/avoid lists
- Keep corrections.json under 1MB for performance
