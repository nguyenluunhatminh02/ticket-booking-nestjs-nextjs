#!/usr/bin/env node

/**
 * Metrics Collector for Claude Tooling
 * Collects and stores metrics from hook executions and workflows
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const METRICS_DIR = join(__dirname, '..', 'metrics');
const METRICS_FILE = join(METRICS_DIR, 'metrics.json');
const ROTATION_DAYS = 30;

// Ensure metrics directory exists
if (!existsSync(METRICS_DIR)) {
    mkdirSync(METRICS_DIR, { recursive: true });
}

/**
 * Load existing metrics or create new structure
 */
function loadMetrics() {
    if (existsSync(METRICS_FILE)) {
        try {
            const data = readFileSync(METRICS_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading metrics file, creating new one:', error.message);
        }
    }

    return {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        summary: {
            totalHooks: 0,
            totalAgents: 0,
            activeWorkflows: 0,
            completedWorkflows: 0,
            totalErrors: 0,
            errorRate: 0,
            hooksToday: 0,
            agentsToday: 0
        },
        hourlyBreakdown: {},
        agentTypes: {},
        workflowStatus: {},
        errorTypes: {},
        recentActivity: [],
        hookExecutions: [],
        agentInvocations: [],
        workflowExecutions: []
    };
}

/**
 * Save metrics to file
 */
function saveMetrics(metrics) {
    metrics.lastUpdated = new Date().toISOString();
    writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
}

/**
 * Rotate old metrics data
 */
function rotateMetrics(metrics) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ROTATION_DAYS);

    // Filter old entries
    metrics.hookExecutions = metrics.hookExecutions.filter(
        exec => new Date(exec.timestamp) > cutoffDate
    );

    metrics.agentInvocations = metrics.agentInvocations.filter(
        inv => new Date(inv.timestamp) > cutoffDate
    );

    metrics.workflowExecutions = metrics.workflowExecutions.filter(
        exec => new Date(exec.timestamp) > cutoffDate
    );

    metrics.recentActivity = metrics.recentActivity.filter(
        activity => new Date(activity.timestamp) > cutoffDate
    );

    // Rebuild hourly breakdown
    metrics.hourlyBreakdown = {};
    metrics.hookExecutions.forEach(exec => {
        const hour = new Date(exec.timestamp).toISOString().slice(0, 13);
        if (!metrics.hourlyBreakdown[hour]) {
            metrics.hourlyBreakdown[hour] = { hooks: 0, agents: 0, errors: 0 };
        }
        metrics.hourlyBreakdown[hour].hooks++;
    });

    return metrics;
}

/**
 * Record a hook execution
 */
export function recordHookExecution(hookName, status, metadata = {}) {
    const metrics = loadMetrics();

    const execution = {
        timestamp: new Date().toISOString(),
        hookName,
        status,
        duration: metadata.duration || 0,
        metadata
    };

    metrics.hookExecutions.push(execution);
    metrics.summary.totalHooks++;

    // Update today's count
    const today = new Date().toDateString();
    const todayExecutions = metrics.hookExecutions.filter(
        exec => new Date(exec.timestamp).toDateString() === today
    );
    metrics.summary.hooksToday = todayExecutions.length;

    // Update hourly breakdown
    const hour = new Date().toISOString().slice(0, 13);
    if (!metrics.hourlyBreakdown[hour]) {
        metrics.hourlyBreakdown[hour] = { hooks: 0, agents: 0, errors: 0 };
    }
    metrics.hourlyBreakdown[hour].hooks++;

    // Record error if applicable
    if (status === 'error') {
        metrics.summary.totalErrors++;
        const errorType = metadata.errorType || 'unknown';
        metrics.errorTypes[errorType] = (metrics.errorTypes[errorType] || 0) + 1;
        metrics.hourlyBreakdown[hour].errors++;
    }

    // Add to recent activity
    metrics.recentActivity.unshift({
        timestamp: execution.timestamp,
        type: status === 'error' ? 'error' : 'success',
        message: `Hook executed: ${hookName} (${status})`
    });

    // Keep only last 100 activities
    metrics.recentActivity = metrics.recentActivity.slice(0, 100);

    // Update error rate
    const totalExecutions = metrics.summary.totalHooks + metrics.summary.totalAgents;
    metrics.summary.errorRate = totalExecutions > 0
        ? (metrics.summary.totalErrors / totalExecutions) * 100
        : 0;

    // Rotate old data
    const rotatedMetrics = rotateMetrics(metrics);
    saveMetrics(rotatedMetrics);

    return execution;
}

/**
 * Record an agent invocation
 */
export function recordAgentInvocation(agentType, status, metadata = {}) {
    const metrics = loadMetrics();

    const invocation = {
        timestamp: new Date().toISOString(),
        agentType,
        status,
        duration: metadata.duration || 0,
        metadata
    };

    metrics.agentInvocations.push(invocation);
    metrics.summary.totalAgents++;

    // Update agent types
    metrics.agentTypes[agentType] = (metrics.agentTypes[agentType] || 0) + 1;

    // Update today's count
    const today = new Date().toDateString();
    const todayInvocations = metrics.agentInvocations.filter(
        inv => new Date(inv.timestamp).toDateString() === today
    );
    metrics.summary.agentsToday = todayInvocations.length;

    // Update hourly breakdown
    const hour = new Date().toISOString().slice(0, 13);
    if (!metrics.hourlyBreakdown[hour]) {
        metrics.hourlyBreakdown[hour] = { hooks: 0, agents: 0, errors: 0 };
    }
    metrics.hourlyBreakdown[hour].agents++;

    // Record error if applicable
    if (status === 'error') {
        metrics.summary.totalErrors++;
        const errorType = metadata.errorType || 'unknown';
        metrics.errorTypes[errorType] = (metrics.errorTypes[errorType] || 0) + 1;
    }

    // Add to recent activity
    metrics.recentActivity.unshift({
        timestamp: invocation.timestamp,
        type: status === 'error' ? 'error' : 'success',
        message: `Agent invoked: ${agentType} (${status})`
    });

    // Keep only last 100 activities
    metrics.recentActivity = metrics.recentActivity.slice(0, 100);

    // Update error rate
    const totalExecutions = metrics.summary.totalHooks + metrics.summary.totalAgents;
    metrics.summary.errorRate = totalExecutions > 0
        ? (metrics.summary.totalErrors / totalExecutions) * 100
        : 0;

    // Rotate old data
    const rotatedMetrics = rotateMetrics(metrics);
    saveMetrics(rotatedMetrics);

    return invocation;
}

/**
 * Record a workflow execution
 */
export function recordWorkflowExecution(workflowName, status, metadata = {}) {
    const metrics = loadMetrics();

    const execution = {
        timestamp: new Date().toISOString(),
        workflowName,
        status,
        duration: metadata.duration || 0,
        agentsSpawned: metadata.agentsSpawned || 0,
        metadata
    };

    metrics.workflowExecutions.push(execution);

    // Update workflow status
    metrics.workflowStatus[status] = (metrics.workflowStatus[status] || 0) + 1;

    if (status === 'active') {
        metrics.summary.activeWorkflows++;
    } else if (status === 'completed') {
        metrics.summary.completedWorkflows++;
        metrics.summary.activeWorkflows = Math.max(0, metrics.summary.activeWorkflows - 1);
    }

    // Add to recent activity
    metrics.recentActivity.unshift({
        timestamp: execution.timestamp,
        type: status === 'failed' ? 'error' : status === 'completed' ? 'success' : 'info',
        message: `Workflow ${status}: ${workflowName}`
    });

    // Keep only last 100 activities
    metrics.recentActivity = metrics.recentActivity.slice(0, 100);

    // Rotate old data
    const rotatedMetrics = rotateMetrics(metrics);
    saveMetrics(rotatedMetrics);

    return execution;
}

/**
 * Get current metrics summary
 */
export function getMetricsSummary() {
    const metrics = loadMetrics();
    return metrics.summary;
}

/**
 * Get full metrics data
 */
export function getFullMetrics() {
    return loadMetrics();
}

// CLI interface
if (process.argv[1] && process.argv[1].includes('metrics-collector')) {
    const command = process.argv[2];

    switch (command) {
        case 'record-hook':
            const hookName = process.argv[3];
            const hookStatus = process.argv[4] || 'success';
            const hookMeta = process.argv[5] ? JSON.parse(process.argv[5]) : {};
            const hookResult = recordHookExecution(hookName, hookStatus, hookMeta);
            console.log('Hook recorded:', hookResult);
            break;

        case 'record-agent':
            const agentType = process.argv[3];
            const agentStatus = process.argv[4] || 'success';
            const agentMeta = process.argv[5] ? JSON.parse(process.argv[5]) : {};
            const agentResult = recordAgentInvocation(agentType, agentStatus, agentMeta);
            console.log('Agent recorded:', agentResult);
            break;

        case 'record-workflow':
            const workflowName = process.argv[3];
            const workflowStatus = process.argv[4] || 'active';
            const workflowMeta = process.argv[5] ? JSON.parse(process.argv[5]) : {};
            const workflowResult = recordWorkflowExecution(workflowName, workflowStatus, workflowMeta);
            console.log('Workflow recorded:', workflowResult);
            break;

        case 'summary':
            const summary = getMetricsSummary();
            console.log(JSON.stringify(summary, null, 2));
            break;

        case 'full':
            const fullMetrics = getFullMetrics();
            console.log(JSON.stringify(fullMetrics, null, 2));
            break;

        default:
            console.log(`
Metrics Collector CLI

Usage:
  metrics-collector.mjs record-hook <name> <status> [metadata-json]
  metrics-collector.mjs record-agent <type> <status> [metadata-json]
  metrics-collector.mjs record-workflow <name> <status> [metadata-json]
  metrics-collector.mjs summary
  metrics-collector.mjs full

Examples:
  metrics-collector.mjs record-hook pre-commit success
  metrics-collector.mjs record-agent planner success '{"duration":1500}'
  metrics-collector.mjs record-workflow auto-orchestrate completed '{"agentsSpawned":3}'
  metrics-collector.mjs summary
            `);
    }
}
