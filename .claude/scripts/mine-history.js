#!/usr/bin/env node

/**
 * @fileoverview Self-Improvement Orchestrator - Session History Miner
 * @module scripts/mine-history
 * @description Analyzes session logs to detect patterns, corrections, breakthroughs,
 * and synthesize strategies for continuous learning. Extracts learnings from past sessions
 * to improve future performance and avoid repeating mistakes.
 * @version 1.0.0
 * @author Mastery Node.js Project
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const CORRECTIONS_FILE = path.join(MEMORY_DIR, 'corrections.json');
const STRATEGIES_FILE = path.join(MEMORY_DIR, 'strategies.json');
const BREAKTHROUGHS_FILE = path.join(MEMORY_DIR, 'breakthroughs.json');
const SESSIONS_LOG = path.join(__dirname, '..', 'sessions.log');

/**
 * History Miner for analyzing session logs and extracting learnings
 * @class HistoryMiner
 * @description Parses session logs to identify corrections, synthesize strategies,
 * and detect breakthroughs for continuous improvement.
 *
 * @example
 * const miner = new HistoryMiner();
 * const report = miner.mine();
 * console.log(report.stats.correctionsFound);
 */
class HistoryMiner {
  /**
   * Creates a new HistoryMiner instance
   * @constructor
   */
  constructor() {
    /** @type {Object} Loaded corrections database */
    this.corrections = this.loadJSON(CORRECTIONS_FILE, { corrections: [] });
    /** @type {Object} Loaded strategies database */
    this.strategies = this.loadJSON(STRATEGIES_FILE, { strategies: [] });
    /** @type {Object} Loaded breakthroughs database */
    this.breakthroughs = this.loadJSON(BREAKTHROUGHS_FILE, { breakthroughs: [] });

    /**
     * Mining statistics
     * @type {Object}
     * @property {number} sessionsAnalyzed - Number of sessions processed
     * @property {number} correctionsFound - Number of corrections extracted
     * @property {number} strategiesSynthesized - Number of new strategies created
     * @property {number} breakthroughsDetected - Number of breakthroughs found
     * @property {Array<Object>} patternsDetected - Array of detected patterns
     */
    this.stats = {
      sessionsAnalyzed: 0,
      correctionsFound: 0,
      strategiesSynthesized: 0,
      breakthroughsDetected: 0,
      patternsDetected: []
    };
  }

  /**
   * Load JSON file with fallback to default value
   * @param {string} filePath - Path to JSON file
   * @param {any} defaultValue - Default value if file doesn't exist or is invalid
   * @returns {any} Parsed JSON or default value
   */
  loadJSON(filePath, defaultValue) {
    try {
      if (!fs.existsSync(filePath)) {
        return defaultValue;
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Could not load ${filePath}, using default`);
      return defaultValue;
    }
  }

  /**
   * Save data to JSON file, creating directory if needed
   * @param {string} filePath - Path to save file
   * @param {any} data - Data to save
   */
  saveJSON(filePath, data) {
    try {
      if (!fs.existsSync(MEMORY_DIR)) {
        fs.mkdirSync(MEMORY_DIR, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Error saving ${filePath}:`, error.message);
    }
  }

  /**
   * Main mining entry point - analyzes all sessions and generates report
   * @returns {Object} Mining report with statistics and recommendations
   */
  mine() {
    console.log('=== Self-Improvement Orchestrator - History Miner ===\n');

    if (!fs.existsSync(SESSIONS_LOG)) {
      console.log('No sessions.log found. Nothing to mine.');
      return this.generateReport();
    }

    const sessions = this.parseSessionsLog();
    this.stats.sessionsAnalyzed = sessions.length;

    console.log(`Found ${sessions.length} sessions to analyze\n`);

    for (const session of sessions) {
      this.analyzeSession(session);
    }

    // Post-analysis: synthesize strategies from correction clusters
    this.synthesizeStrategies();

    // Detect breakthroughs
    this.detectBreakthroughs(sessions);

    // Save updated knowledge bases
    this.saveJSON(CORRECTIONS_FILE, this.corrections);
    this.saveJSON(STRATEGIES_FILE, this.strategies);
    this.saveJSON(BREAKTHROUGHS_FILE, this.breakthroughs);

    return this.generateReport();
  }

  /**
   * Parse sessions.log into structured session objects
   * @returns {Array<Object>} Array of parsed session objects
   * @returns {string} returns[].id - Session identifier
   * @returns {string} returns[].startTime - Session start timestamp
   * @returns {Array<string>} returns[].entries - All log entries
   * @returns {Array<string>} returns[].corrections - Lines containing corrections
   * @returns {Array<string>} returns[].userFeedback - Lines with user feedback
   * @returns {Array<string>} returns[].solutionAttempts - Lines with solution attempts
   */
  parseSessionsLog() {
    const content = fs.readFileSync(SESSIONS_LOG, 'utf-8');
    const lines = content.split('\n');
    const sessions = [];
    let currentSession = null;

    for (const line of lines) {
      if (line.startsWith('=== Session:')) {
        if (currentSession) {
          sessions.push(currentSession);
        }
        currentSession = {
          id: line.match(/Session: (.+)/)?.[1] || 'unknown',
          startTime: line.match(/\[(.+)\]/)?.[1] || new Date().toISOString(),
          entries: [],
          corrections: [],
          userFeedback: [],
          solutionAttempts: []
        };
      } else if (currentSession && line.trim()) {
        currentSession.entries.push(line);

        // Detect corrections
        if (this.isCorrection(line)) {
          currentSession.corrections.push(line);
        }

        // Detect user feedback
        if (this.isUserFeedback(line)) {
          currentSession.userFeedback.push(line);
        }

        // Detect solution attempts (retry patterns)
        if (this.isSolutionAttempt(line)) {
          currentSession.solutionAttempts.push(line);
        }
      }
    }

    if (currentSession) {
      sessions.push(currentSession);
    }

    return sessions;
  }

  /**
   * Check if a line contains a correction
   * @param {string} line - Log line to check
   * @returns {boolean} True if line contains a correction
   * @description Detects corrections using regex patterns:
   *   - /don'?t use/i - "don't use X"
   *   - /avoid/i - "avoid X"
   *   - /should (be|use)/i - "should be X" or "should use X"
   *   - /prefer/i - "prefer X"
   *   - /wrong/i - "that's wrong"
   *   - /incorrect/i - "incorrect approach"
   *   - /no,? (use|do)/i - "no, use X" or "no do X"
   *   - /instead/i - "use X instead"
   *   - /not this/i - "not this, use Y"
   *   - /try using/i - "try using X"
   */
  isCorrection(line) {
    const correctionPatterns = [
      /don'?t use/i,
      /avoid/i,
      /should (be|use)/i,
      /prefer/i,
      /wrong/i,
      /incorrect/i,
      /no,? (use|do)/i,
      /instead/i,
      /not this/i,
      /try using/i
    ];
    return correctionPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if a line contains user feedback
   * @param {string} line - Log line to check
   * @returns {boolean} True if line contains user feedback
   * @description Detects feedback using regex patterns:
   *   - /user:/i - "User: ..."
   *   - /thanks/i - "thanks"
   *   - /perfect/i - "perfect"
   *   - /great/i - "great"
   *   - /awesome/i - "awesome"
   *   - /wrong/i - "wrong"
   *   - /no,?/i - "no" or "no,"
   *   - /yes,?/i - "yes" or "yes,"
   */
  isUserFeedback(line) {
    const feedbackPatterns = [
      /user:/i,
      /thanks/i,
      /perfect/i,
      /great/i,
      /awesome/i,
      /wrong/i,
      /no,?/i,
      /yes,?/i
    ];
    return feedbackPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Check if a line indicates a solution attempt
   * @param {string} line - Log line to check
   * @returns {boolean} True if line indicates a solution attempt
   * @description Detects solution attempts using regex patterns:
   *   - /let'?s try/i - "let's try X"
   *   - /attempt/i - "attempt"
   *   - /trying/i - "trying"
   *   - /approach/i - "approach"
   *   - /solution/i - "solution"
   *   - /fix/i - "fix"
   *   - /implement/i - "implement"
   */
  isSolutionAttempt(line) {
    const attemptPatterns = [
      /let'?s try/i,
      /attempt/i,
      /trying/i,
      /approach/i,
      /solution/i,
      /fix/i,
      /implement/i
    ];
    return attemptPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Analyze a single session for learnings
   * @param {Object} session - Session object from parseSessionsLog
   */
  analyzeSession(session) {
    // Extract and log corrections
    for (const correctionLine of session.corrections) {
      this.extractCorrection(session, correctionLine);
    }

    // Analyze solution patterns
    if (session.solutionAttempts.length > 3) {
      this.stats.patternsDetected.push({
        type: 'multiple-attempts',
        sessionId: session.id,
        count: session.solutionAttempts.length,
        note: 'Session required multiple solution attempts'
      });
    }
  }

  /**
   * Extract correction details from a line
   * @param {Object} session - Session containing the correction
   * @param {string} line - Correction line text
   */
  extractCorrection(session, line) {
    this.stats.correctionsFound++;

    // Parse correction structure
    const correction = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      context: this.extractContext(session),
      wrong: this.extractWrongApproach(line),
      right: this.extractRightApproach(line),
      category: this.categorizeCorrection(line),
      frequency: 1,
      lastSeen: new Date().toISOString(),
      patterns: [],
      sessionRef: session.id
    };

    // Check if similar correction exists
    const existing = this.findSimilarCorrection(correction);
    if (existing) {
      existing.frequency++;
      existing.lastSeen = correction.lastSeen;
      if (!existing.patterns.includes(correction.category)) {
        existing.patterns.push(correction.category);
      }
    } else {
      this.corrections.corrections.push(correction);
    }
  }

  /**
   * Extract context from session (first 200 chars of first 5 entries)
   * @param {Object} session - Session object
   * @returns {string} Context string
   */
  extractContext(session) {
    // Use first few entries as context
    const contextEntries = session.entries.slice(0, 5).join(' ');
    return contextEntries.substring(0, 200);
  }

  /**
   * Extract what was wrong from correction line
   * @param {string} line - Correction line
   * @returns {string} Wrong approach description
   * @description Uses regex patterns to extract the wrong approach:
   *   - /don'?t use (.+?)(?:,|\.|$)/i - captures text after "don't use"
   *   - /avoid (.+?)(?:,|\.|$)/i - captures text after "avoid"
   *   - /not (.+?)(?:,|\.|$)/i - captures text after "not"
   */
  extractWrongApproach(line) {
    const patterns = [
      /don'?t use (.+?)(?:,|\.|$)/i,
      /avoid (.+?)(?:,|\.|$)/i,
      /not (.+?)(?:,|\.|$)/i
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) return match[1].trim();
    }

    return line.substring(0, 100);
  }

  /**
   * Extract what was right from correction line
   * @param {string} line - Correction line
   * @returns {string} Right approach description
   * @description Uses regex patterns to extract the correct approach:
   *   - /(?:use|prefer|try) (.+?)(?:,|\.|$)/i - captures text after "use/prefer/try"
   *   - /instead (?:of|use) (.+?)(?:,|\.|$)/i - captures text after "instead of/use"
   *   - /should (?:be|use) (.+?)(?:,|\.|$)/i - captures text after "should be/use"
   */
  extractRightApproach(line) {
    const patterns = [
      /(?:use|prefer|try) (.+?)(?:,|\.|$)/i,
      /instead (?:of|use) (.+?)(?:,|\.|$)/i,
      /should (?:be|use) (.+?)(?:,|\.|$)/i
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) return match[1].trim();
    }

    return line.substring(0, 100);
  }

  /**
   * Categorize correction by type using keyword matching
   * @param {string} line - Correction line
   * @returns {string} Category name
   * @description Categorizes corrections into:
   *   - 'react-patterns' - React hooks and patterns
   *   - 'api-design' - API and endpoint design
   *   - 'database' - Database queries and operations
   *   - 'architecture' - System architecture
   *   - 'error-handling' - Error handling patterns
   *   - 'performance' - Performance optimization
   *   - 'style' - Code style and formatting
   *   - 'logic' - Logic and control flow
   *   - 'general' - Default category
   */
  categorizeCorrection(line) {
    const categories = {
      'react-patterns': /useEffect|useState|useMemo|useCallback|React/i,
      'api-design': /api|endpoint|route|REST|GraphQL/i,
      'database': /query|SQL|database|table|index/i,
      'architecture': /architecture|structure|pattern|design/i,
      'error-handling': /error|exception|catch|try/i,
      'performance': /performance|slow|optimize|speed/i,
      'style': /style|format|lint|convention/i,
      'logic': /logic|condition|if|else|loop/i
    };

    for (const [category, pattern] of Object.entries(categories)) {
      if (pattern.test(line)) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Find similar correction in existing corrections using Jaccard similarity
   * @param {Object} correction - Correction to find
   * @returns {Object|undefined} Similar correction or undefined
   */
  findSimilarCorrection(correction) {
    return this.corrections.corrections.find(c =>
      c.category === correction.category &&
      this.similarity(c.wrong, correction.wrong) > 0.6
    );
  }

  /**
   * Calculate string similarity using Jaccard index
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score between 0 and 1
   * @description Jaccard index = |intersection| / |union| of word sets
   */
  similarity(str1, str2) {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  /**
   * Synthesize strategies from correction clusters (3+ corrections in same category)
   */
  synthesizeStrategies() {
    const categoryCounts = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Count corrections by category in last 30 days
    for (const correction of this.corrections.corrections) {
      const lastSeen = new Date(correction.lastSeen);
      if (lastSeen >= thirtyDaysAgo) {
        categoryCounts[correction.category] = (categoryCounts[correction.category] || 0) + 1;
      }
    }

    // Synthesize strategy for categories with 3+ corrections
    for (const [category, count] of Object.entries(categoryCounts)) {
      if (count >= 3) {
        const existingStrategy = this.strategies.strategies.find(s =>
          s.name.toLowerCase().includes(category)
        );

        if (!existingStrategy) {
          const strategy = this.createStrategy(category, count);
          this.strategies.strategies.push(strategy);
          this.stats.strategiesSynthesized++;
        }
      }
    }
  }

  /**
   * Create a strategy from correction patterns
   * @param {string} category - Strategy category
   * @param {number} correctionCount - Number of corrections in category
   * @returns {Object} Strategy object
   */
  createStrategy(category, correctionCount) {
    const categoryCorrections = this.corrections.corrections.filter(
      c => c.category === category
    );

    const commonPatterns = categoryCorrections.map(c => c.right);
    const antiPatterns = categoryCorrections.map(c => c.wrong);

    return {
      id: this.generateId(),
      name: `${category} Strategy`,
      description: `Synthesized from ${correctionCount} corrections in ${category}`,
      context: `When working on ${category} tasks`,
      source: 'synthesized',
      confidence: correctionCount >= 5 ? 'high' : 'medium',
      applications: 0,
      successes: 0,
      created: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      examples: commonPatterns.slice(0, 3),
      antiPatterns: antiPatterns.slice(0, 3)
    };
  }

  /**
   * Detect breakthroughs in sessions (score >= 7)
   * @param {Array<Object>} sessions - Array of session objects
   */
  detectBreakthroughs(sessions) {
    for (const session of sessions) {
      const score = this.calculateBreakthroughScore(session);

      if (score >= 7) {
        const breakthrough = this.extractBreakthrough(session, score);
        this.breakthroughs.breakthroughs.push(breakthrough);
        this.stats.breakthroughsDetected++;
      }
    }
  }

  /**
   * Calculate breakthrough score for a session
   * @param {Object} session - Session object
   * @returns {number} Breakthrough score (0-10)
   * @description Scoring:
   *   - Multiple iterations (>3 attempts): +2
   *   - Significant refactoring (>50 entries): +2
   *   - Positive user reaction: +1
   *   - Corrections led to better solution: +2
   */
  calculateBreakthroughScore(session) {
    let score = 0;

    // Multiple iterations
    if (session.solutionAttempts.length > 3) {
      score += 2;
    }

    // Significant refactoring (many entries)
    if (session.entries.length > 50) {
      score += 2;
    }

    // Positive user reaction
    const positiveFeedback = session.userFeedback.filter(
      f => /thanks|perfect|great|awesome/i.test(f)
    ).length;
    if (positiveFeedback > 0) {
      score += 1;
    }

    // Corrections led to better solution
    if (session.corrections.length > 0 && session.solutionAttempts.length > 2) {
      score += 2;
    }

    return score;
  }

  /**
   * Extract breakthrough details from session
   * @param {Object} session - Session object
   * @param {number} score - Breakthrough score
   * @returns {Object} Breakthrough object
   */
  extractBreakthrough(session, score) {
    return {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      problem: this.extractContext(session),
      initialApproach: session.solutionAttempts[0] || 'Unknown',
      breakthrough: session.corrections[0] || 'Iterative refinement',
      finalSolution: session.solutionAttempts[session.solutionAttempts.length - 1] || 'Unknown',
      whyItWorked: 'Addressed multiple concerns through iteration',
      applicability: 'Similar complex problems',
      novelty: score >= 9 ? 'high' : 'medium',
      impact: score >= 9 ? 'high' : 'medium',
      sessionRef: session.id,
      tags: [this.categorizeCorrection(session.entries.join(' '))]
    };
  }

  /**
   * Generate unique ID
   * @returns {string} Unique ID in format '{timestamp}-{random}'
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate final mining report
   * @returns {Object} Report with statistics and recommendations
   */
  generateReport() {
    const report = {
      stats: this.stats,
      knowledgeBaseSummary: {
        totalCorrections: this.corrections.corrections.length,
        highFrequencyCorrections: this.corrections.corrections.filter(c => c.frequency > 3).length,
        totalStrategies: this.strategies.strategies.length,
        provenStrategies: this.strategies.strategies.filter(s => s.confidence === 'high').length,
        totalBreakthroughs: this.breakthroughs.breakthroughs.length,
        highImpactBreakthroughs: this.breakthroughs.breakthroughs.filter(b => b.impact === 'high').length
      },
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Generate recommendations based on analysis
   * @returns {Array<Object>} Array of recommendation objects
   */
  generateRecommendations() {
    const recommendations = [];

    // Recommend reviewing high-frequency corrections
    const highFreq = this.corrections.corrections.filter(c => c.frequency > 5);
    if (highFreq.length > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Review high-frequency corrections',
        details: `${highFreq.length} corrections have frequency > 5. Consider creating explicit strategies.`
      });
    }

    // Recommend applying proven strategies
    const provenStrategies = this.strategies.strategies.filter(s => s.confidence === 'high');
    if (provenStrategies.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Apply proven strategies',
        details: `${provenStrategies.length} high-confidence strategies available for use.`
      });
    }

    // Recommend reviewing breakthroughs
    if (this.breakthroughs.breakthroughs.length > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Review breakthroughs',
        details: `${this.breakthroughs.breakthroughs.length} breakthroughs documented. Extract reusable principles.`
      });
    }

    // Recommend maintenance
    const oldCorrections = this.corrections.corrections.filter(c => {
      const lastSeen = new Date(c.lastSeen);
      const daysSince = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 90 && c.frequency === 1;
    });

    if (oldCorrections.length > 10) {
      recommendations.push({
        priority: 'low',
        action: 'Archive old corrections',
        details: `${oldCorrections.length} corrections are > 90 days old with frequency 1. Consider archiving.`
      });
    }

    return recommendations;
  }
}

/**
 * CLI Interface for history miner
 * @description Parses command line arguments and runs the miner
 */
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Self-Improvement Orchestrator - History Miner');
    console.log('');
    console.log('Usage: node mine-history.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h     Show this help message');
    console.log('  --json         Output report as JSON');
    console.log('  --verbose      Show detailed analysis');
    console.log('');
    console.log('Analyzes session history to:');
    console.log('  - Extract corrections from user feedback');
    console.log('  - Detect patterns in mistakes and solutions');
    console.log('  - Synthesize strategies from correction clusters');
    console.log('  - Identify breakthrough discoveries');
    console.log('  - Update knowledge bases for future sessions');
    process.exit(0);
  }

  const miner = new HistoryMiner();
  const report = miner.mine();

  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n=== Mining Report ===\n');
    console.log('Statistics:');
    console.log(`  Sessions analyzed: ${report.stats.sessionsAnalyzed}`);
    console.log(`  Corrections found: ${report.stats.correctionsFound}`);
    console.log(`  Strategies synthesized: ${report.stats.strategiesSynthesized}`);
    console.log(`  Breakthroughs detected: ${report.stats.breakthroughsDetected}`);
    console.log('');

    console.log('Knowledge Base Summary:');
    console.log(`  Total corrections: ${report.knowledgeBaseSummary.totalCorrections}`);
    console.log(`  High-frequency corrections (>3): ${report.knowledgeBaseSummary.highFrequencyCorrections}`);
    console.log(`  Total strategies: ${report.knowledgeBaseSummary.totalStrategies}`);
    console.log(`  Proven strategies (high confidence): ${report.knowledgeBaseSummary.provenStrategies}`);
    console.log(`  Total breakthroughs: ${report.knowledgeBaseSummary.totalBreakthroughs}`);
    console.log(`  High-impact breakthroughs: ${report.knowledgeBaseSummary.highImpactBreakthroughs}`);
    console.log('');

    if (report.recommendations.length > 0) {
      console.log('Recommendations:');
      for (const rec of report.recommendations) {
        console.log(`  [${rec.priority.toUpperCase()}] ${rec.action}`);
        console.log(`    ${rec.details}`);
      }
      console.log('');
    }

    if (report.stats.patternsDetected.length > 0) {
      console.log('Patterns Detected:');
      for (const pattern of report.stats.patternsDetected) {
        console.log(`  - ${pattern.type}: ${pattern.note} (${pattern.count} occurrences)`);
      }
    }
  }
}

main();
