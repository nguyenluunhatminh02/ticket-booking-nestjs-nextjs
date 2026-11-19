#!/usr/bin/env node

/**
 * Sequential Thinking Thought Processor
 *
 * PURPOSE:
 * Validates and tracks sequential thoughts with revision and branching support.
 * Maintains persistent thought history in JSON file for context management.
 *
 * WHY THIS SCRIPT:
 * - Enables structured problem-solving with revision capability
 * - Tracks thought progression and branching paths
 * - Provides deterministic validation for thought sequences
 * - Persists thought history across script invocations
 *
 * THOUGHT LIFECYCLE:
 *   1. Validate input (required fields, types)
 *   2. Auto-adjust totalThoughts if thoughtNumber exceeds it
 *   3. Store thought in history with timestamp
 *   4. Track branches if this is a branch thought
 *   5. Save history to .thought-history.json
 *   6. Return processing result
 *
 * COMMAND LINE ARGUMENTS:
 *   --thought <text>       Thought content (required)
 *   --number <n>           Thought number in sequence (required)
 *   --total <n>            Total thoughts expected (required)
 *   --next <bool>          Is next thought needed? (required)
 *   --revision <n>         Mark as revision of thought N (optional)
 *   --branch <n>           Mark as branch from thought N (optional)
 *   --branchId <id>        Branch identifier (optional)
 *   --needsMore <bool>     Are more thoughts needed? (optional)
 *   --reset                Reset thought history
 *   --history              Show thought history
 *
 * OUTPUT FORMAT:
 *   JSON to stdout:
 *   {
 *     "success": true,
 *     "thoughtNumber": 1,
 *     "totalThoughts": 5,
 *     "nextThoughtNeeded": true,
 *     "branches": ["a", "b"],
 *     "thoughtHistoryLength": 3,
 *     "timestamp": "2025-01-07T10:30:00.000Z"
 *   }
 *
 * EXIT CODES:
 *   0 - Processing successful
 *   1 - Validation failed or error occurred
 *
 * USAGE EXAMPLES:
 *   # Process a thought
 *   node process-thought.js --thought "Analyze requirements" --number 1 --total 5 --next true
 *
 *   # Mark as revision
 *   node process-thought.js --thought "Use different approach" --number 2 --total 5 --next true --revision 1
 *
 *   # Create branch
 *   node process-thought.js --thought "Try alternative" --number 3 --total 5 --next true --branch 2 --branchId "alt"
 *
 *   # View history
 *   node process-thought.js --history
 *
 *   # Reset history
 *   node process-thought.js --reset
 *
 * VALIDATION RULES:
 *   - thought: Non-empty string (required)
 *   - thoughtNumber: Positive number (required)
 *   - totalThoughts: Positive number (required)
 *   - nextThoughtNeeded: Boolean (required)
 *   - isRevision: Boolean (optional)
 *   - revisesThought: Positive number (optional)
 *   - branchFromThought: Positive number (optional)
 *   - branchId: String (optional)
 *   - needsMoreThoughts: Boolean (optional)
 *
 * DATA STRUCTURE:
 *   thoughtHistory: Array of thought objects
 *   branches: Object mapping branchId -> array of thoughts
 *
 * PERSISTENCE:
 *   - History stored in .thought-history.json (same directory as script)
 *   - Automatically loaded on script start
 *   - Automatically saved after each thought
 *   - Can be reset with --reset flag
 *
 * ENVIRONMENT VARIABLES:
 *   DISABLE_THOUGHT_LOGGING - Set to "true" to disable logging
 *
 * CLASS STRUCTURE:
 *   ThoughtProcessor:
 *   - constructor(): Load history from file
 *   - loadHistory(): Read .thought-history.json
 *   - saveHistory(): Write .thought-history.json
 *   - resetHistory(): Clear history and delete file
 *   - validateThought(input): Validate input fields
 *   - processThought(input): Process and store thought
 *   - getHistory(): Return current history
 *
 * MODULE EXPORT:
 *   Exports ThoughtProcessor class for use in other scripts
 *   Can be imported: const {ThoughtProcessor} = require('./process-thought.js');
 *
 * NOTES:
 *   - Used by sequential-thinking skill for structured problem-solving
 *   - History persists across script invocations
 *   - Branches are tracked separately for easy retrieval
 *   - Auto-adjusts totalThoughts if thoughtNumber exceeds it
 *   - Validation errors are returned, not thrown
 */

const fs = require('fs');
const path = require('path');

// Configuration
const HISTORY_FILE = path.join(__dirname, '.thought-history.json');
const DISABLE_LOGGING = process.env.DISABLE_THOUGHT_LOGGING?.toLowerCase() === 'true';

class ThoughtProcessor {
  constructor() {
    this.loadHistory();
  }

  loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        this.thoughtHistory = data.thoughtHistory || [];
        this.branches = data.branches || {};
      } else {
        this.thoughtHistory = [];
        this.branches = {};
      }
    } catch (error) {
      this.thoughtHistory = [];
      this.branches = {};
    }
  }

  saveHistory() {
    fs.writeFileSync(
      HISTORY_FILE,
      JSON.stringify({
        thoughtHistory: this.thoughtHistory,
        branches: this.branches
      }, null, 2)
    );
  }

  resetHistory() {
    this.thoughtHistory = [];
    this.branches = {};
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
    }
  }

  validateThought(input) {
    const errors = [];

    if (!input.thought || typeof input.thought !== 'string' || input.thought.trim() === '') {
      errors.push('Invalid thought: must be a non-empty string');
    }

    if (!input.thoughtNumber || typeof input.thoughtNumber !== 'number' || input.thoughtNumber < 1) {
      errors.push('Invalid thoughtNumber: must be a positive number');
    }

    if (!input.totalThoughts || typeof input.totalThoughts !== 'number' || input.totalThoughts < 1) {
      errors.push('Invalid totalThoughts: must be a positive number');
    }

    if (typeof input.nextThoughtNeeded !== 'boolean') {
      errors.push('Invalid nextThoughtNeeded: must be a boolean');
    }

    // Optional field validations
    if (input.isRevision !== undefined && typeof input.isRevision !== 'boolean') {
      errors.push('Invalid isRevision: must be a boolean');
    }

    if (input.revisesThought !== undefined && (typeof input.revisesThought !== 'number' || input.revisesThought < 1)) {
      errors.push('Invalid revisesThought: must be a positive number');
    }

    if (input.branchFromThought !== undefined && (typeof input.branchFromThought !== 'number' || input.branchFromThought < 1)) {
      errors.push('Invalid branchFromThought: must be a positive number');
    }

    if (input.branchId !== undefined && typeof input.branchId !== 'string') {
      errors.push('Invalid branchId: must be a string');
    }

    if (input.needsMoreThoughts !== undefined && typeof input.needsMoreThoughts !== 'boolean') {
      errors.push('Invalid needsMoreThoughts: must be a boolean');
    }

    return errors;
  }

  processThought(input) {
    const errors = this.validateThought(input);

    if (errors.length > 0) {
      return {
        success: false,
        errors,
        status: 'failed'
      };
    }

    // Auto-adjust totalThoughts if thoughtNumber exceeds it
    if (input.thoughtNumber > input.totalThoughts) {
      input.totalThoughts = input.thoughtNumber;
    }

    // Create thought data
    const thoughtData = {
      thought: input.thought,
      thoughtNumber: input.thoughtNumber,
      totalThoughts: input.totalThoughts,
      nextThoughtNeeded: input.nextThoughtNeeded,
      isRevision: input.isRevision,
      revisesThought: input.revisesThought,
      branchFromThought: input.branchFromThought,
      branchId: input.branchId,
      needsMoreThoughts: input.needsMoreThoughts,
      timestamp: new Date().toISOString()
    };

    // Add to history
    this.thoughtHistory.push(thoughtData);

    // Track branches
    if (thoughtData.branchFromThought && thoughtData.branchId) {
      if (!this.branches[thoughtData.branchId]) {
        this.branches[thoughtData.branchId] = [];
      }
      this.branches[thoughtData.branchId].push(thoughtData);
    }

    // Save history
    this.saveHistory();

    return {
      success: true,
      thoughtNumber: thoughtData.thoughtNumber,
      totalThoughts: thoughtData.totalThoughts,
      nextThoughtNeeded: thoughtData.nextThoughtNeeded,
      branches: Object.keys(this.branches),
      thoughtHistoryLength: this.thoughtHistory.length,
      timestamp: thoughtData.timestamp
    };
  }

  getHistory() {
    return {
      thoughts: this.thoughtHistory,
      branches: this.branches,
      totalThoughts: this.thoughtHistory.length
    };
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const processor = new ThoughtProcessor();

  // Parse arguments
  const parseArgs = (args) => {
    const parsed = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const value = args[i + 1];

        if (key === 'reset') {
          return { reset: true };
        }

        if (key === 'history') {
          return { history: true };
        }

        if (value && !value.startsWith('--')) {
          // Parse boolean
          if (value === 'true') parsed[key] = true;
          else if (value === 'false') parsed[key] = false;
          // Parse number
          else if (!isNaN(value)) parsed[key] = parseFloat(value);
          // String
          else parsed[key] = value;
          i++;
        }
      }
    }
    return parsed;
  };

  const input = parseArgs(args);

  if (input.reset) {
    processor.resetHistory();
    console.log(JSON.stringify({ success: true, message: 'History reset' }, null, 2));
    process.exit(0);
  }

  if (input.history) {
    console.log(JSON.stringify(processor.getHistory(), null, 2));
    process.exit(0);
  }

  // Map CLI args to expected field names
  const thoughtInput = {
    thought: input.thought,
    thoughtNumber: input.number,
    totalThoughts: input.total,
    nextThoughtNeeded: input.next,
    isRevision: input.revision !== undefined ? true : input.isRevision,
    revisesThought: input.revision,
    branchFromThought: input.branch,
    branchId: input.branchId,
    needsMoreThoughts: input.needsMore
  };

  const result = processor.processThought(thoughtInput);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

module.exports = { ThoughtProcessor };
