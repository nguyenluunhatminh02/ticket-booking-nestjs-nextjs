#!/usr/bin/env node

/**
 * @fileoverview Continuous Improvement Workflow - Anti-AI Slop Protection
 * @module workflows/continuous-improvement
 * @description Collects feedback, identifies patterns, and updates prompts/skills.
 * Tracks quality metrics over time and suggests improvements. Provides four main actions:
 * collect (record feedback), analyze (identify patterns), update-skills (suggest skill updates),
 * and report (generate quality report).
 *
 * Usage: node continuous-improvement.js [--collect <feedback>] [--analyze] [--update-skills] [--report]
 * @version 1.0.0
 * @author Mastery Node.js Project
 */

const fs = require('fs');
const path = require('path');

/**
 * Continuous Improvement Workflow for tracking and improving content quality
 * @class ContinuousImprovementWorkflow
 * @description Manages feedback collection, pattern analysis, skill updates,
 * and quality reporting for anti-AI slop protection.
 *
 * @example
 * const workflow = new ContinuousImprovementWorkflow({ action: 'report' });
 * const result = await workflow.run('report');
 * console.log(result.data.summary);
 */
class ContinuousImprovementWorkflow {
  /**
   * Creates a new ContinuousImprovementWorkflow instance
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.dataDir] - Directory for quality metrics data
   * @param {string} [options.skillsDir] - Directory for skills
   * @param {string} [options.action='report'] - Default action to run
   */
  constructor(options = {}) {
    /** @type {string} Directory for storing quality metrics */
    this.dataDir = options.dataDir || path.join(__dirname, '..', 'data', 'quality-metrics');
    /** @type {string} Directory containing skills */
    this.skillsDir = options.skillsDir || path.join(__dirname, '..', 'skills');
    this.ensureDataDir();

    /**
     * Results object for storing workflow output
     * @type {Object}
     * @property {string} timestamp - ISO timestamp of execution
     * @property {string} action - Action that was run
     * @property {any} data - Result data
     */
    this.results = {
      timestamp: new Date().toISOString(),
      action: options.action || 'report',
      data: null
    };
  }

  /**
   * Ensure the data directory exists, creating it if necessary
   */
  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Run the specified action with optional payload
   * @param {string} action - Action to run: 'collect', 'analyze', 'update-skills', or 'report'
   * @param {Object|null} [payload=null] - Payload data for the action
   * @returns {Promise<Object>} Workflow results
   */
  async run(action, payload = null) {
    console.log('=== Continuous Improvement Workflow ===');
    console.log(`Action: ${action}\n`);

    switch (action) {
      case 'collect':
        return this.collectFeedback(payload);
      case 'analyze':
        return this.analyzePatterns();
      case 'update-skills':
        return this.updateSkills();
      case 'report':
        return this.generateReport();
      default:
        return this.fail(`Unknown action: ${action}`);
    }
  }

  /**
   * Collect feedback and update metrics
   * @param {Object} feedback - Feedback data
   * @param {string} [feedback.content] - Feedback content
   * @param {number} [feedback.score=0] - Quality score (0-100)
   * @param {Array} [feedback.issues=[]] - Issues found
   * @param {string} [feedback.timestamp] - ISO timestamp
   * @param {string} [feedback.source='manual'] - Feedback source
   * @param {Object} [feedback.metadata={}] - Additional metadata
   * @returns {Promise<Object>} Workflow results with collected feedback
   */
  async collectFeedback(feedback) {
    if (!feedback || typeof feedback !== 'object') {
      return this.fail('Feedback must be an object with: content, score, issues, timestamp');
    }

    const feedbackEntry = {
      id: `feedback_${Date.now()}`,
      timestamp: feedback.timestamp || new Date().toISOString(),
      content: feedback.content || null,
      score: feedback.score || 0,
      issues: feedback.issues || [],
      source: feedback.source || 'manual',
      metadata: feedback.metadata || {}
    };

    // Save to feedback log
    const feedbackFile = path.join(this.dataDir, 'feedback-log.json');
    let feedbackLog = [];

    if (fs.existsSync(feedbackFile)) {
      try {
        feedbackLog = JSON.parse(fs.readFileSync(feedbackFile, 'utf-8'));
      } catch (err) {
        feedbackLog = [];
      }
    }

    feedbackLog.push(feedbackEntry);
    fs.writeFileSync(feedbackFile, JSON.stringify(feedbackLog, null, 2), 'utf-8');

    // Update metrics
    await this.updateMetrics(feedbackEntry);

    console.log(`Feedback collected: ${feedbackEntry.id}`);
    console.log(`Score: ${feedbackEntry.score}/100`);
    console.log(`Issues: ${feedbackEntry.issues.length}`);

    this.results.data = feedbackEntry;
    return this.results;
  }

  /**
   * Update metrics with new feedback data
   * @param {Object} feedback - Feedback entry to incorporate
   * @description Updates totalFeedback count, score history (last 100),
   *   average score (last 20), and issue frequency counts
   */
  async updateMetrics(feedback) {
    const metricsFile = path.join(this.dataDir, 'metrics.json');
    let metrics = {
      totalFeedback: 0,
      averageScore: 0,
      scoreHistory: [],
      issueFrequency: {},
      lastUpdated: new Date().toISOString()
    };

    if (fs.existsSync(metricsFile)) {
      try {
        metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf-8'));
      } catch (err) {
        // Use default
      }
    }

    metrics.totalFeedback++;
    metrics.scoreHistory.push({
      timestamp: feedback.timestamp,
      score: feedback.score
    });

    // Keep only last 100 scores
    if (metrics.scoreHistory.length > 100) {
      metrics.scoreHistory = metrics.scoreHistory.slice(-100);
    }

    // Calculate average
    const recentScores = metrics.scoreHistory.slice(-20);
    metrics.averageScore = Math.round(
      recentScores.reduce((sum, s) => sum + s.score, 0) / recentScores.length
    );

    // Update issue frequency
    for (const issue of feedback.issues) {
      const issueType = issue.type || issue.category || 'unknown';
      metrics.issueFrequency[issueType] = (metrics.issueFrequency[issueType] || 0) + 1;
    }

    metrics.lastUpdated = new Date().toISOString();
    fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2), 'utf-8');
  }

  /**
   * Analyze patterns in collected feedback
   * @returns {Promise<Object>} Analysis results with trends, patterns, and recommendations
   * @description Analyzes score trends (comparing recent vs older averages),
   *   identifies top issues by frequency, and generates recommendations
   */
  async analyzePatterns() {
    const metricsFile = path.join(this.dataDir, 'metrics.json');

    if (!fs.existsSync(metricsFile)) {
      return this.fail('No metrics data available. Collect feedback first.');
    }

    const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf-8'));
    const analysis = {
      timestamp: new Date().toISOString(),
      trends: {},
      patterns: [],
      recommendations: []
    };

    // Analyze score trends
    if (metrics.scoreHistory.length >= 5) {
      const recent = metrics.scoreHistory.slice(-10);
      const older = metrics.scoreHistory.slice(-20, -10);

      const recentAvg = recent.reduce((sum, s) => sum + s.score, 0) / recent.length;
      const olderAvg = older.length > 0
        ? older.reduce((sum, s) => sum + s.score, 0) / older.length
        : recentAvg;

      const trend = recentAvg - olderAvg;
      analysis.trends = {
        direction: trend > 2 ? 'improving' : trend < -2 ? 'declining' : 'stable',
        change: Math.round(trend),
        recentAverage: Math.round(recentAvg),
        olderAverage: Math.round(olderAvg)
      };
    }

    // Identify top issues
    const sortedIssues = Object.entries(metrics.issueFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    analysis.patterns = sortedIssues.map(([issue, count]) => ({
      issue,
      frequency: count,
      percentage: Math.round((count / metrics.totalFeedback) * 100)
    }));

    // Generate recommendations
    if (analysis.trends.direction === 'declining') {
      analysis.recommendations.push({
        priority: 'high',
        action: 'Review recent content generation prompts',
        reason: 'Quality scores are declining'
      });
    }

    if (sortedIssues.length > 0 && sortedIssues[0][1] > metrics.totalFeedback * 0.3) {
      analysis.recommendations.push({
        priority: 'high',
        action: `Address top issue: ${sortedIssues[0][0]}`,
        reason: `${sortedIssues[0][1]} occurrences (${sortedIssues[0][1] > 1 ? 'most' : ''} frequent issue)`
      });
    }

    if (metrics.averageScore < 70) {
      analysis.recommendations.push({
        priority: 'critical',
        action: 'Major quality improvement needed',
        reason: `Average score is ${metrics.averageScore}/100 (below 70 threshold)`
      });
    }

    console.log('=== Pattern Analysis ===');
    console.log(`Total Feedback: ${metrics.totalFeedback}`);
    console.log(`Average Score: ${metrics.averageScore}/100`);

    if (analysis.trends.direction) {
      console.log(`\nTrend: ${analysis.trends.direction} (${analysis.trends.change > 0 ? '+' : ''}${analysis.trends.change})`);
    }

    if (analysis.patterns.length > 0) {
      console.log('\nTop Issues:');
      for (const pattern of analysis.patterns) {
        console.log(`  - ${pattern.issue}: ${pattern.frequency} occurrences (${pattern.percentage}%)`);
      }
    }

    if (analysis.recommendations.length > 0) {
      console.log('\nRecommendations:');
      for (const rec of analysis.recommendations) {
        console.log(`  [${rec.priority.toUpperCase()}] ${rec.action}`);
        console.log(`    Reason: ${rec.reason}`);
      }
    }

    this.results.data = analysis;
    return this.results;
  }

  /**
   * Suggest skill updates based on issue frequency
   * @returns {Promise<Object>} Update suggestions for skills
   * @description Maps frequent issues to relevant skills and generates
   *   update suggestions with priority based on frequency percentage
   */
  async updateSkills() {
    const metricsFile = path.join(this.dataDir, 'metrics.json');

    if (!fs.existsSync(metricsFile)) {
      return this.fail('No metrics data available. Collect feedback first.');
    }

    const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf-8'));
    const updates = [];

    // Identify skills that need updates based on issue frequency
    const topIssues = Object.entries(metrics.issueFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [issue, count] of topIssues) {
      if (count < 3) continue; // Only update for frequent issues

      const suggestion = this.generateSkillUpdateSuggestion(issue, count, metrics.totalFeedback);
      if (suggestion) {
        updates.push(suggestion);
      }
    }

    console.log('=== Skill Update Suggestions ===');

    if (updates.length === 0) {
      console.log('No skill updates needed at this time.');
    } else {
      console.log(`Suggested updates: ${updates.length}\n`);
      for (const update of updates) {
        console.log(`Skill: ${update.skill}`);
        console.log(`Issue: ${update.issue}`);
        console.log(`Suggestion: ${update.suggestion}`);
        console.log(`Priority: ${update.priority}\n`);
      }
    }

    this.results.data = { updates };
    return this.results;
  }

  /**
   * Generate a skill update suggestion for a specific issue
   * @param {string} issue - Issue type identifier
   * @param {number} count - Number of occurrences
   * @param {number} total - Total feedback count
   * @returns {Object|null} Suggestion object or null if no mapping exists
   * @returns {string} returns.skill - Skill name to update
   * @returns {string} returns.issue - Issue type
   * @returns {number} returns.frequency - Frequency percentage
   * @returns {string} returns.suggestion - Update suggestion text
   * @returns {string} returns.priority - Priority level (high/medium/low)
   */
  generateSkillUpdateSuggestion(issue, count, total) {
    const frequency = (count / total) * 100;
    const priority = frequency > 30 ? 'high' : frequency > 15 ? 'medium' : 'low';

    const skillMapping = {
      'filler_phrase': {
        skill: 'anti-slop-validator',
        suggestion: 'Add more filler phrases to detection list. Consider auto-removal for common patterns.'
      },
      'unsupported_claim': {
        skill: 'hallucination-detector',
        suggestion: 'Strengthen claim verification. Add mandatory source checking for statistical claims.'
      },
      'vague_language': {
        skill: 'specificity-enforcer',
        suggestion: 'Expand vague language patterns. Add more concrete replacement examples.'
      },
      'generic_content': {
        skill: 'specificity-enforcer',
        suggestion: 'Improve context-specific example generation. Add industry-specific templates.'
      },
      'hallucination': {
        skill: 'hallucination-detector',
        suggestion: 'Enhance fact-checking against project context. Add cross-reference validation.'
      }
    };

    const mapping = skillMapping[issue];
    if (!mapping) return null;

    return {
      skill: mapping.skill,
      issue,
      frequency: Math.round(frequency),
      suggestion: mapping.suggestion,
      priority
    };
  }

  /**
   * Generate comprehensive quality report
   * @returns {Promise<Object>} Report with summary, trends, top issues, and recommendations
   */
  async generateReport() {
    const metricsFile = path.join(this.dataDir, 'metrics.json');
    const feedbackFile = path.join(this.dataDir, 'feedback-log.json');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {},
      trends: null,
      topIssues: [],
      recommendations: []
    };

    // Load metrics
    if (fs.existsSync(metricsFile)) {
      const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf-8'));
      report.summary = {
        totalFeedback: metrics.totalFeedback,
        averageScore: metrics.averageScore,
        lastUpdated: metrics.lastUpdated
      };

      // Analyze trends
      if (metrics.scoreHistory.length >= 5) {
        const recent = metrics.scoreHistory.slice(-10);
        const older = metrics.scoreHistory.slice(-20, -10);

        const recentAvg = recent.reduce((sum, s) => sum + s.score, 0) / recent.length;
        const olderAvg = older.length > 0
          ? older.reduce((sum, s) => sum + s.score, 0) / older.length
          : recentAvg;

        const trend = recentAvg - olderAvg;
        report.trends = {
          direction: trend > 2 ? 'improving' : trend < -2 ? 'declining' : 'stable',
          change: Math.round(trend)
        };
      }

      // Top issues
      const sortedIssues = Object.entries(metrics.issueFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      report.topIssues = sortedIssues.map(([issue, count]) => ({
        issue,
        count,
        percentage: Math.round((count / metrics.totalFeedback) * 100)
      }));
    }

    // Generate recommendations
    if (report.summary.averageScore && report.summary.averageScore < 70) {
      report.recommendations.push({
        priority: 'critical',
        action: 'Major quality improvement needed',
        reason: `Average score is ${report.summary.averageScore}/100`
      });
    }

    if (report.trends && report.trends.direction === 'declining') {
      report.recommendations.push({
        priority: 'high',
        action: 'Review content generation process',
        reason: 'Quality scores are declining'
      });
    }

    if (report.topIssues.length > 0 && report.topIssues[0].percentage > 30) {
      report.recommendations.push({
        priority: 'high',
        action: `Address top issue: ${report.topIssues[0].issue}`,
        reason: `${report.topIssues[0].percentage}% of feedback mentions this issue`
      });
    }

    console.log('=== Continuous Improvement Report ===');
    console.log(`Generated: ${report.timestamp}\n`);

    console.log('Summary:');
    console.log(`  Total Feedback: ${report.summary.totalFeedback || 0}`);
    console.log(`  Average Score: ${report.summary.averageScore || 'N/A'}/100`);

    if (report.trends) {
      console.log(`\nTrend: ${report.trends.direction} (${report.trends.change > 0 ? '+' : ''}${report.trends.change})`);
    }

    if (report.topIssues.length > 0) {
      console.log('\nTop Issues:');
      for (const issue of report.topIssues) {
        console.log(`  - ${issue.issue}: ${issue.count} occurrences (${issue.percentage}%)`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log('\nRecommendations:');
      for (const rec of report.recommendations) {
        console.log(`  [${rec.priority.toUpperCase()}] ${rec.action}`);
      }
    }

    this.results.data = report;
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

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node continuous-improvement.js [--collect <json>] [--analyze] [--update-skills] [--report]');
    process.exit(1);
  }

  const action = args[0].replace('--', '');
  let payload = null;

  if (action === 'collect' && args[1]) {
    try {
      payload = JSON.parse(args[1]);
    } catch (err) {
      console.error('Invalid JSON payload');
      process.exit(1);
    }
  }

  const workflow = new ContinuousImprovementWorkflow({ action });
  workflow.run(action, payload).then(results => {
    process.exit(0);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(2);
  });
}

module.exports = ContinuousImprovementWorkflow;
