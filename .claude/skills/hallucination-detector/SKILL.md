---
name: hallucination-detector
description: Detects hallucinated facts, fabricated sources, and unsupported claims in Claude output. Cross-references claims against available context, assigns confidence scores, and flags unverified statements for human review. Use when Claude output contains factual claims, statistics, or references.
description_zh: 检测 Claude 输出中的虚构事实、伪造来源和无根据声明。根据可用上下文交叉引用声明，分配置信度分数，并标记未验证的陈述以供人工审查。
allowed-tools: Read, Bash
---

# Hallucination Detector

Detects hallucinated facts, fabricated sources, and unsupported claims in Claude output.

## Purpose

LLMs hallucinate: they generate plausible-sounding but false information. This skill catches hallucinations before they reach users by cross-referencing claims against available context, assigning confidence scores, and flagging unverified statements. It is especially critical for factual content: documentation, reports, technical guides, and any output that users will trust as authoritative.

## When to Use

- When Claude output contains factual claims (statistics, dates, names, versions)
- When output cites sources (papers, articles, documentation, studies)
- When output makes performance or benchmark claims
- When output references specific APIs, libraries, or tools
- Before publishing any technical documentation
- When output includes quotes attributed to specific people
- When output describes historical events or version histories

## Hallucination Types Detected

### 1. Fabricated Sources
- Fake paper titles, authors, or DOIs
- Non-existent URLs or documentation links
- Made-up study names or research institutions
- Fictional book titles or article references
- Invented API endpoints or function names

### 2. False Statistics
- Specific numbers without sources ("85% of developers...")
- Benchmark results without methodology
- Performance claims without test conditions
- Survey results without citation
- Market share figures without date or source

### 3. Invented Facts
- Wrong version numbers or release dates
- Incorrect API signatures or parameters
- False feature attributions ("X supports Y" when it does not)
- Made-up historical events or timelines
- Incorrect attributions (wrong person said/did something)

### 4. Phantom Capabilities
- Claiming a tool/library can do something it cannot
- Describing features that do not exist
- Inventing configuration options or flags
- Fabricating error codes or messages
- Describing non-existent endpoints or routes

### 5. False Confidence
- Stating uncertain information as fact
- Omitting uncertainty qualifiers ("may", "might", "approximately")
- Presenting one interpretation as the only one
- Ignoring conflicting evidence

## Detection Process

### Step 1: Extract Claims
Parse the Claude output and extract every factual claim:
- Statistics and numbers
- Names (people, companies, products)
- Dates and versions
- Citations and references
- Technical specifications
- Capability claims

### Step 2: Classify Each Claim
For each claim, classify:
- **Verifiable from context**: Can be checked against files, docs, or code in the project
- **Verifiable externally**: Requires web search or external knowledge
- **Subjective**: Opinion or recommendation (not a factual claim)
- **Self-referential**: About the output itself (not a factual claim)

### Step 3: Verify Against Context
For claims verifiable from context:
1. Search project files for corroborating evidence
2. Check documentation, code, configs, tests
3. Compare against known project facts
4. Flag mismatches

### Step 4: Score Confidence
For each claim, assign a confidence score:
- **High (90-100%)**: Verified against multiple sources in context, or is common knowledge
- **Medium (60-89%)**: Partially verified, or consistent with context but not directly confirmed
- **Low (30-59%)**: Cannot be verified from context, but plausible
- **Very Low (0-29%)**: Contradicted by context, or highly implausible

### Step 5: Flag for Review
Claims with confidence < 80% are flagged for human review. Claims with confidence < 50% are marked as likely hallucinations.

### Step 6: Generate Report
Produce a report listing all claims, their confidence scores, verification status, and suggested actions.

## Output Format

```json
{
  "detection": {
    "timestamp": "2026-11-10T12:00:00Z",
    "totalClaims": 24,
    "verified": 15,
    "unverified": 7,
    "likelyHallucinated": 2,
    "overallConfidence": 78,
    "claims": [
      {
        "text": "React 18 was released in March 2022.",
        "type": "factual_fact",
        "confidence": 95,
        "status": "verified",
        "evidence": "Consistent with package.json showing react@18.x",
        "action": "none"
      },
      {
        "text": "Studies show this pattern improves performance by 40%.",
        "type": "false_statistic",
        "confidence": 15,
        "status": "likely_hallucinated",
        "evidence": "No study cited. No benchmark in project.",
        "action": "remove_or_cite"
      },
      {
        "text": "The express.json() middleware was added in Express 4.16.0.",
        "type": "factual_fact",
        "confidence": 70,
        "status": "unverified",
        "evidence": "Cannot verify from project context. Requires external check.",
        "action": "verify_externally"
      },
      {
        "text": "Use the --optimize flag to enable tree shaking.",
        "type": "phantom_capability",
        "confidence": 20,
        "status": "likely_hallucinated",
        "evidence": "No --optimize flag in package.json scripts or webpack config.",
        "action": "remove"
      }
    ],
    "summary": "24 claims detected. 15 verified, 7 unverified (need external check), 2 likely hallucinated (should be removed or corrected)."
  }
}
```

## Confidence Scoring Rules

- **Verified against project files**: +30% confidence
- **Consistent with project context**: +20% confidence
- **Common knowledge in domain**: +20% confidence
- **No context available**: base confidence 50%
- **Contradicted by project files**: -50% confidence
- **Specific numbers without source**: cap at 40%
- **Cited source that cannot be found**: cap at 20%
- **Quote attributed to specific person without source**: cap at 30%

## Verification Strategies

### For Version Numbers
- Check package.json, lock files, or dependency lists
- Compare against known release histories
- Flag if version does not exist or is wrong

### For API Signatures
- Check source code or type definitions
- Verify parameters and return types
- Flag if function does not exist or has different signature

### For Statistics
- Require explicit source
- If no source, flag as unverified
- If source is vague ("studies show"), flag as likely hallucinated

### For Citations
- Attempt to locate the cited source
- If URL, check if it exists
- If paper/book, verify title and author
- Flag if source cannot be found

## Error Handling

- **No context available**: Lower all confidence scores by 20%. Warn that detection is less reliable.
- **Very long content**: Process in chunks. May miss cross-chunk references.
- **Non-English content**: Detection works but may have lower accuracy for cultural references.
- **Code-heavy content**: Focus on comments and documentation, not code logic.
- **Repeated claims**: Count as one claim, verify once.

## Integration Points

- Receives from: Any Claude output containing factual claims
- Coordinates with: anti-slop-validator (overlaps on unsupported claims), quality-gate-ai (feeds into gate)
- Outputs to: Content review pipeline, human review queue
- Feeds into: quality-gate-ai as a factual accuracy check

## Example

```bash
# Detect hallucinations in a file
/hallucination-detector docs/api-guide.md

# Detect in inline content
/hallucination-detector "React 19 was released in 2023 and includes..."

# Output: List of claims with confidence scores and verification status
```
