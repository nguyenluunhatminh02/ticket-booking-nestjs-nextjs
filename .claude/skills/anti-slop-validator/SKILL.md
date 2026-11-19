---
name: anti-slop-validator
description: Validates Claude output against AI slop patterns — detects filler phrases, unsupported claims, vague language, and generic content. Returns quality score and actionable fixes. Use before publishing any Claude-generated content.
description_zh: 验证 Claude 输出是否存在 AI slop 模式 — 检测填充短语、无根据声明、模糊语言和通用内容。返回质量分数和可操作的修复建议。
allowed-tools: Read, Bash
---

# Anti-Slop Validator

Validates Claude output against AI slop patterns and returns a quality score with actionable fixes.

## Purpose

Eliminate AI-generated slop: filler phrases, unsupported claims, vague language, generic platitudes, and content that sounds authoritative but says nothing. This skill enforces specificity, accuracy, relevance, and coherence in every piece of Claude output.

## When to Use

- Before publishing any Claude-generated content (docs, blogs, READMEs, reports)
- After generating long-form text (>200 words)
- When reviewing AI-assisted code comments or documentation
- Before committing AI-generated code
- As a pre-flight check in any content pipeline
- When content feels "off" but you cannot pinpoint why

## Slop Categories Detected

### 1. Filler Phrases
Phrases that add word count without information:
- "In today's fast-paced world..."
- "It's important to note that..."
- "In conclusion, ..."
- "As we all know..."
- "Let's dive into..."
- "In the realm of..."
- "A comprehensive guide to..."
- "Unlock the power of..."
- "Leverage the power of..."
- "Seamlessly integrate..."
- "Revolutionary approach..."
- "Game-changing solution..."

### 2. Unsupported Claims
Statements without evidence, sources, or qualifiers:
- "Studies show that..." (which studies?)
- "Experts agree that..." (which experts?)
- "Research proves..." (cite the research)
- "It is widely known..." (is it?)
- Absolute statements without data: "always", "never", "everyone", "no one"
- Performance claims without benchmarks
- Security claims without audit references

### 3. Vague Language
Words that obscure rather than clarify:
- "various", "many", "several", "some" (how many?)
- "soon", "quickly", "efficiently" (how fast?)
- "better", "improved", "optimized" (by how much?)
- "robust", "scalable", "flexible" (prove it)
- "utilize" instead of "use"
- "facilitate" instead of "help"
- "implement" instead of "build" or "add"

### 4. Generic Content
Content that could apply to anything:
- Advice without context-specific details
- Steps that skip the hard parts
- Examples that are trivially obvious
- Recommendations without trade-offs
- Solutions without constraints acknowledged

### 5. Structural Slop
Formatting that hides lack of substance:
- Bullet points that restate the heading
- Headers followed by single sentences
- Lists of 10+ items with no prioritization
- Redundant summaries after already-clear content
- Excessive bold/italic for emphasis without substance

## Validation Process

### Step 1: Extract Content
Read the Claude output to validate. If from a file, read it. If inline, capture it.

### Step 2: Run Category Checks
For each slop category, scan the content and flag instances:

```
FILLER_PHRASES: [list of matches with line numbers]
UNSUPPORTED_CLAIMS: [list with line numbers and what's missing]
VAGUE_LANGUAGE: [list with suggested replacements]
GENERIC_CONTENT: [sections that lack specificity]
STRUCTURAL_SLOP: [formatting issues]
```

### Step 3: Score Each Dimension
Score 0-100 for each dimension:
- **Specificity**: Does it use concrete numbers, names, dates, examples?
- **Accuracy**: Are claims supported by evidence or qualified appropriately?
- **Relevance**: Does every sentence serve the reader's goal?
- **Coherence**: Does the structure support the argument?

### Step 4: Calculate Overall Score
Weighted average:
- Specificity: 30%
- Accuracy: 30%
- Relevance: 20%
- Coherence: 20%

### Step 5: Generate Fixes
For each issue, provide:
- Location (line/section)
- Problem description
- Suggested fix (concrete rewrite)

## Output Format

```json
{
  "validation": {
    "timestamp": "2026-11-10T12:00:00Z",
    "contentLength": 1250,
    "overallScore": 72,
    "grade": "B",
    "dimensions": {
      "specificity": { "score": 65, "issues": 8 },
      "accuracy": { "score": 80, "issues": 3 },
      "relevance": { "score": 75, "issues": 5 },
      "coherence": { "score": 70, "issues": 4 }
    },
    "findings": [
      {
        "category": "filler_phrase",
        "severity": "low",
        "location": "Line 3",
        "text": "In today's fast-paced world of software development...",
        "fix": "Delete. Start with the actual problem."
      },
      {
        "category": "unsupported_claim",
        "severity": "high",
        "location": "Line 15",
        "text": "Studies show this approach is 50% faster.",
        "fix": "Cite the study, or change to 'In our benchmarks, this approach was 50% faster (see /benchmarks/results.md).'"
      },
      {
        "category": "vague_language",
        "severity": "medium",
        "location": "Line 22",
        "text": "several optimization techniques",
        "fix": "Name the techniques: 'query caching, index optimization, and connection pooling'"
      }
    ],
    "summary": "Content has moderate slop. 3 unsupported claims need citations, 8 instances of vague language need concrete replacements, and 5 filler phrases should be deleted."
  }
}
```

## Grade Scale

- **A (90-100)**: Publish-ready. Minimal slop.
- **B (75-89)**: Good but needs light editing. Some vague language or filler.
- **C (60-74)**: Noticeable slop. Requires revision before publishing.
- **D (40-59)**: Heavy slop. Significant rewrite needed.
- **F (0-39)**: Unpublishable. Mostly filler and unsupported claims.

## Error Handling

- **Empty content**: Return score 0 with message "No content to validate."
- **Very short content (<50 words)**: Warn that validation is unreliable on short text.
- **Non-English content**: Validate structure and patterns; note that phrase detection is English-optimized.
- **Code-heavy content**: Skip prose checks for code blocks; validate only comments and surrounding text.

## Integration Points

- Receives from: Any Claude output, content generation skills, documentation skills
- Coordinates with: quality-gate-ai, specificity-enforcer, hallucination-detector
- Outputs to: Content pipeline, publishing workflow, code review
- Feeds into: quality-gate-ai as a pre-check

## Example

```bash
# Validate a file
/anti-slop-validator docs/api-guide.md

# Validate inline content
/anti-slop-validator "In today's fast-paced world, leveraging AI is crucial..."

# Output: Quality score, grade, findings with fixes
```
