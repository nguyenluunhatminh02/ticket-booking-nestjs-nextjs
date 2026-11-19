---
name: quality-gate-ai
description: Pre-output quality gate for AI-generated content. Validates Claude output against anti-slop rules, triggers auto-correction for fixable issues, and escalates to human review when confidence is low. Use as the final checkpoint before any AI content reaches users.
description_zh: AI 生成内容的预输出质量门控。根据反 slop 规则验证 Claude 输出，对可修复问题触发自动纠正，并在置信度低时升级到人工审查。
allowed-tools: Read, Bash, Edit
---

# Quality Gate AI

Pre-output quality gate that validates, auto-corrects, and escalates AI-generated content before it reaches users.

## Purpose

Serve as the final quality checkpoint in any AI content pipeline. This gate catches slop before publication, auto-fixes what it can, and flags what it cannot fix for human review. It prevents low-quality AI output from reaching end users.

## When to Use

- As the last step before publishing AI-generated docs, blogs, or reports
- Before committing AI-generated code or comments
- After any content generation skill completes
- When auto-orchestrate workflow produces content artifacts
- As a CI/CD gate for AI-assisted content pipelines
- Before sending AI-generated emails or messages to users

## Gate Architecture

The gate has three layers, executed in sequence:

### Layer 1: Pre-Output Validation

Run anti-slop checks on the content:
- Filler phrase detection
- Unsupported claim detection
- Vague language detection
- Generic content detection
- Structural slop detection

Invoke: `anti-slop-validator` skill or equivalent checks.

Threshold: Content must score >= 75 to pass automatically.

### Layer 2: Auto-Correction

For issues that have deterministic fixes, apply them automatically:

**Auto-fixable issues:**
- Filler phrases -> delete
- "utilize" -> "use"
- "facilitate" -> "help"
- "in order to" -> "to"
- "it is important to note that" -> delete
- "in conclusion" -> delete (if summary is already clear)
- Passive voice -> active voice (when agent is clear)
- Redundant adjectives -> delete (e.g., "completely eliminate" -> "eliminate")

**Not auto-fixable (escalate to Layer 3):**
- Unsupported claims (need human to find sources)
- Vague quantities (need human to provide specifics)
- Generic advice (need human to add context)
- Factual accuracy (need human to verify)

Auto-correction limit: Max 10 auto-fixes per run. If more, escalate to human.

### Layer 3: Human Review Trigger

Escalate to human review when:
- Overall score < 75 after auto-correction
- More than 3 unsupported claims
- More than 5 vague language instances
- Content contains sensitive topics (legal, medical, financial advice)
- Content is >1000 words and has not been reviewed by a human
- Auto-correction would change >20% of the content

Human review output: Generate a review brief with:
- Summary of what was auto-fixed
- List of issues requiring human judgment
- Suggested fixes for each issue
- Time estimate for human review

## Validation Process

### Step 1: Content Intake
Receive content from upstream skill or pipeline. Capture:
- Content text
- Source skill/workflow that generated it
- Intended audience
- Publication target (docs, blog, code, email)

### Step 2: Run Layer 1 Validation
Execute anti-slop validation. Record score and findings.

### Step 3: Apply Layer 2 Auto-Corrections
For each auto-fixable issue:
1. Apply the fix
2. Record the change (before/after)
3. Verify the fix did not break surrounding context

### Step 4: Re-validate
Run Layer 1 again on the corrected content. Record new score.

### Step 5: Decide Gate Outcome
- **PASS**: Score >= 85 after correction. Content is ready.
- **CONDITIONAL PASS**: Score 75-84. Content is acceptable but has minor issues. Log warnings.
- **ESCALATE**: Score < 75, or too many unfixable issues. Trigger human review.
- **REJECT**: Score < 50, or content is fundamentally flawed. Return to generator with specific feedback.

### Step 6: Output Results
Generate gate report with outcome, changes made, and next steps.

## Output Format

```json
{
  "gate": {
    "timestamp": "2026-11-10T12:00:00Z",
    "outcome": "pass|conditional_pass|escalate|reject",
    "inputScore": 62,
    "outputScore": 88,
    "autoCorrections": [
      {
        "type": "filler_phrase",
        "before": "In today's fast-paced world, utilizing AI is crucial.",
        "after": "AI is crucial.",
        "location": "Line 1"
      },
      {
        "type": "word_choice",
        "before": "utilize",
        "after": "use",
        "location": "Line 5"
      }
    ],
    "autoCorrectionCount": 7,
    "escalationReason": null,
    "humanReviewBrief": null,
    "warnings": [
      "Line 15 contains an unsupported claim about performance. Consider adding a source."
    ]
  }
}
```

When escalated:

```json
{
  "gate": {
    "outcome": "escalate",
    "inputScore": 58,
    "outputScore": 71,
    "autoCorrectionCount": 10,
    "escalationReason": "Score below threshold after auto-correction. 4 unsupported claims require human verification.",
    "humanReviewBrief": {
      "estimatedTime": "15 minutes",
      "issuesRequiringReview": [
        {
          "location": "Line 15",
          "issue": "Unsupported claim: 'Studies show 50% improvement'",
          "suggestedFix": "Add citation or change to 'In our tests, we observed...'",
          "priority": "high"
        }
      ],
      "autoFixSummary": "7 filler phrases removed, 3 word choices simplified. Content is clearer but still has factual gaps."
    }
  }
}
```

## Configuration

Gate thresholds can be configured per pipeline:

```json
{
  "qualityGate": {
    "passThreshold": 85,
    "conditionalPassThreshold": 75,
    "rejectThreshold": 50,
    "maxAutoCorrections": 10,
    "maxUnsupportedClaims": 3,
    "maxVagueInstances": 5,
    "escalateOnSensitiveTopics": true,
    "escalateOnLongContent": true,
    "longContentThreshold": 1000
  }
}
```

## Error Handling

- **Content too short (<50 words)**: Skip validation, pass with warning.
- **Validation timeout**: Pass with warning, log for manual review.
- **Auto-correction breaks context**: Revert that correction, escalate to human.
- **Repeated gate failures (3+)**: Flag the upstream generator for review.
- **Configuration error**: Use default thresholds.

## Integration Points

- Receives from: anti-slop-validator, content generation skills, auto-orchestrate workflow
- Coordinates with: hallucination-detector (for factual claims), specificity-enforcer (for vague content)
- Outputs to: Publishing pipeline, content dashboard, human review queue
- Feeds into: CI/CD content gates, documentation deployment

## Example

```bash
# Run gate on a file
/quality-gate-ai docs/api-guide.md

# Run gate on inline content
/quality-gate-ai "Here is the content to validate..."

# Run with custom thresholds
/quality-gate-ai --pass-threshold 90 docs/blog-post.md

# Output: Gate outcome, auto-corrections applied, escalation if needed
```
