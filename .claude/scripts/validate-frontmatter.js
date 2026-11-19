#!/usr/bin/env node
/**
 * Frontmatter Validator for .claude agents, skills, and commands
 *
 * Validates YAML frontmatter in markdown files:
 * - Agents: name (required), description (50-500 chars), tools (optional, valid tool names), model (optional)
 * - Skills: name (required), description (100-500 chars), version (optional, semver), license (optional)
 * - Commands: description (required, 20-200 chars), argument-hint (optional)
 */

const fs = require('fs');
const path = require('path');

// --- Utility Functions ---

function parseFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yamlStr = match[1];
  const obj = {};

  // Simple YAML parser for key-value pairs (handles basic cases)
  const lines = yamlStr.split('\n');
  let currentKey = null;
  let currentValue = '';
  let inArray = false;
  let arrayKey = null;
  const arrayItems = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Check for array item
    if (inArray && trimmed.startsWith('- ')) {
      arrayItems.push(trimmed.substring(2).trim().replace(/^["']|["']$/g, ''));
      continue;
    }

    // If we were in an array, save it
    if (inArray) {
      obj[arrayKey] = arrayItems;
      inArray = false;
      arrayKey = null;
      arrayItems.length = 0;
    }

    // Check for key: value
    const kvMatch = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      let value = kvMatch[2].trim();

      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Check if next lines might be array items
      if (value === '' && i + 1 < lines.length) {
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && nextLine.startsWith('- ')) {
          inArray = true;
          arrayKey = currentKey;
          continue;
        }
      }

      obj[currentKey] = value || '';
    } else if (currentKey && !inArray) {
      // Continuation of previous value (multiline)
      obj[currentKey] += ' ' + trimmed;
    }
  }

  // Save last array if any
  if (inArray && arrayKey) {
    obj[arrayKey] = arrayItems;
  }

  return obj;
}

function isSemver(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function getValidToolNames() {
  // Common Claude Code built-in tools
  return new Set([
    'Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob', 'Skill', 'Task',
    'TodoWrite', 'NotebookEdit', 'WebFetch', 'WebSearch', 'mcp__*',
    'SendMessage', 'ListAgents', 'Artifact', 'EnterWorktree', 'ExitWorktree',
    'Monitor', 'PushNotification', 'CronCreate', 'CronDelete', 'CronList',
    'ReportFindings', 'ToolSearch', 'DeferredToolPlaceholder'
  ]);
}

// --- Validation Functions ---

function validateAgent(name, frontmatter, filePath) {
  const errors = [];
  const relPath = path.relative(process.cwd(), filePath);

  // Required: name
  if (!frontmatter.name || typeof frontmatter.name !== 'string' || frontmatter.name.trim() === '') {
    errors.push({ file: relPath, field: 'name', message: 'Missing required field: name' });
  }

  // Required: description
  if (!frontmatter.description || typeof frontmatter.description !== 'string') {
    errors.push({ file: relPath, field: 'description', message: 'Missing required field: description' });
  } else {
    const descLen = frontmatter.description.trim().length;
    if (descLen < 50) {
      errors.push({ file: relPath, field: 'description', message: `Description too short (${descLen} chars): minimum 50 characters` });
    } else if (descLen > 500) {
      errors.push({ file: relPath, field: 'description', message: `Description too long (${descLen} chars): maximum 500 characters` });
    }
  }

  // Optional: tools (must be valid tool names)
  if (frontmatter.tools) {
    const validTools = getValidToolNames();
    const tools = Array.isArray(frontmatter.tools) ? frontmatter.tools : String(frontmatter.tools).split(',').map(t => t.trim());
    for (const tool of tools) {
      if (!validTools.has(tool) && !tool.includes('__')) {
        // Allow MCP tools with __ pattern
        errors.push({ file: relPath, field: 'tools', message: `Invalid tool name: "${tool}"` });
      }
    }
  }

  // Optional: model (no strict validation, just note presence)

  return errors;
}

function validateSkill(name, frontmatter, filePath) {
  const errors = [];
  const relPath = path.relative(process.cwd(), filePath);

  // Required: name
  if (!frontmatter.name || typeof frontmatter.name !== 'string' || frontmatter.name.trim() === '') {
    errors.push({ file: relPath, field: 'name', message: 'Missing required field: name' });
  }

  // Required: description
  if (!frontmatter.description || typeof frontmatter.description !== 'string') {
    errors.push({ file: relPath, field: 'description', message: 'Missing required field: description' });
  } else {
    const descLen = frontmatter.description.trim().length;
    if (descLen < 100) {
      errors.push({ file: relPath, field: 'description', message: `Description too short (${descLen} chars): minimum 100 characters` });
    } else if (descLen > 500) {
      errors.push({ file: relPath, field: 'description', message: `Description too long (${descLen} chars): maximum 500 characters` });
    }
  }

  // Optional: version (semver)
  if (frontmatter.version && !isSemver(frontmatter.version)) {
    errors.push({ file: relPath, field: 'version', message: `Invalid version format: "${frontmatter.version}" (expected semver, e.g., 1.0.0)` });
  }

  // Optional: license (no strict validation)

  return errors;
}

function validateCommand(name, frontmatter, filePath) {
  const errors = [];
  const relPath = path.relative(process.cwd(), filePath);

  // Required: description
  if (!frontmatter.description || typeof frontmatter.description !== 'string') {
    errors.push({ file: relPath, field: 'description', message: 'Missing required field: description' });
  } else {
    const descLen = frontmatter.description.trim().length;
    if (descLen < 20) {
      errors.push({ file: relPath, field: 'description', message: `Description too short (${descLen} chars): minimum 20 characters` });
    } else if (descLen > 200) {
      errors.push({ file: relPath, field: 'description', message: `Description too long (${descLen} chars): maximum 200 characters` });
    }
  }

  // Optional: argument-hint (no strict validation)

  return errors;
}

// --- Main Execution ---

function scanDirectory(dirPath, validatorFn) {
  const results = [];
  let totalFiles = 0;
  let totalErrors = 0;

  if (!fs.existsSync(dirPath)) {
    console.log(`  Directory not found: ${dirPath}`);
    return { results, totalFiles, totalErrors };
  }

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    totalFiles++;
    const content = fs.readFileSync(filePath, 'utf8');
    const frontmatter = parseFrontmatter(content);

    if (!frontmatter) {
      results.push({ file: path.relative(process.cwd(), filePath), error: 'No frontmatter found' });
      totalErrors++;
      continue;
    }

    const errors = validatorFn(file, frontmatter, filePath);
    if (errors.length > 0) {
      results.push(...errors.map(e => ({ ...e, type: 'validation' })));
      totalErrors += errors.length;
    }
  }

  return { results, totalFiles, totalErrors };
}

function main() {
  const baseDir = path.resolve(__dirname, '..');
  const agentsDir = path.join(baseDir, 'agents');
  const skillsDir = path.join(baseDir, 'skills');
  const commandsDir = path.join(baseDir, 'commands');

  console.log('========================================');
  console.log('Frontmatter Validation Report');
  console.log('========================================\n');

  let grandTotalFiles = 0;
  let grandTotalErrors = 0;
  const allErrors = [];

  // Validate Agents
  console.log('--- Agents ---');
  const agentResults = scanDirectory(agentsDir, validateAgent);
  grandTotalFiles += agentResults.totalFiles;
  grandTotalErrors += agentResults.totalErrors;
  allErrors.push(...agentResults.results);
  if (agentResults.results.length === 0) {
    console.log('  All agents valid.\n');
  } else {
    for (const err of agentResults.results) {
      console.log(`  [ERROR] ${err.file}: ${err.message || err.error}`);
    }
    console.log('');
  }

  // Validate Skills
  console.log('--- Skills ---');
  const skillResults = scanDirectory(skillsDir, validateSkill);
  grandTotalFiles += skillResults.totalFiles;
  grandTotalErrors += skillResults.totalErrors;
  allErrors.push(...skillResults.results);
  if (skillResults.results.length === 0) {
    console.log('  All skills valid.\n');
  } else {
    for (const err of skillResults.results) {
      console.log(`  [ERROR] ${err.file}: ${err.message || err.error}`);
    }
    console.log('');
  }

  // Validate Commands (including subdirectories)
  console.log('--- Commands ---');
  let commandTotalFiles = 0;
  let commandTotalErrors = 0;
  const commandErrors = [];

  function scanCommands(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        scanCommands(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        commandTotalFiles++;
        const content = fs.readFileSync(fullPath, 'utf8');
        const frontmatter = parseFrontmatter(content);
        if (!frontmatter) {
          commandErrors.push({ file: path.relative(process.cwd(), fullPath), error: 'No frontmatter found' });
          commandTotalErrors++;
          continue;
        }
        const errors = validateCommand(entry.name, frontmatter, fullPath);
        if (errors.length > 0) {
          commandErrors.push(...errors);
          commandTotalErrors += errors.length;
        }
      }
    }
  }

  scanCommands(commandsDir);
  grandTotalFiles += commandTotalFiles;
  grandTotalErrors += commandTotalErrors;
  allErrors.push(...commandErrors);
  if (commandErrors.length === 0) {
    console.log('  All commands valid.\n');
  } else {
    for (const err of commandErrors) {
      console.log(`  [ERROR] ${err.file}: ${err.message || err.error}`);
    }
    console.log('');
  }

  // Summary
  console.log('========================================');
  console.log('Summary');
  console.log('========================================');
  console.log(`Total files scanned: ${grandTotalFiles}`);
  console.log(`Total errors found: ${grandTotalErrors}`);
  if (grandTotalErrors === 0) {
    console.log('\nAll frontmatter is valid!');
  } else {
    console.log(`\nPlease fix the ${grandTotalErrors} error(s) above.`);
    process.exit(1);
  }
}

main();
