# Anti-Slop Integration Guide

## Overview

This document defines how anti-slop validation integrates with the agent system to ensure all AI-generated content meets quality standards before reaching users.

## Validation Skills Available

1. **anti-slop-validator**: Detects filler phrases, unsupported claims, vague language
2. **hallucination-detector**: Catches fabricated facts, false statistics, phantom capabilities
3. **specificity-enforcer**: Replaces vague content with concrete details, numbers, examples
4. **quality-gate-ai**: Final checkpoint with auto-correction and escalation logic

## New Agents Created

### quality-reviewer.md
- **Role**: Final quality gate for all AI-generated content
- **Model**: sonnet
- **Triggers**: Auto-run after content generation > 200 words
- **Pipeline**: anti-slop-validator -> hallucination-detector -> specificity-enforcer -> quality-gate-ai
- **Thresholds**: Overall score >= 85 for PASS, 75-84 for CONDITIONAL, < 75 for ESCALATE

### fact-checker.md
- **Role**: Cross-references factual claims against authoritative sources
- **Model**: haiku
- **Triggers**: Auto-run when content contains factual claims
- **Focus**: Version numbers, API signatures, statistics, citations
- **Confidence**: Requires >= 75% for acceptance

### output-validator.md
- **Role**: Validates token efficiency, concision, YAGNI/KISS/DRY compliance
- **Model**: haiku
- **Triggers**: Auto-run on every assistant response > 100 words
- **Focus**: Signal-to-noise ratio, filler phrases, code snippet relevance
- **Threshold**: Score >= 80 required

## Integration Patterns by Agent

### planner.md
**When to validate**: Before outputting any plan
**Skills to invoke**:
1. `specificity-enforcer` on requirements (target >= 80)
2. `anti-slop-validator` on plan summary (target >= 75)

**Self-review checklist**:
- Every task has concrete deliverables (file names, function names)
- No "implement properly" without specifics
- All estimates include rationale
- Dependencies named explicitly
- Success criteria measurable

### code-reviewer.md
**When to validate**: After completing review, before outputting summary
**Skills to invoke**:
1. `anti-slop-validator` on review summary (target >= 75)
2. `hallucination-detector` on performance claims
3. `specificity-enforcer` on vague recommendations

**Self-review checklist**:
- Every recommendation includes file:line references
- All code examples are load-bearing
- No vague phrases without enumeration
- Performance claims have sources
- Security findings include OWASP/CVE references

### researcher.md
**When to validate**: After gathering findings, before outputting research
**Skills to invoke**:
1. `hallucination-detector` on all factual claims (target >= 75)
2. `specificity-enforcer` on vague references
3. `anti-slop-validator` on research summary (target >= 80)

**Self-review checklist**:
- Every external tool has official docs link
- All statistics have sources or marked "estimate"
- Version numbers verified or flagged
- No "experts agree" without naming experts
- Trade-offs are concrete with numbers

### tester.md
**When to validate**: After test suite completion, before outputting report
**Skills to invoke**:
1. `specificity-enforcer` on test descriptions
2. `anti-slop-validator` on coverage summaries
3. `hallucination-detector` on performance statements
4. `quality-gate-ai` for final gate

**Self-review checklist**:
- All coverage metrics are exact numbers
- Failed tests include full error messages
- Performance metrics have units
- Recommendations are actionable with specifics
- No filler phrases in summaries

### debugger.md
**When to validate**: After root cause analysis, before outputting report
**Skills to invoke**:
1. `specificity-enforcer` on root cause descriptions
2. `hallucination-detector` on performance claims
3. `anti-slop-validator` on recommendations

**Self-review checklist**:
- All metrics have exact numbers with units
- Timeline includes timestamps
- Root causes name specific files/functions
- Recommendations include implementation steps
- No vague phrases without enumeration

### api-designer.md
**When to validate**: After designing endpoints, before outputting spec
**Skills to invoke**:
1. `specificity-enforcer` on endpoint descriptions
2. `hallucination-detector` on performance statements
3. `anti-slop-validator` on security recommendations

**Self-review checklist**:
- Every endpoint has request/response JSON examples
- All status codes enumerated
- Rate limits have exact numbers
- Authentication flows include expiry times
- No vague phrases without enumeration

### brainstormer.md
**When to validate**: After evaluating approaches, before outputting summary
**Skills to invoke**:
1. `specificity-enforcer` on approach comparisons
2. `anti-slop-validator` on final recommendations
3. `hallucination-detector` on technical claims

**Self-review checklist**:
- Every comparison has concrete metrics
- All recommendations include implementation steps
- Trade-offs are quantified
- Success criteria are measurable
- No vague phrases without enumeration

### project-manager.md
**When to validate**: After collecting reports, before outputting status
**Skills to invoke**:
1. `specificity-enforcer` on status updates
2. `anti-slop-validator` on risk descriptions
3. `specificity-enforcer` on next steps

**Self-review checklist**:
- All progress percentages are exact
- Blockers are named specifically
- Timeline estimates include rationale
- Resource requests specify role and duration
- No vague phrases without enumeration

## Feedback Loops

### Loop 1: Content Generation -> Validation -> Correction
```
Agent generates content
  -> quality-reviewer runs validation pipeline
  -> If score < 75: auto-correct via quality-gate-ai
  -> Re-validate
  -> If still < 75: escalate to human
  -> If >= 75: pass to output
```

### Loop 2: Factual Claim -> Verification -> Flagging
```
Agent makes factual claim
  -> fact-checker extracts and classifies
  -> Verify against project context
  -> If confidence < 60: flag as likely hallucination
  -> If 60-80: mark as unverified, suggest external check
  -> If >= 80: accept as verified
```

### Loop 3: Vague Content -> Specificity Enforcement -> Rewrite
```
Agent outputs vague content
  -> specificity-enforcer scans for patterns
  -> Classify: fixable from context / needs domain knowledge / needs human
  -> Auto-rewrite fixable instances
  -> Flag unfixable for human input
  -> Return rewritten content + human prompts
```

## Escalation Paths

### Level 1: Auto-Correction (quality-gate-ai)
**Triggers**:
- Filler phrases detected
- "utilize" -> "use" replacements
- Passive voice -> active voice
- Redundant adjectives

**Limit**: Max 10 auto-fixes per run

### Level 2: Agent Self-Correction
**Triggers**:
- Anti-slop score 75-84 after auto-correction
- 1-3 unsupported claims
- 1-5 vague language instances

**Action**: Agent rewrites content using specificity-enforcer suggestions

### Level 3: Human Review Queue
**Triggers**:
- Overall score < 75 after auto-correction
- More than 3 unsupported factual claims
- More than 5 vague language instances
- Content contains sensitive topics (legal, medical, financial)
- Auto-correction would change > 20% of content

**Output**: Generate review brief with:
- Summary of auto-fixes applied
- List of issues requiring human judgment
- Suggested fixes for each issue
- Time estimate for human review

### Level 4: Rejection and Regeneration
**Triggers**:
- Overall score < 50
- Fundamental flaws in content structure
- Repeated failures (3+ attempts)

**Action**: Return to generating agent with specific feedback, regenerate from scratch

## Invocation Triggers

### Automatic Triggers
- Content length > 200 words -> run quality-reviewer
- Assistant response > 100 words -> run output-validator
- Content contains factual claims -> run fact-checker
- After test suite completion -> run quality-gate-ai
- After content generation skill -> run anti-slop-validator

### Manual Triggers
- User invokes `/anti-slop-validator <file>`
- User invokes `/hallucination-detector <file>`
- User invokes `/specificity-enforcer <file>`
- User invokes `/quality-gate-ai <file>`

### Conditional Triggers
- Code review summary -> run anti-slop-validator
- Research findings -> run hallucination-detector
- API design spec -> run specificity-enforcer
- Project status report -> run anti-slop-validator

## Score Thresholds

| Skill | Minimum Score | Action if Below |
|-------|--------------|-----------------|
| anti-slop-validator | 75 | Auto-correct or escalate |
| hallucination-detector | 75 | Flag unverified claims |
| specificity-enforcer | 80 | Rewrite vague passages |
| quality-gate-ai | 85 (PASS) | 75-84: CONDITIONAL, <75: ESCALATE |
| output-validator | 80 | Reject and regenerate |

## Quality Gates in Workflow

### Pre-Output Gate (quality-gate-ai)
**When**: Before any content reaches users
**Checks**:
1. Anti-slop validation (filler, unsupported claims, vague language)
2. Auto-correction of fixable issues
3. Re-validation after correction
4. Escalation if score < 75

### Pre-Commit Gate (output-validator)
**When**: Before committing AI-generated code or docs
**Checks**:
1. Token efficiency (signal-to-noise > 80%)
2. Filler phrase absence
3. Code snippet relevance
4. YAGNI/KISS/DRY compliance

### Pre-Publish Gate (quality-reviewer)
**When**: Before publishing docs, blogs, reports
**Checks**:
1. Full validation pipeline (anti-slop -> hallucination -> specificity)
2. Overall score >= 85
3. No unfixable issues
4. Human review if needed

## Integration with Auto-Orchestrate

When auto-orchestrate workflow runs:
1. Each agent applies its anti-slop checks before outputting
2. quality-reviewer runs on final artifacts
3. output-validator runs on all responses
4. fact-checker runs on research outputs
5. Escalation paths trigger if thresholds not met

## Configuration

Default thresholds can be overridden in `.claude/settings.json`:

```json
{
  "antiSlop": {
    "passThreshold": 85,
    "conditionalThreshold": 75,
    "rejectThreshold": 50,
    "maxAutoCorrections": 10,
    "autoTriggerOnWordCount": 200,
    "escalateOnSensitiveTopics": true
  }
}
```

## Monitoring and Metrics

Track these metrics to measure anti-slop effectiveness:
- Average anti-slop score by agent
- Percentage of content passing first validation
- Number of escalations to human review
- Auto-correction success rate
- Time spent in validation loops
- Rejection rate by agent

## Troubleshooting

### Issue: Too many escalations
**Solution**: Lower pass threshold from 85 to 80, or improve agent prompts with more specific examples

### Issue: Auto-correction breaks context
**Solution**: Reduce max auto-corrections from 10 to 5, or add context-awareness to quality-gate-ai

### Issue: Validation slows down workflow
**Solution**: Run validation in parallel with content generation, or skip validation for internal-only content

### Issue: False positives on technical jargon
**Solution**: Add domain-specific exceptions to anti-slop-validator, or increase threshold for technical content

## Future Enhancements

- [ ] Add language-specific anti-slop rules (non-English content)
- [ ] Integrate with CI/CD pipeline for automated content gates
- [ ] Build dashboard for tracking anti-slop metrics over time
- [ ] Add machine learning to improve auto-correction accuracy
- [ ] Create agent-specific slop patterns (e.g., API designers tend to say "scalable" without metrics)

## References

- Anti-slop skill: `.claude/skills/anti-slop-validator/SKILL.md`
- Hallucination detector: `.claude/skills/hallucination-detector/SKILL.md`
- Specificity enforcer: `.claude/skills/specificity-enforcer/SKILL.md`
- Quality gate AI: `.claude/skills/quality-gate-ai/SKILL.md`
- Quality gates: `.claude/skills/quality-gates.md`
