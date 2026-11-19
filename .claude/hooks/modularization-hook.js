#!/usr/bin/env node
/**
 * Modularization Hook - PostToolUse
 *
 * PURPOSE:
 * Suggests splitting files that exceed a LOC (lines of code) threshold,
 * encouraging modular design.
 *
 * INPUT: JSON via stdin with tool_name, tool_input (file_path), etc.
 * OUTPUT: JSON with hookSpecificOutput.additionalContext when file > 200 LOC.
 */

const fs = require('fs');

const LOC_THRESHOLD = 200;

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('readable', () => {
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    input += chunk;
  }
});

process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input.trim() || '{}');
    const { tool_name, tool_input } = data;

    if (tool_name !== 'Write' && tool_name !== 'Edit') {
      process.exit(0);
    }

    const filePath = tool_input && tool_input.file_path;
    if (!filePath) {
      process.exit(0);
    }

    if (!fs.existsSync(filePath)) {
      process.exit(0);
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      process.exit(0);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const loc = content.split('\n').length;

    if (loc > LOC_THRESHOLD) {
      const output = {
        hookSpecificOutput: {
          additionalContext: `[Modularization] File ${filePath} has ${loc} LOC (threshold: ${LOC_THRESHOLD}). Consider splitting into smaller modules.`
        }
      };
      process.stdout.write(JSON.stringify(output));
    }

    process.exit(0);
  } catch (error) {
    if (process.env.MODULARIZATION_HOOK_DEBUG === 'true') {
      console.error('modularization-hook error:', error.message);
    }
    process.exit(0);
  }
});
