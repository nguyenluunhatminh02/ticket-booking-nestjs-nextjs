#!/usr/bin/env node

/**
 * @fileoverview Commit Workflows - Automated commit message generation and validation
 * @module workflows/commit-workflows
 * @description Provides intelligent commit message generation following Conventional Commits
 * specification with scope detection, type inference, and validation. Analyzes git diffs
 * to determine appropriate commit types, scopes, and descriptions automatically.
 * @version 1.0.0
 * @author Mastery Node.js Project
 */

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Commit Workflow for automated commit message generation
 * @class CommitWorkflow
 * @description Analyzes staged changes and generates Conventional Commits formatted
 * messages with appropriate types, scopes, and descriptions.
 *
 * @example
 * const workflow = new CommitWorkflow();
 * const message = await workflow.generateCommitMessage(['src/api.js', 'src/db.js']);
 * console.log(message); // 'feat(api): add new feature across 2 files'
 */
class CommitWorkflow {
  /**
   * Creates a new CommitWorkflow instance
   * @constructor
   */
  constructor() {
    /**
     * Conventional Commit types and their descriptions
     * @type {Object<string, string>}
     * @property {string} feat - A new feature
     * @property {string} fix - A bug fix
     * @property {string} docs - Documentation only changes
     * @property {string} style - Changes that do not affect the meaning of the code
     * @property {string} refactor - A code change that neither fixes a bug nor adds a feature
     * @property {string} perf - A code change that improves performance
     * @property {string} test - Adding missing tests or correcting existing tests
     * @property {string} chore - Changes to the build process or auxiliary tools
     */
    this.types = {
      feat: 'A new feature',
      fix: 'A bug fix',
      docs: 'Documentation only changes',
      style: 'Changes that do not affect the meaning of the code',
      refactor: 'A code change that neither fixes a bug nor adds a feature',
      perf: 'A code change that improves performance',
      test: 'Adding missing tests or correcting existing tests',
      chore: 'Changes to the build process or auxiliary tools'
    };
  }

  /**
   * Analyze git diff and generate commit message
   * @param {Array<string>} [stagedFiles=[]] - Array of staged file paths
   * @returns {Promise<string>} Generated commit message
   * @throws {Error} If no staged changes found
   */
  async generateCommitMessage(stagedFiles = []) {
    try {
      // Get staged changes
      const diff = this.getStagedDiff();
      if (!diff) {
        throw new Error('No staged changes found');
      }

      // Analyze changes
      const analysis = this.analyzeChanges(diff, stagedFiles);

      // Generate commit message
      const message = this.formatCommitMessage(analysis);

      return message;
    } catch (error) {
      console.error('Error generating commit message:', error.message);
      throw error;
    }
  }

  /**
   * Get staged diff from git
   * @returns {string|null} Staged diff content or null if error
   */
  getStagedDiff() {
    try {
      const result = execFileSync('git', ['diff', '--cached'], { encoding: 'utf-8' });
      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze changes to determine commit type and scope
   * @param {string} diff - Git diff content
   * @param {Array<string>} stagedFiles - Array of staged file paths
   * @returns {Object} Analysis result
   * @returns {string} returns.type - Commit type (feat, fix, docs, etc.)
   * @returns {string|null} returns.scope - Commit scope (directory name)
   * @returns {string} returns.description - Commit description
   * @returns {Array<string>} returns.files - Staged files
   * @returns {boolean} returns.hasBreakingChange - True if breaking change detected
   * @returns {boolean} returns.affectsTests - True if test files changed
   * @returns {boolean} returns.affectsDocs - True if documentation files changed
   */
  analyzeChanges(diff, stagedFiles) {
    const analysis = {
      type: 'chore',
      scope: null,
      description: '',
      files: stagedFiles,
      hasBreakingChange: false,
      affectsTests: false,
      affectsDocs: false
    };

    // Determine scope from file paths
    const scopes = this.extractScopes(stagedFiles);
    if (scopes.length === 1) {
      analysis.scope = scopes[0];
    }

    // Analyze diff content
    const lines = diff.split('\n');
    let additions = 0;
    let deletions = 0;
    let testFiles = 0;
    let docFiles = 0;

    for (const line of lines) {
      if (line.startsWith('+++ b/')) {
        const file = line.substring(6);
        if (file.includes('test') || file.includes('spec')) {
          testFiles++;
          analysis.affectsTests = true;
        }
        if (file.endsWith('.md') || file.includes('docs/')) {
          docFiles++;
          analysis.affectsDocs = true;
        }
      }
      if (line.startsWith('+') && !line.startsWith('+++')) additions++;
      if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    }

    // Determine commit type
    if (analysis.affectsDocs && !analysis.affectsTests) {
      analysis.type = 'docs';
    } else if (analysis.affectsTests && testFiles === stagedFiles.length) {
      analysis.type = 'test';
    } else if (additions > deletions * 2) {
      analysis.type = 'feat';
    } else if (deletions > additions) {
      analysis.type = 'refactor';
    } else {
      analysis.type = 'fix';
    }

    // Check for breaking changes
    if (diff.includes('BREAKING CHANGE:') || diff.includes('!:')) {
      analysis.hasBreakingChange = true;
    }

    // Generate description
    analysis.description = this.generateDescription(analysis, additions, deletions);

    return analysis;
  }

  /**
   * Extract scopes from file paths
   * @param {Array<string>} files - Array of file paths
   * @returns {Array<string>} Array of unique scope names
   * @description Uses first directory as scope, excluding generic directories
   *   like 'src', 'lib', 'test'. Falls back to second directory if needed.
   */
  extractScopes(files) {
    const scopes = new Set();

    for (const file of files) {
      const parts = file.split('/');
      if (parts.length > 1) {
        // Use first directory as scope
        const scope = parts[0];
        if (scope !== 'src' && scope !== 'lib' && scope !== 'test') {
          scopes.add(scope);
        } else if (parts.length > 2) {
          scopes.add(parts[1]);
        }
      }
    }

    return Array.from(scopes);
  }

  /**
   * Generate commit description based on analysis
   * @param {Object} analysis - Change analysis result
   * @param {number} additions - Number of line additions
   * @param {number} deletions - Number of line deletions
   * @returns {string} Commit description
   */
  generateDescription(analysis, additions, deletions) {
    const fileCount = analysis.files.length;
    const changeType = analysis.type;

    const descriptions = {
      feat: `add new feature across ${fileCount} file${fileCount > 1 ? 's' : ''}`,
      fix: `fix bug in ${analysis.scope || 'application'}`,
      docs: `update documentation for ${analysis.scope || 'project'}`,
      style: `format code in ${fileCount} file${fileCount > 1 ? 's' : ''}`,
      refactor: `refactor ${analysis.scope || 'code'} (${additions} additions, ${deletions} deletions)`,
      perf: `improve performance in ${analysis.scope || 'application'}`,
      test: `add tests for ${analysis.scope || 'components'}`,
      chore: `update ${fileCount} file${fileCount > 1 ? 's' : ''}`
    };

    return descriptions[changeType] || descriptions.chore;
  }

  /**
   * Format commit message following Conventional Commits specification
   * @param {Object} analysis - Change analysis result
   * @returns {string} Formatted commit message
   * @description Format: type(scope)!: description
   *   Adds body with file count if >5 files or breaking change present
   */
  formatCommitMessage(analysis) {
    let message = analysis.type;

    if (analysis.scope) {
      message += `(${analysis.scope})`;
    }

    if (analysis.hasBreakingChange) {
      message += '!';
    }

    message += `: ${analysis.description}`;

    // Add body if needed
    if (analysis.files.length > 5 || analysis.hasBreakingChange) {
      message += '\n\n';
      message += `Files changed: ${analysis.files.length}\n`;

      if (analysis.hasBreakingChange) {
        message += '\nBREAKING CHANGE: This commit includes breaking changes\n';
      }
    }

    return message;
  }

  /**
   * Validate commit message format
   * @param {string} message - Commit message to validate
   * @returns {boolean} True if message follows Conventional Commits format
   * @description Validates first line matches pattern:
   *   type(scope)!: description (1-100 chars)
   */
  validateCommitMessage(message) {
    const pattern = /^(feat|fix|docs|style|refactor|perf|test|chore)(\([a-z-]+\))?!?: .{1,100}$/;
    const firstLine = message.split('\n')[0];

    return pattern.test(firstLine);
  }

  /**
   * Create commit with generated message
   * @param {string} message - Commit message
   * @param {Object} [options={}] - Commit options
   * @param {boolean} [options.push=false] - Push after commit
   * @returns {Promise<Object>} Commit result
   * @returns {boolean} returns.success - True if commit succeeded
   * @returns {string} [returns.message] - Commit message (if success)
   * @returns {string} [returns.error] - Error message (if failed)
   */
  async createCommit(message, options = {}) {
    try {
      // Validate message
      if (!this.validateCommitMessage(message)) {
        console.warn('Warning: Commit message does not follow Conventional Commits format');
      }

      // Create commit
      execFileSync('git', ['commit', '-m', message], { stdio: 'inherit' });

      // Push if requested
      if (options.push) {
        execFileSync('git', ['push'], { stdio: 'inherit' });
      }

      return { success: true, message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

/**
 * CLI interface for commit workflows
 * @description Commands:
 *   - generate: Generate commit message from staged changes
 *   - commit: Create commit with generated message
 *   - validate <message>: Validate commit message format
 */
if (require.main === module) {
  const workflow = new CommitWorkflow();
  const command = process.argv[2];

  (async () => {
    try {
      switch (command) {
        case 'generate':
          const message = await workflow.generateCommitMessage();
          console.log(message);
          break;

        case 'commit':
          const commitMessage = await workflow.generateCommitMessage();
          const result = await workflow.createCommit(commitMessage, {
            push: process.argv.includes('--push')
          });
          if (result.success) {
            console.log('Commit created successfully');
          } else {
            console.error('Commit failed:', result.error);
            process.exit(1);
          }
          break;

        case 'validate':
          const msg = process.argv[3];
          if (!msg) {
            console.error('Usage: commit-workflows.js validate <message>');
            process.exit(1);
          }
          const isValid = workflow.validateCommitMessage(msg);
          console.log(isValid ? 'Valid' : 'Invalid');
          process.exit(isValid ? 0 : 1);
          break;

        default:
          console.log('Usage: commit-workflows.js <generate|commit|validate>');
          console.log('  generate  - Generate commit message from staged changes');
          console.log('  commit    - Create commit with generated message');
          console.log('  validate  - Validate commit message format');
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = CommitWorkflow;
