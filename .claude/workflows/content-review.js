#!/usr/bin/env node

/**
 * @fileoverview Content Review Workflow - Anti-AI Slop Protection
 * @module workflows/content-review
 * @description Focused review pipeline for specificity, fact verification, and coherence.
 * Uses quality-gate-ai as orchestrator with specialized sub-checks. Provides four review stages:
 * specificity analysis, fact verification, coherence checking, and auto-fix application.
 *
 * Usage: node content-review.js <file-or-content> [--strict] [--auto-fix] [--output <file>]
 * @version 1.0.0
 * @author Mastery Node.js Project
 */

const fs = require('fs');
const path = require('path');

/**
 * Content Review Workflow for anti-AI slop protection
 * @class ContentReviewWorkflow
 * @description Analyzes content for specificity, verifies facts, checks coherence,
 * and optionally applies auto-fixes for common filler phrases and vague language.
 *
 * @example
 * const workflow = new ContentReviewWorkflow({ strict: true, autoFix: true });
 * const result = await workflow.run('./article.md');
 * console.log(result.passed); // true/false
 */
class ContentReviewWorkflow {
  /**
   * Creates a new ContentReviewWorkflow instance
   * @param {Object} [options={}] - Configuration options
   * @param {boolean} [options.strict=false] - Use strict mode (higher threshold)
   * @param {boolean} [options.autoFix=true] - Apply auto-fixes
   * @param {string} [options.output=null] - Output file path for fixed content
   */
  constructor(options = {}) {
    /** @type {boolean} Strict mode flag */
    this.strict = options.strict || false;
    /** @type {boolean} Auto-fix enabled flag */
    this.autoFix = options.autoFix !== false;
    /** @type {string|null} Output file path */
    this.outputFile = options.output || null;

    /**
     * Results object for storing workflow output
     * @type {Object}
     * @property {string} timestamp - ISO timestamp
     * @property {Object} input - Input validation result
     * @property {Object} review - Review stage results
     * @property {Array<Object>} autoFixes - Applied auto-fixes
     * @property {boolean} passed - Whether content passed threshold
     * @property {number} finalScore - Final aggregated score
     */
    this.results = {
      timestamp: new Date().toISOString(),
      input: null,
      review: {
        specificity: null,
        factVerification: null,
        coherence: null,
        overall: null
      },
      autoFixes: [],
      passed: false,
      finalScore: 0
    };
  }

  /**
   * Run the complete content review workflow
   * @param {string} input - File path or inline content
   * @returns {Promise<Object>} Workflow results
   * @description Four-stage pipeline:
   *   1. Specificity analysis - detect vague language
   *   2. Fact verification - check claims and sources
   *   3. Coherence checking - analyze structure and flow
   *   4. Auto-fix application - fix common filler phrases
   */
  async run(input) {
    console.log('=== Content Review Workflow ===');
    console.log(`Mode: ${this.strict ? 'Strict' : 'Standard'}`);
    console.log(`Auto-fix: ${this.autoFix ? 'Enabled' : 'Disabled'}\n`);

    // Load content
    this.results.input = this.loadContent(input);
    if (!this.results.input.valid) {
      return this.fail('Invalid input: ' + this.results.input.error);
    }

    // Review Stage 1: Specificity Analysis
    console.log('Stage 1: Specificity analysis...');
    this.results.review.specificity = await this.analyzeSpecificity(this.results.input.content);

    // Review Stage 2: Fact Verification
    console.log('\nStage 2: Fact verification...');
    this.results.review.factVerification = await this.verifyFacts(this.results.input.content);

    // Review Stage 3: Coherence Checking
    console.log('\nStage 3: Coherence checking...');
    this.results.review.coherence = await this.checkCoherence(this.results.input.content);

    // Review Stage 4: Aggregate and Score
    console.log('\nStage 4: Aggregating results...');
    this.results.review.overall = this.aggregateReview();

    // Auto-fix if enabled
    if (this.autoFix) {
      console.log('\nApplying auto-fixes...');
      this.results.autoFixes = await this.applyAutoFixes(this.results.input.content);
    }

    // Final decision
    this.results.finalScore = this.results.review.overall.score;
    this.results.passed = this.results.finalScore >= (this.strict ? 85 : 75);

    return this.outputResults();
  }

  /**
   * Load content from file path or inline string
   * @param {string} input - File path or inline content
   * @returns {Object} Load result
   * @returns {boolean} returns.valid - True if content loaded successfully
   * @returns {string} [returns.content] - Content string (if valid)
   * @returns {string} [returns.source] - Source type ('file' or 'inline')
   * @returns {string} [returns.path] - File path (if source is 'file')
   * @returns {string} [returns.error] - Error message (if invalid)
   */
  loadContent(input) {
    if (!input || typeof input !== 'string') {
      return { valid: false, error: 'Input must be a non-empty string' };
    }

    if (fs.existsSync(input)) {
      try {
        const content = fs.readFileSync(input, 'utf-8');
        return { valid: true, content, source: 'file', path: input };
      } catch (err) {
        return { valid: false, error: `Cannot read file: ${err.message}` };
      }
    }

    return { valid: true, content: input, source: 'inline' };
  }

  /**
   * Analyze content specificity - detect vague language patterns
   * @param {string} content - Content to analyze
   * @returns {Promise<Object>} Specificity analysis result
   * @returns {number} returns.score - Specificity score (0-100)
   * @returns {Array<Object>} returns.issues - Detected vague language issues
   * @returns {Object} returns.metrics - Specificity metrics
   * @returns {number} returns.metrics.vagueInstances - Count of vague language
   * @returns {number} returns.metrics.concreteExamples - Count of concrete examples
   * @returns {number} returns.metrics.specificNumbers - Count of specific numbers
   * @returns {number} returns.metrics.namedTools - Count of named tools
   * @description Detects vague patterns:
   *   - Unspecified quantities: "various methods", "many options"
   *   - Unspecified quality: "better performance", "improved security"
   *   - Unspecified action: "configure appropriately"
   *   - Generic advice: "use best practices"
   *   - Vague adverbs: "soon", "quickly", "efficiently"
   */
  async analyzeSpecificity(content) {
    const analysis = {
      score: 0,
      issues: [],
      metrics: {
        vagueInstances: 0,
        concreteExamples: 0,
        specificNumbers: 0,
        namedTools: 0
      }
    };

    // Detect vague language patterns
    const vaguePatterns = [
      { pattern: /\b(various|many|several|some)\s+(methods|options|ways|things|cases)/gi, type: 'unspecified_quantity' },
      { pattern: /\b(better|improved|optimized|enhanced)\s+(performance|security|efficiency)/gi, type: 'unspecified_quality' },
      { pattern: /\bconfigure\s+(appropriately|properly|correctly)/gi, type: 'unspecified_action' },
      { pattern: /\buse\s+best\s+practices/gi, type: 'generic_advice' },
      { pattern: /\bsoon|quickly|efficiently|effectively\b/gi, type: 'vague_adverb' }
    ];

    for (const { pattern, type } of vaguePatterns) {
      const matches = content.match(pattern) || [];
      analysis.metrics.vagueInstances += matches.length;
      if (matches.length > 0) {
        analysis.issues.push({
          type,
          count: matches.length,
          examples: matches.slice(0, 3)
        });
      }
    }

    // Count positive specificity indicators
    analysis.metrics.concreteExamples = (content.match(/example:|for instance:|e\.g\./gi) || []).length;
    analysis.metrics.specificNumbers = (content.match(/\d+%|\d+x|\d+\s*(ms|seconds|minutes|hours)/gi) || []).length;
    analysis.metrics.namedTools = (content.match(/\b(React|Node\.js|MongoDB|Express|TypeScript|Docker|Kubernetes|AWS|GCP|Azure)\b/g) || []).length;

    // Calculate score
    const vaguePenalty = Math.min(50, analysis.metrics.vagueInstances * 5);
    const specificityBonus =
      Math.min(30, analysis.metrics.concreteExamples * 5) +
      Math.min(20, analysis.metrics.specificNumbers * 3) +
      Math.min(20, analysis.metrics.namedTools * 2);

    analysis.score = Math.max(0, Math.min(100, 100 - vaguePenalty + specificityBonus));

    return analysis;
  }

  /**
   * Verify factual claims in content
   * @param {string} content - Content to verify
   * @returns {Promise<Object>} Fact verification result
   * @returns {number} returns.score - Verification score (0-100)
   * @returns {Array<Object>} returns.claims - Detected claims with status
   * @returns {Object} returns.metrics - Verification metrics
   * @returns {number} returns.metrics.totalClaims - Total claims detected
   * @returns {number} returns.metrics.verified - Verified claims count
   * @returns {number} returns.metrics.unverified - Unverified claims count
   * @returns {number} returns.metrics.likelyHallucinated - Likely hallucinated count
   * @description Detects claim patterns:
   *   - Study claims: "studies show that..."
   *   - Statistics: "X% of..."
   *   - Research claims: "research proves/demonstrates..."
   *   - Expert claims: "experts agree/recommend..."
   *   - Absolute claims: "always/never/everyone/no one..."
   */
  async verifyFacts(content) {
    const verification = {
      score: 0,
      claims: [],
      metrics: {
        totalClaims: 0,
        verified: 0,
        unverified: 0,
        likelyHallucinated: 0
      }
    };

    // Extract factual claims
    const claimPatterns = [
      { pattern: /\bstudies\s+show\s+that\b[^.]+\./gi, type: 'study_claim', requiresSource: true },
      { pattern: /\b\d+%\s+of\s+[^.]+\./gi, type: 'statistic', requiresSource: true },
      { pattern: /\bresearch\s+(proves|demonstrates|indicates)\b[^.]+\./gi, type: 'research_claim', requiresSource: true },
      { pattern: /\bexperts\s+(agree|recommend|suggest)\b[^.]+\./gi, type: 'expert_claim', requiresSource: true },
      { pattern: /\b(always|never|everyone|no\s+one)\b[^.]+\./gi, type: 'absolute_claim', requiresQualification: true }
    ];

    for (const { pattern, type, requiresSource, requiresQualification } of claimPatterns) {
      const matches = content.match(pattern) || [];
      for (const match of matches) {
        verification.metrics.totalClaims++;

        const hasSource = /according\s+to|cited|reference|source:/i.test(content);
        const hasQualification = /may|might|approximately|typically|usually/i.test(match);

        let status = 'unverified';
        let confidence = 50;

        if (requiresSource && hasSource) {
          status = 'verified';
          confidence = 80;
          verification.metrics.verified++;
        } else if (requiresSource && !hasSource) {
          status = 'likely_hallucinated';
          confidence = 20;
          verification.metrics.likelyHallucinated++;
        } else if (requiresQualification && hasQualification) {
          status = 'verified';
          confidence = 75;
          verification.metrics.verified++;
        } else if (requiresQualification && !hasQualification) {
          status = 'unverified';
          confidence = 40;
          verification.metrics.unverified++;
        } else {
          verification.metrics.unverified++;
        }

        verification.claims.push({
          text: match,
          type,
          status,
          confidence,
          action: status === 'likely_hallucinated' ? 'remove_or_cite' : 'verify'
        });
      }
    }

    // Calculate score
    const verificationRate = verification.metrics.totalClaims > 0
      ? verification.metrics.verified / verification.metrics.totalClaims
      : 1;
    const hallucinationRate = verification.metrics.totalClaims > 0
      ? verification.metrics.likelyHallucinated / verification.metrics.totalClaims
      : 0;

    verification.score = Math.round((verificationRate * 100) - (hallucinationRate * 50));
    verification.score = Math.max(0, Math.min(100, verification.score));

    return verification;
  }

  /**
   * Check content coherence and structure
   * @param {string} content - Content to check
   * @returns {Promise<Object>} Coherence analysis result
   * @returns {number} returns.score - Coherence score (0-100)
   * @returns {Array<Object>} returns.issues - Detected coherence issues
   * @returns {Object} returns.metrics - Coherence metrics
   * @returns {number} returns.metrics.sentenceCount - Total sentences
   * @returns {number} returns.metrics.paragraphCount - Total paragraphs
   * @returns {number} returns.metrics.avgSentenceLength - Average sentence length
   * @returns {number} returns.metrics.transitionWords - Transition word count
   * @returns {number} returns.metrics.redundantPhrases - Redundant phrase count
   * @description Checks for:
   *   - Fragmented structure (>30% single-sentence paragraphs)
   *   - Dense paragraphs (>20% paragraphs >500 chars)
   *   - Poor flow (<10% transition words)
   *   - Redundant phrases
   */
  async checkCoherence(content) {
    const coherence = {
      score: 0,
      issues: [],
      metrics: {
        sentenceCount: 0,
        paragraphCount: 0,
        avgSentenceLength: 0,
        transitionWords: 0,
        redundantPhrases: 0
      }
    };

    // Basic structure analysis
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);

    coherence.metrics.sentenceCount = sentences.length;
    coherence.metrics.paragraphCount = paragraphs.length;
    coherence.metrics.avgSentenceLength = sentences.length > 0
      ? content.length / sentences.length
      : 0;

    // Check for transition words
    const transitionWords = content.match(/\b(however|therefore|furthermore|moreover|consequently|additionally|in\s+contrast|on\s+the\s+other\s+hand)\b/gi) || [];
    coherence.metrics.transitionWords = transitionWords.length;

    // Check for redundant phrases
    const redundantPatterns = [
      /\bin\s+conclusion\b.*\bin\s+summary\b/gi,
      /\bas\s+mentioned\s+earlier\b[^.]*\bas\s+I\s+said\b/gi,
      /\brepeat(\w+)?\b[^.]*\brepeat(\w+)?\b/gi
    ];

    for (const pattern of redundantPatterns) {
      const matches = content.match(pattern) || [];
      coherence.metrics.redundantPhrases += matches.length;
    }

    // Check for structural issues
    const singleSentenceParagraphs = paragraphs.filter(p => p.split(/[.!?]+/).length <= 2).length;
    const longParagraphs = paragraphs.filter(p => p.length > 500).length;

    if (singleSentenceParagraphs > paragraphs.length * 0.3) {
      coherence.issues.push({
        type: 'fragmented_structure',
        severity: 'medium',
        description: `${singleSentenceParagraphs} paragraphs have only one sentence`
      });
    }

    if (longParagraphs > paragraphs.length * 0.2) {
      coherence.issues.push({
        type: 'dense_paragraphs',
        severity: 'medium',
        description: `${longParagraphs} paragraphs are too long (>500 chars)`
      });
    }

    if (coherence.metrics.transitionWords < sentences.length * 0.1) {
      coherence.issues.push({
        type: 'poor_flow',
        severity: 'low',
        description: 'Few transition words detected - content may feel disjointed'
      });
    }

    // Calculate score
    let score = 100;
    score -= coherence.issues.length * 10;
    score -= coherence.metrics.redundantPhrases * 5;

    if (coherence.metrics.avgSentenceLength > 30) score -= 10;
    if (coherence.metrics.transitionWords < 3) score -= 10;

    coherence.score = Math.max(0, Math.min(100, score));

    return coherence;
  }

  /**
   * Aggregate review results into overall score
   * @returns {Object} Aggregated review result
   * @returns {number} returns.score - Weighted overall score
   * @returns {Object} returns.breakdown - Individual stage scores
   * @returns {Object} returns.weights - Stage weights used
   * @description Weights:
   *   - Specificity: 35%
   *   - Fact Verification: 40%
   *   - Coherence: 25%
   */
  aggregateReview() {
    const weights = {
      specificity: 0.35,
      factVerification: 0.40,
      coherence: 0.25
    };

    const weightedScore =
      (this.results.review.specificity.score * weights.specificity) +
      (this.results.review.factVerification.score * weights.factVerification) +
      (this.results.review.coherence.score * weights.coherence);

    return {
      score: Math.round(weightedScore),
      breakdown: {
        specificity: this.results.review.specificity.score,
        factVerification: this.results.review.factVerification.score,
        coherence: this.results.review.coherence.score
      },
      weights
    };
  }

  /**
   * Apply auto-fixes for common filler phrases and vague language
   * @param {string} content - Content to fix
   * @returns {Promise<Array<Object>>} Array of applied fixes
   * @description Fixes common filler phrases:
   *   - "in today's fast-paced world" -> removed
   *   - "it's important to note that" -> removed
   *   - "in conclusion" -> removed
   *   - "as we all know" -> removed
   *   - "let's dive into" -> removed
   *   - "utilize" -> "use"
   *   - "facilitate" -> "help"
   *   - "in order to" -> "to"
   */
  async applyAutoFixes(content) {
    const fixes = [];

    // Auto-fix common filler phrases
    const fillerFixes = [
      { pattern: /\bin\s+today's\s+fast-paced\s+world[,.]?\s*/gi, replacement: '' },
      { pattern: /\bit's\s+important\s+to\s+note\s+that\s*/gi, replacement: '' },
      { pattern: /\bin\s+conclusion[,.]?\s*/gi, replacement: '' },
      { pattern: /\bas\s+we\s+all\s+know[,.]?\s*/gi, replacement: '' },
      { pattern: /\blet's\s+dive\s+into\s*/gi, replacement: '' },
      { pattern: /\butilize\b/gi, replacement: 'use' },
      { pattern: /\bfacilitate\b/gi, replacement: 'help' },
      { pattern: /\bin\s+order\s+to\b/gi, replacement: 'to' }
    ];

    let fixedContent = content;
    for (const { pattern, replacement } of fillerFixes) {
      const matches = fixedContent.match(pattern);
      if (matches) {
        fixedContent = fixedContent.replace(pattern, replacement);
        fixes.push({
          type: 'filler_phrase',
          count: matches.length,
          pattern: pattern.toString()
        });
      }
    }

    // Save fixed content if output file specified
    if (this.outputFile && fixes.length > 0) {
      fs.writeFileSync(this.outputFile, fixedContent, 'utf-8');
    }

    return fixes;
  }

  /**
   * Output results to console and return results object
   * @returns {Object} Complete results object
   */
  outputResults() {
    console.log('\n=== Content Review Results ===');
    console.log(`Final Score: ${this.results.finalScore}/100`);
    console.log(`Status: ${this.results.passed ? 'PASSED' : 'FAILED'}`);

    console.log('\nDetailed Scores:');
    console.log(`  Specificity: ${this.results.review.specificity.score}/100`);
    console.log(`  Fact Verification: ${this.results.review.factVerification.score}/100`);
    console.log(`  Coherence: ${this.results.review.coherence.score}/100`);

    if (this.results.autoFixes.length > 0) {
      console.log(`\nAuto-fixes Applied: ${this.results.autoFixes.length}`);
      for (const fix of this.results.autoFixes) {
        console.log(`  - ${fix.type}: ${fix.count} instances`);
      }
    }

    if (this.outputFile && this.results.autoFixes.length > 0) {
      console.log(`\nFixed content saved to: ${this.outputFile}`);
    }

    console.log('\nFull results:', JSON.stringify(this.results, null, 2));

    return this.results;
  }

  /**
   * Mark workflow as failed with error message
   * @param {string} message - Error message
   * @returns {Object} Results object with error
   */
  fail(message) {
    console.error('Workflow failed:', message);
    this.results.error = message;
    return this.results;
  }
}

/**
 * CLI interface for content review workflow
 * @description Usage: node content-review.js <file-or-content> [--strict] [--auto-fix] [--output <file>]
 */
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node content-review.js <file-or-content> [--strict] [--auto-fix] [--output <file>]');
    process.exit(1);
  }

  const input = args[0];
  const strict = args.includes('--strict');
  const autoFix = !args.includes('--no-auto-fix');
  const outputIdx = args.indexOf('--output');
  const output = outputIdx !== -1 ? args[outputIdx + 1] : null;

  const workflow = new ContentReviewWorkflow({ strict, autoFix, output });
  workflow.run(input).then(results => {
    process.exit(results.passed ? 0 : 1);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(2);
  });
}

module.exports = ContentReviewWorkflow;
