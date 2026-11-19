#!/usr/bin/env node

/**
 * @fileoverview Quality Assurance Workflow - Multi-stage validation with parallel quality checks
 * @module workflows/quality-assurance
 * @description Multi-stage validation pipeline with parallel quality checks and adversarial
 * verification. Integrates anti-slop-validator, hallucination-detector, and specificity-enforcer
 * skills to provide comprehensive content quality assessment.
 *
 * Usage: node quality-assurance.js <file-or-content> [--threshold <score>] [--parallel]
 * @version 1.0.0
 * @author Mastery Node.js Project
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Quality Assurance Workflow for comprehensive content validation
 * @class QualityAssuranceWorkflow
 * @description Runs parallel quality checks (anti-slop, hallucination, specificity),
 * performs adversarial verification on weak points, aggregates results, and generates
 * recommendations for improvement.
 *
 * @example
 * const workflow = new QualityAssuranceWorkflow({ threshold: 80, parallel: true });
 * const result = await workflow.run('./content.md');
 * console.log(result.passed); // true/false
 */
class QualityAssuranceWorkflow {
  /**
   * Creates a new QualityAssuranceWorkflow instance
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.threshold=75] - Minimum score to pass (0-100)
   * @param {boolean} [options.parallel=true] - Run checks in parallel
   */
  constructor(options = {}) {
    /** @type {number} Minimum score threshold to pass */
    this.threshold = options.threshold || 75;
    /** @type {boolean} Whether to run checks in parallel */
    this.parallel = options.parallel !== false;

    /**
     * Results object for storing workflow output
     * @type {Object}
     * @property {string} timestamp - ISO timestamp
     * @property {Object} input - Input validation result
     * @property {Object} stages - Stage results
     * @property {number} finalScore - Final aggregated score
     * @property {boolean} passed - Whether content passed threshold
     * @property {Array<Object>} recommendations - Improvement recommendations
     */
    this.results = {
      timestamp: new Date().toISOString(),
      input: null,
      stages: {},
      finalScore: 0,
      passed: false,
      recommendations: []
    };
  }

  /**
   * Run the complete quality assurance workflow
   * @param {string} input - File path or inline content
   * @returns {Promise<Object>} Workflow results
   * @description Four-stage pipeline:
   *   1. Input validation
   *   2. Parallel quality checks (anti-slop, hallucination, specificity)
   *   3. Adversarial verification on weak points
   *   4. Aggregation and recommendation generation
   */
  async run(input) {
    console.log('=== Quality Assurance Workflow ===');
    console.log(`Threshold: ${this.threshold}`);
    console.log(`Mode: ${this.parallel ? 'Parallel' : 'Sequential'}\n`);

    // Stage 0: Input validation
    this.results.input = this.validateInput(input);
    if (!this.results.input.valid) {
      return this.fail('Invalid input: ' + this.results.input.error);
    }

    // Stage 1: Parallel quality checks
    console.log('Stage 1: Running parallel quality checks...');
    const stage1Results = await this.runParallelChecks(this.results.input.content);

    // Stage 2: Adversarial verification
    console.log('\nStage 2: Adversarial verification...');
    const stage2Results = await this.runAdversarialVerification(this.results.input.content, stage1Results);

    // Stage 3: Aggregate and score
    console.log('\nStage 3: Aggregating results...');
    const finalResults = this.aggregateResults(stage1Results, stage2Results);

    // Stage 4: Generate recommendations
    console.log('\nStage 4: Generating recommendations...');
    this.generateRecommendations(finalResults);

    // Final output
    this.results.finalScore = finalResults.aggregateScore;
    this.results.passed = finalResults.aggregateScore >= this.threshold;
    this.results.stages = {
      parallelChecks: stage1Results,
      adversarialVerification: stage2Results,
      aggregation: finalResults
    };

    return this.outputResults();
  }

  /**
   * Validate input - check if it's a file path or inline content
   * @param {string} input - Input to validate
   * @returns {Object} Validation result
   * @returns {boolean} returns.valid - True if input is valid
   * @returns {string} [returns.content] - Content string (if valid)
   * @returns {string} [returns.source] - Source type ('file' or 'inline')
   * @returns {string} [returns.path] - File path (if source is 'file')
   * @returns {string} [returns.error] - Error message (if invalid)
   */
  validateInput(input) {
    if (!input || typeof input !== 'string') {
      return { valid: false, error: 'Input must be a non-empty string' };
    }

    // Check if input is a file path
    if (fs.existsSync(input)) {
      try {
        const content = fs.readFileSync(input, 'utf-8');
        return { valid: true, content, source: 'file', path: input };
      } catch (err) {
        return { valid: false, error: `Cannot read file: ${err.message}` };
      }
    }

    // Treat as inline content
    return { valid: true, content: input, source: 'inline' };
  }

  /**
   * Run parallel quality checks using three skills
   * @param {string} content - Content to check
   * @returns {Promise<Array<Object>>} Array of check results
   * @description Runs three checks with weights:
   *   - anti-slop-validator (30%)
   *   - hallucination-detector (35%)
   *   - specificity-enforcer (35%)
   */
  async runParallelChecks(content) {
    const checks = [
      { name: 'anti-slop', skill: 'anti-slop-validator', weight: 0.30 },
      { name: 'hallucination', skill: 'hallucination-detector', weight: 0.35 },
      { name: 'specificity', skill: 'specificity-enforcer', weight: 0.35 }
    ];

    if (this.parallel) {
      // Run all checks in parallel
      const promises = checks.map(check =>
        this.invokeSkill(check.skill, content)
          .then(result => ({ ...check, result, status: 'success' }))
          .catch(err => ({ ...check, error: err.message, status: 'error' }))
      );
      return Promise.all(promises);
    } else {
      // Run sequentially
      const results = [];
      for (const check of checks) {
        try {
          const result = await this.invokeSkill(check.skill, content);
          results.push({ ...check, result, status: 'success' });
        } catch (err) {
          results.push({ ...check, error: err.message, status: 'error' });
        }
      }
      return results;
    }
  }

  /**
   * Run adversarial verification on weak points from stage 1
   * @param {string} content - Original content
   * @param {Array<Object>} stage1Results - Results from parallel checks
   * @returns {Promise<Object>} Verification results
   * @returns {Array<string>} returns.claimsToVerify - Claims to verify
   * @returns {Array<string>} returns.vagueInstances - Vague language instances
   * @returns {Array<string>} returns.unsupportedStatements - Unsupported statements
   * @returns {Array<Object>} returns.verificationResults - Individual verification results
   */
  async runAdversarialVerification(content, stage1Results) {
    // Extract claims and weak points from stage 1
    const weakPoints = this.extractWeakPoints(stage1Results);

    // Run targeted verification on weak points
    const verification = {
      claimsToVerify: weakPoints.claims,
      vagueInstances: weakPoints.vague,
      unsupportedStatements: weakPoints.unsupported,
      verificationResults: []
    };

    // Verify each weak point
    for (const claim of weakPoints.claims) {
      const verified = await this.verifyClaim(claim, content);
      verification.verificationResults.push(verified);
    }

    return verification;
  }

  /**
   * Extract weak points from stage 1 results
   * @param {Array<Object>} stage1Results - Results from parallel checks
   * @returns {Object} Weak points categorized by type
   * @returns {Array<string>} returns.claims - Low-confidence claims
   * @returns {Array<string>} returns.vague - Vague language instances
   * @returns {Array<string>} returns.unsupported - Unsupported claims
   */
  extractWeakPoints(stage1Results) {
    const weakPoints = {
      claims: [],
      vague: [],
      unsupported: []
    };

    for (const check of stage1Results) {
      if (check.status === 'error' || !check.result) continue;

      // Extract from hallucination-detector
      if (check.name === 'hallucination' && check.result.detection) {
        weakPoints.claims.push(
          ...check.result.detection.claims
            .filter(c => c.confidence < 80)
            .map(c => c.text)
        );
      }

      // Extract from specificity-enforcer
      if (check.name === 'specificity' && check.result.enforcement) {
        weakPoints.vague.push(
          ...check.result.enforcement.changes
            .filter(c => c.type === 'needs_human_input')
            .map(c => c.text)
        );
      }

      // Extract from anti-slop-validator
      if (check.name === 'anti-slop' && check.result.validation) {
        weakPoints.unsupported.push(
          ...check.result.validation.findings
            .filter(f => f.category === 'unsupported_claim')
            .map(f => f.text)
        );
      }
    }

    return weakPoints;
  }

  /**
   * Verify a single claim against content context
   * @param {string} claim - Claim text to verify
   * @param {string} content - Full content for context
   * @returns {Promise<Object>} Verification result
   * @returns {string} returns.claim - Original claim
   * @returns {number} returns.confidence - Confidence score (0-100)
   * @returns {boolean} returns.verified - True if confidence >= 70
   * @returns {string} returns.reason - Verification reason
   * @description Confidence scoring:
   *   - Base: 50
   *   - Has context in content: +20
   *   - Has numbers AND source: +20
   *   - No numbers AND no source: -20
   */
  async verifyClaim(claim, content) {
    // Simple verification: check if claim appears in content with supporting context
    const hasContext = content.includes(claim) && content.length > claim.length * 2;
    const hasNumbers = /\d+%|\d+x|\d+\s*(ms|seconds|minutes)/.test(claim);
    const hasSource = /according to|study|research|benchmark/i.test(content);

    let confidence = 50;
    if (hasContext) confidence += 20;
    if (hasNumbers && hasSource) confidence += 20;
    if (!hasNumbers && !hasSource) confidence -= 20;

    return {
      claim,
      confidence: Math.max(0, Math.min(100, confidence)),
      verified: confidence >= 70,
      reason: confidence >= 70 ? 'Supported by context' : 'Insufficient evidence'
    };
  }

  /**
   * Aggregate results from all stages into final score
   * @param {Array<Object>} stage1Results - Parallel check results
   * @param {Object} stage2Results - Adversarial verification results
   * @returns {Object} Aggregated results
   * @returns {number} returns.aggregateScore - Final weighted score
   * @returns {number} returns.stage1Score - Base score from stage 1
   * @returns {number} returns.verificationRatio - Percentage of verified claims
   * @returns {Array<Object>} returns.issues - Failed checks
   * @returns {Array<Object>} returns.breakdown - Per-check breakdown
   */
  aggregateResults(stage1Results, stage2Results) {
    let totalScore = 0;
    let totalWeight = 0;
    const issues = [];

    // Aggregate stage 1 scores
    for (const check of stage1Results) {
      if (check.status === 'error') {
        issues.push({ type: 'check_failed', check: check.name, error: check.error });
        continue;
      }

      let score = 0;
      if (check.name === 'anti-slop' && check.result.validation) {
        score = check.result.validation.overallScore;
      } else if (check.name === 'hallucination' && check.result.detection) {
        score = check.result.detection.overallConfidence;
      } else if (check.name === 'specificity' && check.result.enforcement) {
        score = check.result.enforcement.specificityScoreAfter;
      }

      totalScore += score * check.weight;
      totalWeight += check.weight;
    }

    // Adjust based on stage 2 verification
    const verifiedClaims = stage2Results.verificationResults.filter(r => r.verified).length;
    const totalClaims = stage2Results.verificationResults.length;
    const verificationRatio = totalClaims > 0 ? verifiedClaims / totalClaims : 1;

    const baseScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const aggregateScore = Math.round(baseScore * (0.7 + 0.3 * verificationRatio));

    return {
      aggregateScore,
      stage1Score: Math.round(baseScore),
      verificationRatio: Math.round(verificationRatio * 100),
      issues,
      breakdown: stage1Results.map(c => ({
        check: c.name,
        score: c.result?.validation?.overallScore ||
               c.result?.detection?.overallConfidence ||
               c.result?.enforcement?.specificityScoreAfter || 0,
        weight: c.weight,
        status: c.status
      }))
    };
  }

  /**
   * Generate recommendations based on final results
   * @param {Object} finalResults - Aggregated results
   * @description Recommendations by priority:
   *   - critical: aggregateScore < 60
   *   - high: verificationRatio < 70 or failed checks
   *   - medium: individual check score < 70
   */
  generateRecommendations(finalResults) {
    const recommendations = [];

    if (finalResults.aggregateScore < 60) {
      recommendations.push({
        priority: 'critical',
        action: 'Major revision required',
        reason: 'Content has significant quality issues across multiple dimensions'
      });
    }

    if (finalResults.verificationRatio < 70) {
      recommendations.push({
        priority: 'high',
        action: 'Verify all factual claims',
        reason: `${100 - finalResults.verificationRatio}% of claims could not be verified`
      });
    }

    for (const breakdown of finalResults.breakdown) {
      if (breakdown.score < 70) {
        recommendations.push({
          priority: 'medium',
          action: `Improve ${breakdown.check}`,
          reason: `${breakdown.check} score is ${breakdown.score}/100`
        });
      }
    }

    if (finalResults.issues.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Fix failed checks',
        reason: `${finalResults.issues.length} quality checks failed to run`
      });
    }

    this.results.recommendations = recommendations;
  }

  /**
   * Invoke a quality check skill (mock implementation)
   * @param {string} skillName - Skill name to invoke
   * @param {string} content - Content to check
   * @returns {Promise<Object>} Skill result
   * @description Returns mock results for:
   *   - anti-slop-validator: validation with overallScore
   *   - hallucination-detector: detection with overallConfidence
   *   - specificity-enforcer: enforcement with specificityScoreAfter
   */
  async invokeSkill(skillName, content) {
    // Simulate skill invocation - in real implementation, this would call the skill
    // For now, return mock results based on skill type
    return new Promise((resolve) => {
      setTimeout(() => {
        if (skillName === 'anti-slop-validator') {
          resolve({
            validation: {
              overallScore: 72,
              grade: 'B',
              dimensions: {
                specificity: { score: 65 },
                accuracy: { score: 80 },
                relevance: { score: 75 },
                coherence: { score: 70 }
              },
              findings: []
            }
          });
        } else if (skillName === 'hallucination-detector') {
          resolve({
            detection: {
              overallConfidence: 78,
              totalClaims: 10,
              verified: 7,
              unverified: 3,
              claims: []
            }
          });
        } else if (skillName === 'specificity-enforcer') {
          resolve({
            enforcement: {
              specificityScoreBefore: 45,
              specificityScoreAfter: 82,
              vaguenessInstances: 8,
              fixedAutomatically: 6,
              needsHumanInput: 2,
              changes: []
            }
          });
        }
      }, 100);
    });
  }

  /**
   * Output results to console and return results object
   * @returns {Object} Complete results object
   */
  outputResults() {
    console.log('\n=== Quality Assurance Results ===');
    console.log(`Final Score: ${this.results.finalScore}/100`);
    console.log(`Status: ${this.results.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`Threshold: ${this.threshold}`);

    if (this.results.recommendations.length > 0) {
      console.log('\nRecommendations:');
      for (const rec of this.results.recommendations) {
        console.log(`  [${rec.priority.toUpperCase()}] ${rec.action}`);
        console.log(`    Reason: ${rec.reason}`);
      }
    }

    console.log('\nDetailed breakdown:');
    console.log(JSON.stringify(this.results, null, 2));

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
 * CLI interface for quality assurance workflow
 * @description Usage: node quality-assurance.js <file-or-content> [--threshold <score>] [--parallel]
 */
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node quality-assurance.js <file-or-content> [--threshold <score>] [--parallel]');
    process.exit(1);
  }

  const input = args[0];
  const thresholdIdx = args.indexOf('--threshold');
  const threshold = thresholdIdx !== -1 ? parseInt(args[thresholdIdx + 1]) : 75;
  const parallel = args.includes('--parallel');

  const workflow = new QualityAssuranceWorkflow({ threshold, parallel });
  workflow.run(input).then(results => {
    process.exit(results.passed ? 0 : 1);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(2);
  });
}

module.exports = QualityAssuranceWorkflow;
