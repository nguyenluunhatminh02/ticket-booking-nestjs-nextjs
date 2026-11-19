#!/usr/bin/env node

/**
 * @fileoverview Auto-Orchestrate Workflow - Intelligent task complexity analysis and multi-agent orchestration
 * @module workflows/auto-orchestrate
 * @description Automatically detects complex tasks and orchestrates multi-agent execution.
 * Analyzes task descriptions for complexity indicators (file count, keywords, architectural changes),
 * determines required agent roles, creates execution plans with parallelization opportunities,
 * and logs orchestration decisions for audit trails.
 * @version 1.0.0
 * @author Mastery Node.js Project
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Auto-Orchestrator for intelligent task analysis and multi-agent coordination
 * @class AutoOrchestrator
 * @description Analyzes task complexity, determines required agents, and creates execution plans
 * for multi-agent workflows. Automatically detects when orchestration is needed based on
 * complexity thresholds and keyword patterns.
 *
 * @example
 * const orchestrator = new AutoOrchestrator();
 * const result = await orchestrator.execute('Implement user authentication with OAuth2');
 * console.log(result.status); // 'orchestrate' or 'skip'
 */
class AutoOrchestrator {
  /**
   * Creates a new AutoOrchestrator instance
   * @constructor
   */
  constructor() {
    /**
     * Complexity thresholds for determining orchestration need
     * @type {Object}
     * @property {number} fileCount - Minimum files to trigger orchestration
     * @property {Array<string>} keywordComplexity - Keywords indicating complex tasks
     * @property {Array<string>} architecturalChanges - Keywords indicating architectural changes
     */
    this.complexityThresholds = {
      fileCount: 3,
      keywordComplexity: ['implement', 'create', 'build', 'develop', 'fix', 'optimize', 'refactor'],
      architecturalChanges: ['database', 'api', 'service', 'microservice', 'schema']
    };

    /**
     * Agent role specializations and their keyword indicators
     * @type {Object<string, Array<string>>}
     * @property {Array<string>} frontend - Frontend/UI keywords
     * @property {Array<string>} backend - Backend/API keywords
     * @property {Array<string>} database - Database keywords
     * @property {Array<string>} testing - Testing/QA keywords
     * @property {Array<string>} docs - Documentation keywords
     */
    this.agentRoles = {
      frontend: ['ui', 'frontend', 'component', 'page', 'view', 'react', 'vue'],
      backend: ['api', 'backend', 'server', 'endpoint', 'controller', 'service'],
      database: ['database', 'schema', 'migration', 'query', 'model', 'table'],
      testing: ['test', 'testing', 'qa', 'quality', 'coverage', 'validation'],
      docs: ['documentation', 'docs', 'readme', 'guide', 'manual']
    };
  }

  /**
   * Analyze task complexity and determine if orchestration is needed
   * @param {string} task - Task description to analyze
   * @returns {Object} Complexity analysis result
   * @returns {number} returns.score - Complexity score (0-100+)
   * @returns {Array<string>} returns.reasons - Reasons for complexity assessment
   * @returns {boolean} returns.shouldOrchestrate - True if orchestration needed (score >= 50)
   * @description Scoring:
   *   - Multiple files (>=3): +30 points
   *   - Each complex keyword: +15 points
   *   - Each architectural change: +20 points
   *   - Quality requirements: +15 points
   *   - Documentation requirements: +10 points
   */
  analyzeComplexity(task) {
    const analysis = {
      score: 0,
      reasons: [],
      shouldOrchestrate: false
    };

    const taskLower = task.toLowerCase();

    // Check file count indicators
    const fileMatches = task.match(/\d+\s*files?/i);
    if (fileMatches) {
      const fileCount = parseInt(fileMatches[0]);
      if (fileCount >= this.complexityThresholds.fileCount) {
        analysis.score += 30;
        analysis.reasons.push(`Multiple files (${fileCount})`);
      }
    }

    // Check complexity keywords
    const keywordMatches = this.complexityThresholds.keywordComplexity.filter(keyword =>
      taskLower.includes(keyword)
    );
    if (keywordMatches.length > 0) {
      analysis.score += keywordMatches.length * 15;
      analysis.reasons.push(`Complex keywords: ${keywordMatches.join(', ')}`);
    }

    // Check architectural changes
    const archMatches = this.complexityThresholds.architecturalChanges.filter(keyword =>
      taskLower.includes(keyword)
    );
    if (archMatches.length > 0) {
      analysis.score += archMatches.length * 20;
      analysis.reasons.push(`Architectural changes: ${archMatches.join(', ')}`);
    }

    // Check for quality requirements
    if (taskLower.includes('test') || taskLower.includes('quality')) {
      analysis.score += 15;
      analysis.reasons.push('Quality requirements mentioned');
    }

    if (taskLower.includes('document')) {
      analysis.score += 10;
      analysis.reasons.push('Documentation requirements');
    }

    analysis.shouldOrchestrate = analysis.score >= 50;

    return analysis;
  }

  /**
   * Determine required agents based on task keywords
   * @param {string} task - Task description
   * @returns {Array<Object>} Array of agent objects sorted by confidence
   * @returns {string} returns[].role - Agent role name
   * @returns {number} returns[].confidence - Confidence score (0-1)
   * @returns {Array<string>} returns[].keywords - Matched keywords
   * @description Always includes tester and reviewer for complex tasks
   */
  determineAgents(task) {
    const taskLower = task.toLowerCase();
    const agents = [];

    for (const [role, keywords] of Object.entries(this.agentRoles)) {
      const matches = keywords.filter(keyword => taskLower.includes(keyword));
      if (matches.length > 0) {
        agents.push({
          role: role,
          confidence: matches.length / keywords.length,
          keywords: matches
        });
      }
    }

    // Always include quality agents for complex tasks
    if (agents.length > 0) {
      agents.push({ role: 'tester', confidence: 1.0, keywords: ['quality'] });
      agents.push({ role: 'reviewer', confidence: 1.0, keywords: ['review'] });
    }

    return agents.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Create execution plan with phases and parallelization
   * @param {string} task - Task description
   * @param {Array<Object>} agents - Required agents
   * @returns {Object} Execution plan
   * @returns {string} returns.task - Original task
   * @returns {Array<string>} returns.agents - Agent role names
   * @returns {Array<Object>} returns.phases - Execution phases
   * @returns {Array<Object>} returns.parallelization - Parallel execution opportunities
   * @returns {Array<Object>} returns.qualityGates - Quality gate definitions
   * @description Creates 4-phase plan:
   *   1. Planning - Analyze requirements
   *   2. Implementation - Execute changes (parallel if multiple domains)
   *   3. Testing - Run comprehensive tests
   *   4. Review - Code review and validation
   */
  createPlan(task, agents) {
    const plan = {
      task: task,
      agents: agents.map(a => a.role),
      phases: [],
      parallelization: [],
      qualityGates: []
    };

    // Phase 1: Analysis and planning
    plan.phases.push({
      id: 'planning',
      agents: ['planner'],
      description: 'Analyze requirements and create implementation plan',
      parallel: false
    });

    // Phase 2: Implementation (parallel if multiple domains)
    if (agents.length > 1) {
      plan.phases.push({
        id: 'implementation',
        agents: agents.map(a => a.role),
        description: 'Implement changes across domains',
        parallel: true
      });
    } else {
      plan.phases.push({
        id: 'implementation',
        agents: agents.map(a => a.role),
        description: 'Implement changes',
        parallel: false
      });
    }

    // Phase 3: Testing
    plan.phases.push({
      id: 'testing',
      agents: ['tester'],
      description: 'Run comprehensive tests',
      parallel: false
    });

    // Phase 4: Review
    plan.phases.push({
      id: 'review',
      agents: ['reviewer'],
      description: 'Code review and quality validation',
      parallel: false
    });

    // Quality gates
    plan.qualityGates = [
      { phase: 'implementation', gate: 'code-quality' },
      { phase: 'testing', gate: 'test-coverage' },
      { phase: 'review', gate: 'review-approval' }
    ];

    return plan;
  }

  /**
   * Execute orchestration - main entry point
   * @param {string} task - Task description
   * @returns {Promise<Object>} Orchestration result
   * @returns {string} returns.status - 'orchestrate', 'skip', or 'error'
   * @returns {string} returns.message - Status message
   * @returns {Object} [returns.analysis] - Complexity analysis
   * @returns {Array<Object>} [returns.agents] - Required agents
   * @returns {Object} [returns.plan] - Execution plan
   */
  async execute(task) {
    try {
      // Analyze complexity
      const complexity = this.analyzeComplexity(task);

      if (!complexity.shouldOrchestrate) {
        return {
          status: 'skip',
          message: 'Task does not meet complexity threshold for orchestration',
          analysis: complexity
        };
      }

      // Determine agents
      const agents = this.determineAgents(task);

      // Create plan
      const plan = this.createPlan(task, agents);

      // Log orchestration
      this.logOrchestration(task, complexity, agents, plan);

      return {
        status: 'orchestrate',
        message: 'Task requires multi-agent orchestration',
        analysis: complexity,
        agents: agents,
        plan: plan
      };

    } catch (error) {
      return {
        status: 'error',
        message: `Orchestration failed: ${error.message}`,
        error: error
      };
    }
  }

  /**
   * Log orchestration decision to file
   * @param {string} task - Task description
   * @param {Object} complexity - Complexity analysis
   * @param {Array<Object>} agents - Required agents
   * @param {Object} plan - Execution plan
   */
  logOrchestration(task, complexity, agents, plan) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      task: task,
      complexity: complexity,
      agents: agents.map(a => a.role),
      phases: plan.phases.length,
      parallelPhases: plan.phases.filter(p => p.parallel).length
    };

    const logPath = path.join(process.cwd(), '.claude', 'logs', 'orchestration.log');
    const logDir = path.dirname(logPath);

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
  }

  /**
   * Main execution - CLI interface
   * @description Reads JSON from stdin, executes orchestration, outputs JSON result
   */
  main() {
    try {
      const input = JSON.parse(fs.readFileSync(0, 'utf-8'));
      const task = input.task || input.args?.[0] || '';

      if (!task) {
        console.log(JSON.stringify({
          status: 'error',
          message: 'No task provided'
        }));
        process.exit(1);
      }

      this.execute(task).then(result => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.status === 'error' ? 1 : 0);
      });

    } catch (error) {
      console.error(JSON.stringify({
        status: 'error',
        message: `Workflow execution error: ${error.message}`
      }));
      process.exit(1);
    }
  }
}

// Execute if run directly
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  const orchestrator = new AutoOrchestrator();
  orchestrator.main();
}

export default AutoOrchestrator;
