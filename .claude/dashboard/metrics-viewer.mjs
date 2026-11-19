#!/usr/bin/env node

/**
 * Metrics Viewer CLI for Claude Tooling
 * Display metrics summary in a human-readable format
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const METRICS_FILE = join(__dirname, '..', 'metrics', 'metrics.json');

/**
 * Load metrics data
 */
function loadMetrics() {
    if (!existsSync(METRICS_FILE)) {
        console.error('Error: Metrics file not found at', METRICS_FILE);
        console.error('Run some workflows first to generate metrics data.');
        process.exit(1);
    }

    try {
        const data = readFileSync(METRICS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading metrics file:', error.message);
        process.exit(1);
    }
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format duration in milliseconds to human-readable format
 */
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Display metrics summary
 */
function displaySummary(metrics) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║           Claude Tooling Metrics Summary                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const summary = metrics.summary;

    console.log('┌─ Overview ─────────────────────────────────────────────────┐');
    console.log(`│ Total Hook Executions:     ${formatNumber(summary.totalHooks).padStart(10)}                        │`);
    console.log(`│ Total Agent Invocations:   ${formatNumber(summary.totalAgents).padStart(10)}                        │`);
    console.log(`│ Active Workflows:          ${formatNumber(summary.activeWorkflows).padStart(10)}                        │`);
    console.log(`│ Completed Workflows:       ${formatNumber(summary.completedWorkflows).padStart(10)}                        │`);
    console.log(`│ Total Errors:              ${formatNumber(summary.totalErrors).padStart(10)}                        │`);
    console.log(`│ Error Rate:                ${(summary.errorRate || 0).toFixed(2).padStart(10)}%                        │`);
    console.log('└────────────────────────────────────────────────────────────┘\n');

    console.log('┌─ Today\'s Activity ─────────────────────────────────────────┐');
    console.log(`│ Hooks Executed Today:    ${formatNumber(summary.hooksToday).padStart(10)}                        │`);
    console.log(`│ Agents Invoked Today:    ${formatNumber(summary.agentsToday).padStart(10)}                        │`);
    console.log('└────────────────────────────────────────────────────────────┘\n');
}

/**
 * Display agent type breakdown
 */
function displayAgentBreakdown(metrics) {
    const agentTypes = metrics.agentTypes || {};
    const entries = Object.entries(agentTypes);

    if (entries.length === 0) {
        console.log('┌─ Agent Types ──────────────────────────────────────────────┐');
        console.log('│ No agent invocations recorded yet                          │');
        console.log('└────────────────────────────────────────────────────────────┘\n');
        return;
    }

    console.log('┌─ Agent Type Breakdown ─────────────────────────────────────┐');
    entries
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([type, count]) => {
            const bar = '█'.repeat(Math.min(20, Math.ceil(count / Math.max(...entries.map(e => e[1])) * 20)));
            console.log(`│ ${type.padEnd(25)} ${formatNumber(count).padStart(6)} ${bar.padEnd(20)} │`);
        });
    console.log('└────────────────────────────────────────────────────────────┘\n');
}

/**
 * Display workflow status breakdown
 */
function displayWorkflowStatus(metrics) {
    const workflowStatus = metrics.workflowStatus || {};
    const entries = Object.entries(workflowStatus);

    if (entries.length === 0) {
        console.log('┌─ Workflow Status ──────────────────────────────────────────┐');
        console.log('│ No workflow executions recorded yet                        │');
        console.log('└────────────────────────────────────────────────────────────┘\n');
        return;
    }

    console.log('┌─ Workflow Status Breakdown ──────────────────────────────────┐');
    entries
        .sort((a, b) => b[1] - a[1])
        .forEach(([status, count]) => {
            const icon = status === 'completed' ? '✓' : status === 'failed' ? '✗' : status === 'active' ? '●' : '○';
            console.log(`│ ${icon} ${status.padEnd(20)} ${formatNumber(count).padStart(6)} executions              │`);
        });
    console.log('└────────────────────────────────────────────────────────────┘\n');
}

/**
 * Display error types breakdown
 */
function displayErrorBreakdown(metrics) {
    const errorTypes = metrics.errorTypes || {};
    const entries = Object.entries(errorTypes);

    if (entries.length === 0) {
        console.log('┌─ Error Types ──────────────────────────────────────────────┐');
        console.log('│ No errors recorded yet                                     │');
        console.log('└────────────────────────────────────────────────────────────┘\n');
        return;
    }

    console.log('┌─ Error Type Breakdown ───────────────────────────────────────┐');
    entries
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([type, count]) => {
            console.log(`│ ${type.padEnd(30)} ${formatNumber(count).padStart(6)} occurrences          │`);
        });
    console.log('└────────────────────────────────────────────────────────────┘\n');
}

/**
 * Display recent activity
 */
function displayRecentActivity(metrics) {
    const activities = metrics.recentActivity || [];

    if (activities.length === 0) {
        console.log('┌─ Recent Activity ────────────────────────────────────────────┐');
        console.log('│ No recent activity recorded                                  │');
        console.log('└────────────────────────────────────────────────────────────┘\n');
        return;
    }

    console.log('┌─ Recent Activity (Last 10) ──────────────────────────────────┐');
    activities.slice(0, 10).forEach(activity => {
        const timestamp = new Date(activity.timestamp).toLocaleString();
        const icon = activity.type === 'error' ? '✗' : activity.type === 'success' ? '✓' : '●';
        const message = activity.message.substring(0, 50);
        console.log(`│ ${icon} ${timestamp.padEnd(20)} ${message.padEnd(30)} │`);
    });
    console.log('└────────────────────────────────────────────────────────────┘\n');
}

/**
 * Display hourly breakdown
 */
function displayHourlyBreakdown(metrics) {
    const hourlyData = metrics.hourlyBreakdown || {};
    const hours = Object.keys(hourlyData).sort().slice(-24);

    if (hours.length === 0) {
        console.log('┌─ Hourly Activity (Last 24 Hours) ──────────────────────────┐');
        console.log('│ No hourly data available                                   │');
        console.log('└────────────────────────────────────────────────────────────┘\n');
        return;
    }

    console.log('┌─ Hourly Activity (Last 24 Hours) ──────────────────────────┐');
    const maxHooks = Math.max(...hours.map(h => hourlyData[h].hooks || 0));

    hours.forEach(hour => {
        const data = hourlyData[hour];
        const time = new Date(hour).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const bar = '█'.repeat(Math.min(30, Math.ceil((data.hooks || 0) / maxHooks * 30)));
        console.log(`│ ${time} │ ${(data.hooks || 0).toString().padStart(3)} hooks ${bar.padEnd(30)} │`);
    });
    console.log('└────────────────────────────────────────────────────────────┘\n');
}

/**
 * Display detailed statistics
 */
function displayDetailedStats(metrics) {
    const hookExecs = metrics.hookExecutions || [];
    const agentInvs = metrics.agentInvocations || [];

    console.log('┌─ Detailed Statistics ────────────────────────────────────────┐');

    if (hookExecs.length > 0) {
        const avgHookDuration = hookExecs.reduce((sum, e) => sum + (e.duration || 0), 0) / hookExecs.length;
        const maxHookDuration = Math.max(...hookExecs.map(e => e.duration || 0));
        console.log(`│ Avg Hook Duration:       ${formatDuration(avgHookDuration).padStart(10)}                        │`);
        console.log(`│ Max Hook Duration:       ${formatDuration(maxHookDuration).padStart(10)}                        │`);
    }

    if (agentInvs.length > 0) {
        const avgAgentDuration = agentInvs.reduce((sum, e) => sum + (e.duration || 0), 0) / agentInvs.length;
        const maxAgentDuration = Math.max(...agentInvs.map(e => e.duration || 0));
        console.log(`│ Avg Agent Duration:      ${formatDuration(avgAgentDuration).padStart(10)}                        │`);
        console.log(`│ Max Agent Duration:      ${formatDuration(maxAgentDuration).padStart(10)}                        │`);
    }

    console.log('└────────────────────────────────────────────────────────────┘\n');
}

/**
 * Main display function
 */
function displayMetrics() {
    const metrics = loadMetrics();

    console.clear();
    displaySummary(metrics);
    displayAgentBreakdown(metrics);
    displayWorkflowStatus(metrics);
    displayErrorBreakdown(metrics);
    displayHourlyBreakdown(metrics);
    displayDetailedStats(metrics);
    displayRecentActivity(metrics);

    console.log(`Last updated: ${new Date(metrics.lastUpdated).toLocaleString()}`);
    console.log(`Data file: ${METRICS_FILE}\n`);
}

/**
 * Display JSON output
 */
function displayJSON() {
    const metrics = loadMetrics();
    console.log(JSON.stringify(metrics, null, 2));
}

/**
 * Display help
 */
function displayHelp() {
    console.log(`
Metrics Viewer CLI

Usage:
  metrics-viewer.mjs [options]

Options:
  --summary       Display summary statistics (default)
  --json          Display raw JSON data
  --help, -h      Display this help message

Examples:
  metrics-viewer.mjs
  metrics-viewer.mjs --summary
  metrics-viewer.mjs --json
    `);
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case '--json':
        displayJSON();
        break;
    case '--help':
    case '-h':
        displayHelp();
        break;
    case '--summary':
    default:
        displayMetrics();
        break;
}
