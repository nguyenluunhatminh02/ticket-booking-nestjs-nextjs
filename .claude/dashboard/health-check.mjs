#!/usr/bin/env node

/**
 * Health Check for Claude Tooling
 * Validates hooks, dependencies, and configurations
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..', '..');
const CLAUDE_DIR = join(PROJECT_ROOT, '.claude');

/**
 * Color codes for terminal output
 */
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

/**
 * Print colored output
 */
function print(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Print success message
 */
function success(message) {
    print('green', `✓ ${message}`);
}

/**
 * Print error message
 */
function error(message) {
    print('red', `✗ ${message}`);
}

/**
 * Print warning message
 */
function warning(message) {
    print('yellow', `⚠ ${message}`);
}

/**
 * Print info message
 */
function info(message) {
    print('blue', `ℹ ${message}`);
}

/**
 * Check if a file exists and is executable
 */
function checkExecutable(filePath) {
    if (!existsSync(filePath)) {
        return { exists: false, executable: false };
    }

    try {
        const stats = statSync(filePath);
        const isExecutable = (stats.mode & 0o111) !== 0;
        return { exists: true, executable: isExecutable };
    } catch (err) {
        return { exists: true, executable: false, error: err.message };
    }
}

/**
 * Check Node.js version
 */
function checkNodeVersion() {
    const requiredVersion = '18.0.0';
    const currentVersion = process.version.slice(1);

    const [reqMajor, reqMinor] = requiredVersion.split('.').map(Number);
    const [curMajor, curMinor] = currentVersion.split('.').map(Number);

    if (curMajor > reqMajor || (curMajor === reqMajor && curMinor >= reqMinor)) {
        success(`Node.js version: ${process.version}`);
        return true;
    } else {
        error(`Node.js version ${process.version} is below required ${requiredVersion}`);
        return false;
    }
}

/**
 * Check if package.json exists
 */
function checkPackageJson() {
    const packagePath = join(PROJECT_ROOT, 'package.json');

    if (!existsSync(packagePath)) {
        error('package.json not found');
        return false;
    }

    try {
        const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
        success(`package.json found: ${pkg.name || 'unnamed'} v${pkg.version || '0.0.0'}`);
        return true;
    } catch (err) {
        error(`Invalid package.json: ${err.message}`);
        return false;
    }
}

/**
 * Check if node_modules exists
 */
function checkNodeModules() {
    const nodeModulesPath = join(PROJECT_ROOT, 'node_modules');

    if (!existsSync(nodeModulesPath)) {
        warning('node_modules not found - run npm install');
        return false;
    }

    success('node_modules directory exists');
    return true;
}

/**
 * Check Claude configuration files
 */
function checkClaudeConfig() {
    const settingsPath = join(CLAUDE_DIR, 'settings.json');
    const claudeMdPath = join(PROJECT_ROOT, 'CLAUDE.md');

    let allValid = true;

    if (existsSync(settingsPath)) {
        try {
            const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
            success('settings.json is valid');

            if (settings.hooks) {
                info(`Found ${Object.keys(settings.hooks).length} hook configurations`);
            }
        } catch (err) {
            error(`Invalid settings.json: ${err.message}`);
            allValid = false;
        }
    } else {
        warning('settings.json not found');
    }

    if (existsSync(claudeMdPath)) {
        success('CLAUDE.md found');
    } else {
        warning('CLAUDE.md not found');
    }

    return allValid;
}

/**
 * Check workflow files
 */
function checkWorkflows() {
    const workflowsDir = join(CLAUDE_DIR, 'workflows');

    if (!existsSync(workflowsDir)) {
        warning('workflows directory not found');
        return [];
    }

    try {
        const files = readdirSync(workflowsDir)
            .filter(f => f.endsWith('.js') || f.endsWith('.mjs'));

        if (files.length === 0) {
            warning('No workflow files found');
            return [];
        }

        success(`Found ${files.length} workflow file(s)`);

        const workflows = [];
        files.forEach(file => {
            const filePath = join(workflowsDir, file);
            const check = checkExecutable(filePath);

            if (check.exists && check.executable) {
                success(`  ${file} - executable`);
                workflows.push({ name: file, status: 'ok' });
            } else if (check.exists && !check.executable) {
                warning(`  ${file} - not executable`);
                workflows.push({ name: file, status: 'warning' });
            } else {
                error(`  ${file} - not found`);
                workflows.push({ name: file, status: 'error' });
            }
        });

        return workflows;
    } catch (err) {
        error(`Error checking workflows: ${err.message}`);
        return [];
    }
}

/**
 * Check dashboard files
 */
function checkDashboard() {
    const dashboardDir = join(CLAUDE_DIR, 'dashboard');

    if (!existsSync(dashboardDir)) {
        error('dashboard directory not found');
        return false;
    }

    const requiredFiles = ['index.html', 'metrics-collector.mjs', 'metrics-viewer.mjs'];
    let allValid = true;

    requiredFiles.forEach(file => {
        const filePath = join(dashboardDir, file);
        if (existsSync(filePath)) {
            success(`${file} exists`);
        } else {
            error(`${file} not found`);
            allValid = false;
        }
    });

    return allValid;
}

/**
 * Check metrics directory
 */
function checkMetrics() {
    const metricsDir = join(CLAUDE_DIR, 'metrics');

    if (!existsSync(metricsDir)) {
        warning('metrics directory not found - will be created on first run');
        return false;
    }

    const metricsFile = join(metricsDir, 'metrics.json');
    if (existsSync(metricsFile)) {
        try {
            const data = JSON.parse(readFileSync(metricsFile, 'utf-8'));
            success(`metrics.json exists (${data.summary?.totalHooks || 0} hooks recorded)`);
            return true;
        } catch (err) {
            error(`Invalid metrics.json: ${err.message}`);
            return false;
        }
    } else {
        warning('metrics.json not found - will be created on first run');
        return false;
    }
}

/**
 * Check git status
 */
function checkGit() {
    try {
        const gitDir = join(PROJECT_ROOT, '.git');
        if (!existsSync(gitDir)) {
            warning('Not a git repository');
            return false;
        }

        const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf-8' });
        const uncommitted = status.split('\n').filter(line => line.trim()).length;

        if (uncommitted > 0) {
            warning(`${uncommitted} uncommitted change(s)`);
        } else {
            success('Git repository clean');
        }

        return true;
    } catch (err) {
        warning('Git not available or not a repository');
        return false;
    }
}

/**
 * Run all health checks
 */
function runHealthCheck() {
    console.log('\n');
    print('cyan', '═══════════════════════════════════════════════════════════');
    print('cyan', '        Claude Tooling Health Check');
    print('cyan', '═══════════════════════════════════════════════════════════\n');

    const results = {
        passed: 0,
        warnings: 0,
        errors: 0,
        details: {}
    };

    // Node.js version
    print('cyan', '\n[Node.js Environment]');
    if (checkNodeVersion()) results.passed++;
    else results.errors++;

    // Package.json
    print('cyan', '\n[Project Configuration]');
    if (checkPackageJson()) results.passed++;
    else results.errors++;

    // Node modules
    if (checkNodeModules()) results.passed++;
    else results.warnings++;

    // Claude config
    print('cyan', '\n[Claude Configuration]');
    if (checkClaudeConfig()) results.passed++;
    else results.errors++;

    // Workflows
    print('cyan', '\n[Workflows]');
    const workflows = checkWorkflows();
    workflows.forEach(w => {
        if (w.status === 'ok') results.passed++;
        else if (w.status === 'warning') results.warnings++;
        else results.errors++;
    });
    results.details.workflows = workflows;

    // Dashboard
    print('cyan', '\n[Dashboard]');
    if (checkDashboard()) results.passed++;
    else results.errors++;

    // Metrics
    print('cyan', '\n[Metrics]');
    if (checkMetrics()) results.passed++;
    else results.warnings++;

    // Git
    print('cyan', '\n[Git Status]');
    if (checkGit()) results.passed++;
    else results.warnings++;

    // Summary
    console.log('\n');
    print('cyan', '═══════════════════════════════════════════════════════════');
    print('cyan', '        Health Check Summary');
    print('cyan', '═══════════════════════════════════════════════════════════\n');

    print('green', `Passed:   ${results.passed}`);
    print('yellow', `Warnings: ${results.warnings}`);
    print('red', `Errors:   ${results.errors}`);

    const total = results.passed + results.warnings + results.errors;
    const score = total > 0 ? Math.round((results.passed / total) * 100) : 0;

    console.log('');
    if (score >= 90) {
        print('green', `Overall Health: ${score}% - Excellent`);
    } else if (score >= 70) {
        print('yellow', `Overall Health: ${score}% - Good`);
    } else if (score >= 50) {
        print('yellow', `Overall Health: ${score}% - Needs Attention`);
    } else {
        print('red', `Overall Health: ${score}% - Critical`);
    }

    console.log('');

    return results;
}

/**
 * Display help
 */
function displayHelp() {
    console.log(`
Health Check CLI

Usage:
  health-check.mjs [options]

Options:
  --check         Run health checks (default)
  --json          Output results as JSON
  --help, -h      Display this help message

Examples:
  health-check.mjs
  health-check.mjs --check
  health-check.mjs --json
    `);
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case '--json':
        const results = runHealthCheck();
        console.log(JSON.stringify(results, null, 2));
        break;
    case '--help':
    case '-h':
        displayHelp();
        break;
    case '--check':
    default:
        runHealthCheck();
        break;
}
"}}]}