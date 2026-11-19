#!/usr/bin/env node

/**
 * @fileoverview Error Gates Hook - Validates error handling quality in code
 * @module hooks/error-gates
 * @description Analyzes code files for common error handling anti-patterns and provides
 * quality gates to ensure proper error handling practices. Detects unhandled promises,
 * empty catch blocks, generic error handling, and validates presence of error logging,
 * recovery mechanisms, and error context.
 * @version 1.0.0
 * @author Mastery Node.js Project
 */

const fs = require('fs');
const path = require('path');

/**
 * Error Gates analyzer for validating error handling patterns
 * @class ErrorGates
 * @description Scans code for error handling issues and provides quality metrics
 *
 * @example
 * const gates = new ErrorGates();
 * const result = gates.validateErrorHandling(code);
 * console.log(result.status); // 'pass', 'warn', or 'fail'
 */
class ErrorGates {
  /**
   * Creates a new ErrorGates instance
   * @constructor
   */
  constructor() {
    /**
     * Regex patterns for detecting error handling anti-patterns
     * @type {Object<string, RegExp>}
     * @property {RegExp} unhandledPromise - Matches .then() without .catch()
     *   Pattern: /\.then\([^)]*\)(?!\s*\.catch)/
     *   Example match: "promise.then(x => x)" without subsequent .catch()
     *   Example non-match: "promise.then(x => x).catch(err => err)"
     *
     * @property {RegExp} missingTryCatch - Matches async functions with await but no try-catch
     *   Pattern: /async\s+function[^{]*{[^}]*await[^}]*}(?!\s*catch)/
     *   Example match: "async function foo() { await bar(); }"
     *   Example non-match: "async function foo() { try { await bar(); } catch(e) {} }"
     *
     * @property {RegExp} emptyCatch - Matches catch blocks with empty bodies
     *   Pattern: /catch\s*\([^)]*\)\s*{\s*}/
     *   Example match: "catch (err) {}"
     *   Example non-match: "catch (err) { console.error(err); }"
     *
     * @property {RegExp} genericError - Matches catch blocks with only console.log
     *   Pattern: /catch\s*\(\s*\w+\s*\)\s*{\s*console\.log/
     *   Example match: "catch (err) { console.log(err); }"
     *   Example non-match: "catch (err) { console.error(err); }"
     *
     * @property {RegExp} swallowedError - Matches catch blocks with only comments
     *   Pattern: /catch\s*\([^)]*\)\s*{\s*\/\//
     *   Example match: "catch (err) { // ignore }"
     *   Example non-match: "catch (err) { handleError(err); }"
     */
    this.errorPatterns = {
      unhandledPromise: /\.then\([^)]*\)(?!\s*\.catch)/,
      missingTryCatch: /async\s+function[^{]*{[^}]*await[^}]*}(?!\s*catch)/,
      emptyCatch: /catch\s*\([^)]*\)\s*{\s*}/,
      genericError: /catch\s*\(\s*\w+\s*\)\s*{\s*console\.log/,
      swallowedError: /catch\s*\([^)]*\)\s*{\s*\/\//,
    };

    /**
     * Regex patterns for detecting good error handling practices
     * @type {Object<string, RegExp>}
     * @property {RegExp} errorLogging - Matches error logging calls
     *   Pattern: /console\.error|logger\.error|log\.error/
     *   Example match: "console.error('Error:', err)" or "logger.error(err)"
     *
     * @property {RegExp} errorRecovery - Matches error recovery mechanisms
     *   Pattern: /retry|fallback|recover/
     *   Example match: "retry()" or "fallbackValue" or "recoverFromError()"
     *
     * @property {RegExp} errorContext - Matches error context preservation
     *   Pattern: /error\.message|error\.stack|error\.context/
     *   Example match: "error.message" or "err.stack" or "error.context"
     */
    this.requiredPatterns = {
      errorLogging: /console\.error|logger\.error|log\.error/,
      errorRecovery: /retry|fallback|recover/,
      errorContext: /error\.message|error\.stack|error\.context/,
    };
  }

  /**
   * Analyze error handling in code and identify issues and strengths
   * @param {string} code - Source code to analyze
   * @returns {Object} Analysis result
   * @returns {Array<Object>} returns.issues - Array of detected issues
   * @returns {Array<Object>} returns.strengths - Array of detected strengths
   */
  analyzeErrorHandling(code) {
    const issues = [];
    const strengths = [];

    // Check for error patterns
    for (const [name, pattern] of Object.entries(this.errorPatterns)) {
      const matches = code.match(pattern);
      if (matches) {
        issues.push({
          type: name,
          severity: this.getSeverity(name),
          message: this.getErrorMessage(name),
          location: this.findLocation(code, pattern)
        });
      }
    }

    // Check for required patterns
    for (const [name, pattern] of Object.entries(this.requiredPatterns)) {
      if (pattern.test(code)) {
        strengths.push({
          type: name,
          message: `Good: ${name} detected`
        });
      }
    }

    return { issues, strengths };
  }

  /**
   * Get severity level for an error pattern
   * @param {string} patternName - Name of the error pattern
   * @returns {string} Severity level: 'high', 'medium', or 'low'
   */
  getSeverity(patternName) {
    const severities = {
      unhandledPromise: 'high',
      missingTryCatch: 'high',
      emptyCatch: 'medium',
      genericError: 'low',
      swallowedError: 'medium'
    };
    return severities[patternName] || 'medium';
  }

  /**
   * Get human-readable error message for a pattern
   * @param {string} patternName - Name of the error pattern
   * @returns {string} Error message describing the issue
   */
  getErrorMessage(patternName) {
    const messages = {
      unhandledPromise: 'Promise without catch handler',
      missingTryCatch: 'Async function without try-catch',
      emptyCatch: 'Empty catch block - errors are silently ignored',
      genericError: 'Generic error handling - provide specific handling',
      swallowedError: 'Error is swallowed without handling'
    };
    return messages[patternName] || 'Error handling issue detected';
  }

  /**
   * Find the location (line and column) of a pattern match in code
   * @param {string} code - Source code
   * @param {RegExp} pattern - Pattern to find
   * @returns {Object|null} Location object or null if not found
   * @returns {number} returns.line - Line number (1-indexed)
   * @returns {number} returns.column - Column number (1-indexed)
   */
  findLocation(code, pattern) {
    const match = code.match(pattern);
    if (!match) return null;

    const beforeMatch = code.substring(0, match.index);
    const lines = beforeMatch.split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  }

  /**
   * Validate error handling quality and determine gate status
   * @param {string} code - Source code to validate
   * @returns {Object} Validation result
   * @returns {string} returns.status - Gate status: 'pass', 'warn', or 'fail'
   * @returns {Array<Object>} returns.issues - Array of issues found
   * @returns {Array<Object>} returns.strengths - Array of strengths found
   * @returns {number} returns.score - Quality score (0-100)
   */
  validateErrorHandling(code) {
    const analysis = this.analyzeErrorHandling(code);

    const hasHighSeverity = analysis.issues.some(i => i.severity === 'high');
    const hasMediumSeverity = analysis.issues.some(i => i.severity === 'medium');

    let gateStatus = 'pass';
    if (hasHighSeverity) {
      gateStatus = 'fail';
    } else if (hasMediumSeverity) {
      gateStatus = 'warn';
    }

    return {
      status: gateStatus,
      issues: analysis.issues,
      strengths: analysis.strengths,
      score: this.calculateScore(analysis)
    };
  }

  /**
   * Calculate error handling quality score
   * @param {Object} analysis - Analysis result from analyzeErrorHandling
   * @returns {number} Score from 0 to 100
   * @description Scoring rules:
   *   - Start at 100
   *   - High severity issue: -20 points
   *   - Medium severity issue: -10 points
   *   - Low severity issue: -5 points
   *   - Each strength: +5 points
   *   - Clamped to [0, 100]
   */
  calculateScore(analysis) {
    let score = 100;

    analysis.issues.forEach(issue => {
      switch (issue.severity) {
        case 'high': score -= 20; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    });

    analysis.strengths.forEach(() => {
      score += 5;
    });

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Main hook execution - reads code from stdin and outputs validation result
   * @description Reads JSON input from stdin with file_path, analyzes the file,
   *   and outputs JSON result to stdout. Exits with code 1 if validation fails.
   */
  execute() {
    try {
      const input = JSON.parse(fs.readFileSync(0, 'utf-8'));
      const filePath = input.file_path || input.args?.[0];

      if (!filePath || !fs.existsSync(filePath)) {
        console.log(JSON.stringify({
          status: 'skip',
          message: 'File not found or not specified'
        }));
        process.exit(0);
      }

      const code = fs.readFileSync(filePath, 'utf-8');
      const validation = this.validateErrorHandling(code);

      console.log(JSON.stringify({
        status: validation.status,
        score: validation.score,
        issues: validation.issues,
        strengths: validation.strengths,
        file: filePath
      }));

      process.exit(validation.status === 'fail' ? 1 : 0);

    } catch (error) {
      console.error(JSON.stringify({
        status: 'error',
        message: `Hook execution error: ${error.message}`
      }));
      process.exit(1);
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const gates = new ErrorGates();
  gates.execute();
}

module.exports = ErrorGates;
