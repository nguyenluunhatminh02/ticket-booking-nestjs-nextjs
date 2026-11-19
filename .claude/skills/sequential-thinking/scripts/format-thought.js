#!/usr/bin/env node

/**
 * Sequential Thinking Thought Formatter
 *
 * PURPOSE:
 * Formats thoughts for display with visual indicators for type (regular/revision/branch).
 * Provides consistent, readable output for thought sequences in multiple formats.
 *
 * WHY THIS SCRIPT:
 * - Visualizes sequential thinking process with clear formatting
 * - Distinguishes between regular thoughts, revisions, and branches
 * - Provides multiple output formats (box, simple, markdown)
 * - Helps track thought progression and reasoning paths
 *
 * THOUGHT TYPES:
 *   1. Regular thought: Standard thinking step
 *      - Emoji: 💭
 *      - Prefix: "Thought"
 *   2. Revision: Corrects or updates a previous thought
 *      - Emoji: 🔄
 *      - Prefix: "REVISION"
 *      - Shows: "(revising thought N)"
 *   3. Branch: Explores alternative reasoning path
 *      - Emoji: 🌿
 *      - Prefix: "BRANCH"
 *      - Shows: "(from thought N, ID: x)"
 *
 * COMMAND LINE ARGUMENTS:
 *   --thought <text>       Thought content (default: "No thought provided")
 *   --number <n>           Thought number in sequence (default: 1)
 *   --total <n>            Total thoughts in sequence (default: 1)
 *   --revision <n>         Mark as revision of thought N (optional)
 *   --branch <n>           Mark as branch from thought N (optional)
 *   --branchId <id>        Branch identifier (optional, used with --branch)
 *   --format <type>        Output format: box, simple, markdown (default: box)
 *
 * OUTPUT FORMATS:
 *
 * 1. BOX (default):
 *    ┌─────────────────────────────────────┐
 *    │ 💭 Thought 1/5                      │
 *    ├─────────────────────────────────────┤
 *    │ Analysis of the problem...          │
 *    └─────────────────────────────────────┘
 *
 * 2. SIMPLE:
 *    Thought 1/5: Analysis of the problem...
 *
 * 3. MARKDOWN:
 *    **Thought 1/5**
 *
 *    Analysis of the problem...
 *
 * EXIT CODES:
 *   0 - Formatting successful
 *
 * USAGE EXAMPLES:
 *   # Regular thought
 *   node format-thought.js --thought "First, analyze requirements" --number 1 --total 5
 *
 *   # Revision of previous thought
 *   node format-thought.js --thought "Actually, use different approach" --number 2 --total 5 --revision 1
 *
 *   # Branch exploration
 *   node format-thought.js --thought "Alternative: try method B" --number 3 --total 5 --branch 2 --branchId "alt"
 *
 *   # Simple format
 *   node format-thought.js --thought "Quick note" --number 1 --total 3 --format simple
 *
 *   # Markdown format
 *   node format-thought.js --thought "Detailed analysis" --number 2 --total 4 --format markdown
 *
 * TEXT WRAPPING:
 *   - Box format automatically wraps long text
 *   - Wraps at word boundaries (doesn't split words)
 *   - Maintains consistent box width based on header length
 *
 * CLASS STRUCTURE:
 *   ThoughtFormatter (static methods):
 *   - format(thoughtData): Box format with borders
 *   - formatSimple(thoughtData): Single-line format
 *   - formatMarkdown(thoughtData): Markdown format
 *   - wrapText(text, maxWidth): Word-wrap helper
 *
 * MODULE EXPORT:
 *   Exports ThoughtFormatter class for use in other scripts
 *   Can be imported: const {ThoughtFormatter} = require('./format-thought.js');
 *
 * NOTES:
 *   - Used by process-thought.js to display formatted thoughts
 *   - Box format is most readable for terminal output
 *   - Markdown format is best for documentation
 *   - Simple format is most compact
 *   - Long thoughts are automatically wrapped in box format
 */

class ThoughtFormatter {
  static format(thoughtData) {
    const { thoughtNumber, totalThoughts, thought, isRevision, revisesThought, branchFromThought, branchId } = thoughtData;

    let prefix = '';
    let context = '';
    let emoji = '';

    if (isRevision && revisesThought) {
      emoji = '🔄';
      prefix = 'REVISION';
      context = ` (revising thought ${revisesThought})`;
    } else if (branchFromThought) {
      emoji = '🌿';
      prefix = 'BRANCH';
      context = branchId ? ` (from thought ${branchFromThought}, ID: ${branchId})` : ` (from thought ${branchFromThought})`;
    } else {
      emoji = '💭';
      prefix = 'Thought';
      context = '';
    }

    const header = `${emoji} ${prefix} ${thoughtNumber}/${totalThoughts}${context}`;
    const maxLength = Math.max(header.length, thought.length);
    const border = '─'.repeat(maxLength + 4);

    // Wrap long thoughts
    const wrappedThought = this.wrapText(thought, maxLength);
    const thoughtLines = wrappedThought.map(line => `│ ${line.padEnd(maxLength + 2)} │`).join('\n');

    return `
┌${border}┐
│ ${header.padEnd(maxLength + 2)} │
├${border}┤
${thoughtLines}
└${border}┘`;
  }

  static wrapText(text, maxWidth) {
    if (text.length <= maxWidth) {
      return [text];
    }

    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxWidth) {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  static formatSimple(thoughtData) {
    const { thoughtNumber, totalThoughts, thought, isRevision, revisesThought, branchFromThought, branchId } = thoughtData;

    let marker = '';
    if (isRevision && revisesThought) {
      marker = ` [REVISION of Thought ${revisesThought}]`;
    } else if (branchFromThought) {
      marker = branchId ? ` [BRANCH ${branchId.toUpperCase()} from Thought ${branchFromThought}]` : ` [BRANCH from Thought ${branchFromThought}]`;
    }

    return `Thought ${thoughtNumber}/${totalThoughts}${marker}: ${thought}`;
  }

  static formatMarkdown(thoughtData) {
    const { thoughtNumber, totalThoughts, thought, isRevision, revisesThought, branchFromThought, branchId } = thoughtData;

    let marker = '';
    if (isRevision && revisesThought) {
      marker = ` **[REVISION of Thought ${revisesThought}]**`;
    } else if (branchFromThought) {
      marker = branchId ? ` **[BRANCH ${branchId.toUpperCase()} from Thought ${branchFromThought}]**` : ` **[BRANCH from Thought ${branchFromThought}]**`;
    }

    return `**Thought ${thoughtNumber}/${totalThoughts}**${marker}\n\n${thought}\n`;
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);

  const parseArgs = (args) => {
    const parsed = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const value = args[i + 1];

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

  const thoughtData = {
    thought: input.thought || 'No thought provided',
    thoughtNumber: input.number || 1,
    totalThoughts: input.total || 1,
    isRevision: input.revision !== undefined,
    revisesThought: input.revision,
    branchFromThought: input.branch,
    branchId: input.branchId
  };

  const format = input.format || 'box';

  let output;
  switch (format) {
    case 'simple':
      output = ThoughtFormatter.formatSimple(thoughtData);
      break;
    case 'markdown':
      output = ThoughtFormatter.formatMarkdown(thoughtData);
      break;
    case 'box':
    default:
      output = ThoughtFormatter.format(thoughtData);
  }

  console.log(output);
}

module.exports = { ThoughtFormatter };
