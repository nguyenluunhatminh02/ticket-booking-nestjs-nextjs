#!/usr/bin/env node

/**
 * @fileoverview Loop Engineering Audit Tool
 * @module scripts/loop-audit
 * @description Analyzes JavaScript/TypeScript code files for loop patterns and safety practices.
 * Detects potential infinite loops, missing iteration counters, lack of maximum guards,
 * missing progress logging, and unbounded loops. Provides recommendations for improving
 * loop safety and reliability.
 * @version 1.0.0
 * @author Mastery Node.js Project
 */

const fs = require('fs');
const path = require('path');

/**
 * Loop Auditor for analyzing loop patterns in code
 * @class LoopAuditor
 * @description Scans code files for loop constructs and validates they follow
 * best practices for safety and reliability.
 *
 * @example
 * const auditor = new LoopAuditor();
 * const report = auditor.auditPath('./src');
 * console.log(report.findings);
 */
class LoopAuditor {
  /**
   * Creates a new LoopAuditor instance
   * @constructor
   */
  constructor() {
    /** @type {Array<Object>} Array of audit findings */
    this.findings = [];

    /**
     * Audit statistics
     * @type {Object}
     * @property {number} filesAnalyzed - Number of files processed
     * @property {number} loopsFound - Total loops detected
     * @property {number} issuesFound - Total issues found
     * @property {number} safeLoops - Loops with no issues
     */
    this.stats = {
      filesAnalyzed: 0,
      loopsFound: 0,
      issuesFound: 0,
      safeLoops: 0
    };
  }

  /**
   * Audit a file or directory path
   * @param {string} targetPath - Path to file or directory
   * @returns {Object} Audit report with summary, findings, and recommendations
   */
  auditPath(targetPath) {
    const stat = fs.statSync(targetPath);

    if (stat.isDirectory()) {
      this.auditDirectory(targetPath);
    } else if (stat.isFile() && this.isJavaScriptFile(targetPath)) {
      this.auditFile(targetPath);
    }

    return this.generateReport();
  }

  /**
   * Recursively audit all JavaScript files in a directory
   * @param {string} dirPath - Directory path to audit
   */
  auditDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip node_modules and hidden directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        this.auditDirectory(fullPath);
      } else if (entry.isFile() && this.isJavaScriptFile(entry.name)) {
        this.auditFile(fullPath);
      }
    }
  }

  /**
   * Check if a filename is a JavaScript/TypeScript file
   * @param {string} filename - File name to check
   * @returns {boolean} True if file is .js, .ts, .jsx, or .tsx
   */
  isJavaScriptFile(filename) {
    return filename.endsWith('.js') || filename.endsWith('.ts') || filename.endsWith('.jsx') || filename.endsWith('.tsx');
  }

  /**
   * Audit a single file for loop patterns
   * @param {string} filePath - Path to file to audit
   * @description Detects loop constructs using regex patterns:
   *   - /\bwhile\s*\(/g - while loops
   *   - /\bfor\s*\(/g - for loops
   *   - /\bdo\s*\{/g - do-while loops
   *   - /\bfor\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+/g - for-of loops
   *   - /\bfor\s*\(\s*(?:const|let|var)\s+\w+\s+in\s+/g - for-in loops
   */
  auditFile(filePath) {
    this.stats.filesAnalyzed++;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Find all loop constructs
    const loopPatterns = [
      { regex: /\bwhile\s*\(/g, type: 'while' },
      { regex: /\bfor\s*\(/g, type: 'for' },
      { regex: /\bdo\s*\{/g, type: 'do-while' },
      { regex: /\bfor\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+/g, type: 'for-of' },
      { regex: /\bfor\s*\(\s*(?:const|let|var)\s+\w+\s+in\s+/g, type: 'for-in' }
    ];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const pattern of loopPatterns) {
        const matches = line.match(pattern.regex);
        if (matches) {
          this.analyzeLoop(filePath, lines, lineNum, pattern.type);
        }
      }
    }
  }

  /**
   * Analyze a single loop for safety issues
   * @param {string} filePath - File containing the loop
   * @param {Array<string>} lines - All lines in the file
   * @param {number} startLine - Line number where loop starts (0-indexed)
   * @param {string} loopType - Type of loop (while, for, do-while, for-of, for-in)
   * @description Checks for:
   *   1. Missing iteration counters in while loops
   *   2. Missing maximum iteration guards (MAX_ITERATIONS, maxCount, etc.)
   *   3. Missing progress logging
   *   4. Missing error handling in long loops
   *   5. Potential infinite loops (while(true))
   *   6. Unbounded for loops without clear termination conditions
   */
  analyzeLoop(filePath, lines, startLine, loopType) {
    this.stats.loopsFound++;

    // Extract loop context (next 50 lines or until closing brace)
    const context = lines.slice(startLine, Math.min(startLine + 50, lines.length)).join('\n');
    const hasIssues = [];

    // Check 1: While loops should have iteration counters
    if (loopType === 'while') {
      if (!context.match(/\b(let|const|var)\s+\w*(?:count|iteration|iter|i|j)\w*\s*=/)) {
        hasIssues.push({
          type: 'missing-counter',
          severity: 'high',
          message: 'While loop lacks iteration counter'
        });
      }
    }

    // Check 2: Look for max iteration guards
    const hasMaxGuard = context.match(/MAX_|maxIterations|maxCount|maxAttempts|MAX_ITERATIONS/);
    if (!hasMaxGuard && (loopType === 'while' || loopType === 'do-while')) {
      hasIssues.push({
        type: 'no-max-guard',
        severity: 'high',
        message: 'Loop lacks maximum iteration guard'
      });
    }

    // Check 3: Check for progress logging
    const hasProgressLog = context.match(/console\.log|logger\.|console\.info/);
    if (!hasProgressLog) {
      hasIssues.push({
        type: 'no-progress-log',
        severity: 'medium',
        message: 'Loop lacks progress logging'
      });
    }

    // Check 4: Check for error handling
    const hasErrorHandling = context.match(/try\s*\{|catch\s*\(|\.catch\(/);
    if (!hasErrorHandling && context.length > 200) {
      hasIssues.push({
        type: 'no-error-handling',
        severity: 'medium',
        message: 'Long loop lacks error handling'
      });
    }

    // Check 5: Detect potential infinite loops
    if (loopType === 'while' && context.match(/while\s*\(\s*true\s*\)/)) {
      hasIssues.push({
        type: 'infinite-loop',
        severity: 'critical',
        message: 'Potential infinite loop detected (while(true))'
      });
    }

    // Check 6: For loops should have bounded conditions
    if (loopType === 'for') {
      const hasBound = context.match(/<\s*\w+\.length|<\s*\w+Count|<=\s*\d+/);
      if (!hasBound) {
        hasIssues.push({
          type: 'unbounded-for',
          severity: 'medium',
          message: 'For loop may lack clear bounds'
        });
      }
    }

    // Record findings
    if (hasIssues.length > 0) {
      this.stats.issuesFound += hasIssues.length;

      for (const issue of hasIssues) {
        this.findings.push({
          file: filePath,
          line: startLine + 1,
          loopType,
          ...issue
        });
      }
    } else {
      this.stats.safeLoops++;
    }
  }

  /**
   * Generate audit report with summary, findings, and recommendations
   * @returns {Object} Audit report
   * @returns {Object} returns.summary - Statistics summary
   * @returns {Array<Object>} returns.findings - Array of findings
   * @returns {Array<Object>} returns.recommendations - Array of recommendations
   */
  generateReport() {
    const report = {
      summary: this.stats,
      findings: this.findings,
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Generate recommendations based on findings
   * @returns {Array<Object>} Array of recommendations sorted by priority
   * @description Generates recommendations for:
   *   - missing-counter: Add iteration counters to while loops
   *   - no-max-guard: Add MAX_ITERATIONS constant and checks
   *   - no-progress-log: Add periodic logging
   *   - no-error-handling: Wrap loop body in try-catch
   *   - infinite-loop: Replace while(true) with bounded loop
   */
  generateRecommendations() {
    const recommendations = [];

    const issueCounts = {};
    for (const finding of this.findings) {
      issueCounts[finding.type] = (issueCounts[finding.type] || 0) + 1;
    }

    if (issueCounts['missing-counter'] > 0) {
      recommendations.push({
        priority: 'high',
        issue: 'missing-counter',
        count: issueCounts['missing-counter'],
        fix: 'Add iteration counters to while loops: let iteration = 0; iteration++'
      });
    }

    if (issueCounts['no-max-guard'] > 0) {
      recommendations.push({
        priority: 'high',
        issue: 'no-max-guard',
        count: issueCounts['no-max-guard'],
        fix: 'Add MAX_ITERATIONS constant and check: if (iteration >= MAX_ITERATIONS) break;'
      });
    }

    if (issueCounts['no-progress-log'] > 0) {
      recommendations.push({
        priority: 'medium',
        issue: 'no-progress-log',
        count: issueCounts['no-progress-log'],
        fix: 'Add periodic logging: if (iteration % 10 === 0) console.log(`Progress: ${iteration}`)'
      });
    }

    if (issueCounts['no-error-handling'] > 0) {
      recommendations.push({
        priority: 'medium',
        issue: 'no-error-handling',
        count: issueCounts['no-error-handling'],
        fix: 'Wrap loop body in try-catch or add .catch() handlers'
      });
    }

    if (issueCounts['infinite-loop'] > 0) {
      recommendations.push({
        priority: 'critical',
        issue: 'infinite-loop',
        count: issueCounts['infinite-loop'],
        fix: 'Replace while(true) with bounded loop or add explicit break conditions'
      });
    }

    return recommendations;
  }
}

/**
 * CLI Interface for loop auditor
 * @description Parses command line arguments and runs the auditor
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Loop Engineering Audit Tool');
    console.log('Usage: node loop-audit.js <file-or-directory>');
    console.log('');
    console.log('Analyzes JavaScript/TypeScript files for loop patterns and safety practices.');
    console.log('');
    console.log('Checks for:');
    console.log('  - Missing iteration counters in while loops');
    console.log('  - Missing maximum iteration guards');
    console.log('  - Missing progress logging');
    console.log('  - Missing error handling');
    console.log('  - Potential infinite loops');
    console.log('  - Unbounded for loops');
    process.exit(1);
  }

  const targetPath = args[0];

  if (!fs.existsSync(targetPath)) {
    console.error(`Error: Path does not exist: ${targetPath}`);
    process.exit(1);
  }

  const auditor = new LoopAuditor();
  const report = auditor.auditPath(targetPath);

  // Output report
  console.log('\n=== Loop Engineering Audit Report ===\n');

  console.log('Summary:');
  console.log(`  Files analyzed: ${report.summary.filesAnalyzed}`);
  console.log(`  Loops found: ${report.summary.loopsFound}`);
  console.log(`  Safe loops: ${report.summary.safeLoops}`);
  console.log(`  Issues found: ${report.summary.issuesFound}`);
  console.log('');

  if (report.findings.length > 0) {
    console.log('Findings:\n');

    // Group by severity
    const bySeverity = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };

    for (const finding of report.findings) {
      bySeverity[finding.severity].push(finding);
    }

    for (const severity of ['critical', 'high', 'medium', 'low']) {
      if (bySeverity[severity].length > 0) {
        console.log(`${severity.toUpperCase()} (${bySeverity[severity].length}):`);
        for (const finding of bySeverity[severity]) {
          console.log(`  ${finding.file}:${finding.line} - [${finding.loopType}] ${finding.message}`);
        }
        console.log('');
      }
    }
  }

  if (report.recommendations.length > 0) {
    console.log('Recommendations:\n');
    for (const rec of report.recommendations) {
      console.log(`[${rec.priority.toUpperCase()}] ${rec.issue} (${rec.count} occurrences)`);
      console.log(`  Fix: ${rec.fix}`);
      console.log('');
    }
  }

  if (report.findings.length === 0) {
    console.log('No issues found. All loops follow best practices!\n');
  }

  // Exit with error code if critical issues found
  const hasCritical = report.findings.some(f => f.severity === 'critical');
  process.exit(hasCritical ? 2 : 0);
}

main();
