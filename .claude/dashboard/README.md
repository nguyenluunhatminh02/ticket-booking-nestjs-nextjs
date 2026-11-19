# Claude Tooling Monitoring Dashboard

A comprehensive monitoring system for tracking Claude Code hook executions, agent invocations, workflow progress, and error rates.

## Features

- **Web Dashboard**: Real-time visualization of metrics using Chart.js
- **Metrics Collection**: Automatic recording of hook executions, agent invocations, and workflow runs
- **CLI Tools**: Command-line interfaces for viewing metrics and running health checks
- **Health Checks**: Validate hooks, dependencies, and configurations
- **Data Rotation**: Automatic cleanup of metrics older than 30 days

## Directory Structure

```
.claude/
├── dashboard/
│   ├── index.html              # Web dashboard
│   ├── metrics-collector.mjs   # Metrics collection module
│   ├── metrics-viewer.mjs      # CLI metrics viewer
│   ├── health-check.mjs        # Health check utility
│   └── README.md               # This file
└── metrics/
    └── metrics.json            # Metrics data store
```

## Installation

### 1. Verify Setup

Run the health check to ensure everything is configured correctly:

```bash
node .claude/dashboard/health-check.mjs
```

This will check:
- Node.js version (requires 18.0.0+)
- Project configuration
- Claude configuration files
- Workflow files
- Dashboard files
- Metrics directory

### 2. Make Scripts Executable (Optional)

```bash
chmod +x .claude/dashboard/metrics-collector.mjs
chmod +x .claude/dashboard/metrics-viewer.mjs
chmod +x .claude/dashboard/health-check.mjs
```

## Usage

### Web Dashboard

Open the dashboard in your browser:

```bash
# Option 1: Open directly
open .claude/dashboard/index.html

# Option 2: Serve with a local server
npx http-server .claude/dashboard -p 8080
# Then visit http://localhost:8080
```

The dashboard displays:
- Total hook executions and agent invocations
- Active and completed workflows
- Error rates and error distribution
- Hourly activity breakdown
- Recent activity log
- Charts for visualizing trends

**Note**: The dashboard auto-refreshes every 30 seconds.

### Metrics Collector

Record metrics from your hooks and workflows:

#### Record a Hook Execution

```bash
node .claude/dashboard/metrics-collector.mjs record-hook <hook-name> <status> [metadata-json]

# Examples:
node .claude/dashboard/metrics-collector.mjs record-hook pre-commit success
node .claude/dashboard/metrics-collector.mjs record-hook post-test error '{"errorType":"timeout"}'
```

#### Record an Agent Invocation

```bash
node .claude/dashboard/metrics-collector.mjs record-agent <agent-type> <status> [metadata-json]

# Examples:
node .claude/dashboard/metrics-collector.mjs record-agent planner success '{"duration":1500}'
node .claude/dashboard/metrics-collector.mjs record-agent tester completed '{"duration":3200}'
```

#### Record a Workflow Execution

```bash
node .claude/dashboard/metrics-collector.mjs record-workflow <workflow-name> <status> [metadata-json]

# Examples:
node .claude/dashboard/metrics-collector.mjs record-workflow auto-orchestrate active
node .claude/dashboard/metrics-collector.mjs record-workflow auto-orchestrate completed '{"agentsSpawned":3,"duration":45000}'
```

#### View Metrics Summary

```bash
node .claude/dashboard/metrics-collector.mjs summary
```

#### View Full Metrics Data

```bash
node .claude/dashboard/metrics-collector.mjs full
```

### Metrics Viewer

Display metrics in a human-readable format:

```bash
# Display formatted summary
node .claude/dashboard/metrics-viewer.mjs

# Display raw JSON
node .claude/dashboard/metrics-viewer.mjs --json

# Display help
node .claude/dashboard/metrics-viewer.mjs --help
```

The viewer displays:
- Overview statistics
- Today's activity
- Agent type breakdown with visual bars
- Workflow status breakdown
- Error type distribution
- Hourly activity chart
- Detailed statistics (average/max durations)
- Recent activity log

### Health Check

Validate your Claude tooling setup:

```bash
# Run health checks
node .claude/dashboard/health-check.mjs

# Output as JSON
node .claude/dashboard/health-check.mjs --json

# Display help
node .claude/dashboard/health-check.mjs --help
```

Health checks validate:
- Node.js version compatibility
- package.json existence and validity
- node_modules installation
- Claude configuration files (settings.json, CLAUDE.md)
- Workflow files (existence and executability)
- Dashboard files
- Metrics directory and data
- Git repository status

## Integration with Hooks

To automatically collect metrics from your hooks, add recording calls to your hook scripts:

### Example: Pre-commit Hook

```javascript
#!/usr/bin/env node

import { recordHookExecution } from '../dashboard/metrics-collector.mjs';

const startTime = Date.now();

try {
    // Your hook logic here
    console.log('Running pre-commit checks...');
    
    // Record success
    recordHookExecution('pre-commit', 'success', {
        duration: Date.now() - startTime
    });
} catch (error) {
    // Record error
    recordHookExecution('pre-commit', 'error', {
        duration: Date.now() - startTime,
        errorType: error.name,
        message: error.message
    });
    throw error;
}
```

### Example: Workflow Integration

```javascript
#!/usr/bin/env node

import { recordWorkflowExecution, recordAgentInvocation } from '../dashboard/metrics-collector.mjs';

const startTime = Date.now();

// Record workflow start
recordWorkflowExecution('my-workflow', 'active');

try {
    // Spawn agents
    const agentsSpawned = 3;
    
    // Record agent invocations
    for (let i = 0; i < agentsSpawned; i++) {
        recordAgentInvocation(`agent-${i}`, 'success', {
            duration: 1500
        });
    }
    
    // Record workflow completion
    recordWorkflowExecution('my-workflow', 'completed', {
        duration: Date.now() - startTime,
        agentsSpawned
    });
} catch (error) {
    // Record workflow failure
    recordWorkflowExecution('my-workflow', 'failed', {
        duration: Date.now() - startTime,
        error: error.message
    });
    throw error;
}
```

## Metrics Data Structure

The metrics are stored in `.claude/metrics/metrics.json` with the following structure:

```json
{
  "version": "1.0.0",
  "createdAt": "2026-11-09T10:00:00.000Z",
  "lastUpdated": "2026-11-09T12:00:00.000Z",
  "summary": {
    "totalHooks": 150,
    "totalAgents": 45,
    "activeWorkflows": 2,
    "completedWorkflows": 28,
    "totalErrors": 5,
    "errorRate": 2.56,
    "hooksToday": 23,
    "agentsToday": 8
  },
  "hourlyBreakdown": {
    "2026-11-09T10": { "hooks": 15, "agents": 5, "errors": 1 },
    "2026-11-09T11": { "hooks": 20, "agents": 8, "errors": 0 }
  },
  "agentTypes": {
    "planner": 12,
    "tester": 18,
    "code-reviewer": 15
  },
  "workflowStatus": {
    "completed": 28,
    "failed": 2,
    "active": 2
  },
  "errorTypes": {
    "timeout": 3,
    "validation": 2
  },
  "recentActivity": [
    {
      "timestamp": "2026-11-09T12:00:00.000Z",
      "type": "success",
      "message": "Hook executed: pre-commit (success)"
    }
  ],
  "hookExecutions": [...],
  "agentInvocations": [...],
  "workflowExecutions": [...]
}
```

## Data Rotation

Metrics older than 30 days are automatically removed when:
- Recording new hook executions
- Recording new agent invocations
- Recording new workflow executions

This prevents the metrics file from growing indefinitely while maintaining recent historical data.

## Troubleshooting

### Dashboard Not Loading Data

1. Ensure the metrics file exists: `.claude/metrics/metrics.json`
2. Check browser console for CORS errors (use a local server instead of file:// protocol)
3. Verify the metrics file is valid JSON

### Metrics Not Being Recorded

1. Run the health check: `node .claude/dashboard/health-check.mjs`
2. Ensure the metrics directory exists: `.claude/metrics/`
3. Check file permissions on the metrics directory
4. Verify the metrics-collector.mjs script is executable

### Health Check Failures

- **Node.js version**: Upgrade to Node.js 18.0.0 or higher
- **node_modules not found**: Run `npm install`
- **settings.json not found**: Create `.claude/settings.json` with your configuration
- **Workflow not executable**: Run `chmod +x .claude/workflows/<workflow>.js`

## Advanced Usage

### Custom Metrics

You can extend the metrics collector to track custom events:

```javascript
import { loadMetrics, saveMetrics } from './metrics-collector.mjs';

const metrics = loadMetrics();

// Add custom metric
metrics.customMetrics = metrics.customMetrics || {};
metrics.customMetrics.myMetric = (metrics.customMetrics.myMetric || 0) + 1;

saveMetrics(metrics);
```

### Exporting Metrics

Export metrics to CSV or other formats:

```bash
# Export to JSON
node .claude/dashboard/metrics-viewer.mjs --json > metrics-export.json

# Process with jq
node .claude/dashboard/metrics-viewer.mjs --json | jq '.summary'
```

### Automated Health Checks

Add health checks to your CI/CD pipeline:

```yaml
# .github/workflows/health-check.yml
name: Claude Tooling Health Check
on: [push, pull_request]
jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run health check
        run: node .claude/dashboard/health-check.mjs --json > health-report.json
      - name: Check health score
        run: |
          score=$(cat health-report.json | jq '.passed / (.passed + .warnings + .errors) * 100')
          if (( $(echo "$score < 70" | bc -l) )); then
            echo "Health score too low: $score%"
            exit 1
          fi
```

## Requirements

- Node.js 18.0.0 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)
- File system access for metrics storage

## License

This monitoring dashboard is part of the Claude Code tooling ecosystem.

## Support

For issues or questions:
1. Run the health check to diagnose problems
2. Check the metrics file for data integrity
3. Review the dashboard browser console for errors
4. Consult the Claude Code documentation
