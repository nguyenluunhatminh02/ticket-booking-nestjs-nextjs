#!/usr/bin/env node

/**
 * @fileoverview Task Graph Visualizer - Interactive dependency graph visualization
 * @module scripts/task-graph
 * @description Generates interactive HTML visualizations for task dependency graphs using
 * Graph Engineering patterns. Displays task nodes with complexity, status, risk levels,
 * dependencies, critical paths, execution waves, and teaching opportunities.
 *
 * Usage:
 *   node .claude/scripts/task-graph.js [task-graph.json]
 *
 * Input: JSON file with task graph structure (or stdin)
 * Output: Interactive HTML visualization
 *
 * @version 1.0.0
 * @author Mastery Node.js Project
 */

const fs = require('fs');
const path = require('path');

/**
 * Default task graph structure for demonstration
 * @type {Object}
 * @property {string} title - Graph title
 * @property {Array<Object>} nodes - Task nodes
 * @property {Array<Object>} edges - Dependency edges
 * @property {Array<string>} critical_path - Critical path task IDs
 * @property {Array<Object>} execution_waves - Parallel execution waves
 * @property {Array<Object>} teaching_opportunities - Learning opportunities
 */
const defaultTaskGraph = {
  title: "Sample Task Graph",
  nodes: [
    {
      id: "task-db-schema",
      title: "Database Schema",
      complexity: "S",
      status: "completed",
      risk: "Low",
      requires: ["database-knowledge"],
      produces: ["schema-definition"],
      depends_on: [],
      blocks: ["task-api-endpoints", "task-auth"]
    },
    {
      id: "task-auth",
      title: "Auth Middleware",
      complexity: "M",
      status: "in-progress",
      risk: "Medium",
      requires: ["jwt-knowledge"],
      produces: ["auth-checker"],
      depends_on: ["task-db-schema"],
      blocks: ["task-protected-routes"]
    },
    {
      id: "task-api-endpoints",
      title: "API Endpoints",
      complexity: "L",
      status: "pending",
      risk: "Medium",
      requires: ["express-knowledge"],
      produces: ["api-routes"],
      depends_on: ["task-db-schema"],
      blocks: ["task-frontend-integration"]
    },
    {
      id: "task-frontend-integration",
      title: "Frontend Integration",
      complexity: "L",
      status: "pending",
      risk: "High",
      requires: ["react-knowledge"],
      produces: ["ui-components"],
      depends_on: ["task-api-endpoints"],
      blocks: ["task-tests"]
    },
    {
      id: "task-tests",
      title: "Test Suite",
      complexity: "M",
      status: "pending",
      risk: "Low",
      requires: ["testing-knowledge"],
      produces: ["test-coverage"],
      depends_on: ["task-frontend-integration"],
      blocks: []
    }
  ],
  edges: [
    { from: "task-db-schema", to: "task-auth", type: "hard" },
    { from: "task-db-schema", to: "task-api-endpoints", type: "hard" },
    { from: "task-auth", to: "task-protected-routes", type: "hard" },
    { from: "task-api-endpoints", to: "task-frontend-integration", type: "hard" },
    { from: "task-frontend-integration", to: "task-tests", type: "hard" }
  ],
  critical_path: ["task-db-schema", "task-api-endpoints", "task-frontend-integration", "task-tests"],
  execution_waves: [
    { wave: 1, tasks: ["task-db-schema"] },
    { wave: 2, tasks: ["task-auth", "task-api-endpoints"] },
    { wave: 3, tasks: ["task-frontend-integration"] },
    { wave: 4, tasks: ["task-tests"] }
  ],
  teaching_opportunities: [
    {
      task: "task-auth",
      skill: "jwt-authentication",
      module: "jwt-basics-15min",
      scheduled_before: "task-auth"
    }
  ]
};

/**
 * Generate interactive HTML visualization from task graph
 * @param {Object} taskGraph - Task graph data structure
 * @param {string} taskGraph.title - Graph title
 * @param {Array<Object>} taskGraph.nodes - Task nodes with id, title, complexity, status, risk, depends_on, blocks
 * @param {Array<string>} [taskGraph.critical_path] - Critical path task IDs
 * @param {Array<Object>} [taskGraph.execution_waves] - Parallel execution waves
 * @param {Array<Object>} [taskGraph.teaching_opportunities] - Learning opportunities
 * @returns {string} Complete HTML document with embedded CSS and data visualization
 * @description Generates a responsive HTML page with:
 *   - Header with title and subtitle
 *   - Statistics cards (total tasks, completed, in-progress, execution waves)
 *   - All tasks list with complexity and risk badges
 *   - Critical path visualization with arrows
 *   - Execution waves showing parallel tasks
 *   - Teaching opportunities section
 *   - Color-coded legend
 */
function generateHTML(taskGraph) {
  const title = taskGraph.title || "Task Graph Visualization";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
      padding: 20px;
      min-height: 100vh;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }

    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    .header p {
      opacity: 0.9;
      font-size: 1.1em;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
      border-bottom: 2px solid #e9ecef;
    }

    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }

    .stat-value {
      font-size: 2.5em;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 5px;
    }

    .stat-label {
      color: #6c757d;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      padding: 30px;
    }

    @media (max-width: 968px) {
      .content {
        grid-template-columns: 1fr;
      }
    }

    .section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .section h2 {
      color: #667eea;
      margin-bottom: 20px;
      font-size: 1.5em;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }

    .task-list {
      list-style: none;
    }

    .task-item {
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 6px;
      border-left: 4px solid #667eea;
      background: #f8f9fa;
      transition: all 0.3s ease;
    }

    .task-item:hover {
      transform: translateX(5px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .task-item.completed {
      border-left-color: #28a745;
      background: #d4edda;
    }

    .task-item.in-progress {
      border-left-color: #ffc107;
      background: #fff3cd;
    }

    .task-item.pending {
      border-left-color: #6c757d;
      background: #e9ecef;
    }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .task-title {
      font-weight: bold;
      font-size: 1.1em;
      color: #333;
    }

    .task-badges {
      display: flex;
      gap: 8px;
    }

    .badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: bold;
      text-transform: uppercase;
    }

    .badge.complexity-s { background: #d4edda; color: #155724; }
    .badge.complexity-m { background: #fff3cd; color: #856404; }
    .badge.complexity-l { background: #ffe5e5; color: #721c24; }
    .badge.complexity-xl { background: #f8d7da; color: #721c24; }

    .badge.risk-low { background: #d4edda; color: #155724; }
    .badge.risk-medium { background: #fff3cd; color: #856404; }
    .badge.risk-high { background: #ffe5e5; color: #721c24; }
    .badge.risk-critical { background: #f8d7da; color: #721c24; }

    .task-details {
      font-size: 0.9em;
      color: #6c757d;
      margin-top: 8px;
    }

    .critical-path {
      background: linear-gradient(135deg, #ffe5e5 0%, #fff 100%);
      border: 2px solid #dc3545;
    }

    .critical-path h2 {
      color: #dc3545;
      border-bottom-color: #dc3545;
    }

    .path-item {
      padding: 12px;
      margin-bottom: 8px;
      background: white;
      border-radius: 6px;
      border-left: 4px solid #dc3545;
      font-weight: 500;
    }

    .path-arrow {
      text-align: center;
      color: #dc3545;
      font-size: 1.5em;
      margin: 5px 0;
    }

    .wave-list {
      list-style: none;
    }

    .wave-item {
      padding: 15px;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
      border-radius: 6px;
      border-left: 4px solid #667eea;
    }

    .wave-header {
      font-weight: bold;
      color: #667eea;
      margin-bottom: 8px;
    }

    .wave-tasks {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .wave-task {
      padding: 6px 12px;
      background: white;
      border-radius: 4px;
      font-size: 0.9em;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .teaching-item {
      padding: 15px;
      margin-bottom: 10px;
      background: linear-gradient(135deg, #e7f3ff 0%, #fff 100%);
      border-radius: 6px;
      border-left: 4px solid #007bff;
    }

    .teaching-header {
      font-weight: bold;
      color: #007bff;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .teaching-icon {
      font-size: 1.2em;
    }

    .teaching-details {
      font-size: 0.9em;
      color: #6c757d;
    }

    .legend {
      padding: 20px;
      background: #f8f9fa;
      border-top: 2px solid #e9ecef;
    }

    .legend h3 {
      color: #667eea;
      margin-bottom: 15px;
    }

    .legend-items {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .legend-color {
      width: 20px;
      height: 20px;
      border-radius: 4px;
    }

    .legend-color.completed { background: #28a745; }
    .legend-color.in-progress { background: #ffc107; }
    .legend-color.pending { background: #6c757d; }
    .legend-color.critical { background: #dc3545; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <p>Graph Engineering: 9-Stage Pipeline Visualization</p>
    </div>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${taskGraph.nodes.length}</div>
        <div class="stat-label">Total Tasks</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${taskGraph.nodes.filter(n => n.status === 'completed').length}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${taskGraph.nodes.filter(n => n.status === 'in-progress').length}</div>
        <div class="stat-label">In Progress</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${taskGraph.execution_waves ? taskGraph.execution_waves.length : 0}</div>
        <div class="stat-label">Execution Waves</div>
      </div>
    </div>

    <div class="content">
      <div class="section">
        <h2>All Tasks</h2>
        <ul class="task-list">
          ${taskGraph.nodes.map(node => `
            <li class="task-item ${node.status}">
              <div class="task-header">
                <div class="task-title">${node.title}</div>
                <div class="task-badges">
                  <span class="badge complexity-${node.complexity.toLowerCase()}">${node.complexity}</span>
                  <span class="badge risk-${node.risk.toLowerCase()}">${node.risk}</span>
                </div>
              </div>
              <div class="task-details">
                <strong>Status:</strong> ${node.status}<br>
                <strong>Dependencies:</strong> ${node.depends_on.length > 0 ? node.depends_on.join(', ') : 'None'}<br>
                <strong>Blocks:</strong> ${node.blocks.length > 0 ? node.blocks.join(', ') : 'None'}
              </div>
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="section critical-path">
        <h2>Critical Path</h2>
        ${taskGraph.critical_path ? taskGraph.critical_path.map((taskId, index) => {
          const task = taskGraph.nodes.find(n => n.id === taskId);
          return `
            ${index > 0 ? '<div class="path-arrow">↓</div>' : ''}
            <div class="path-item">
              ${task ? task.title : taskId}
            </div>
          `;
        }).join('') : '<p>No critical path defined</p>'}
      </div>

      <div class="section">
        <h2>Execution Waves</h2>
        <ul class="wave-list">
          ${taskGraph.execution_waves ? taskGraph.execution_waves.map(wave => `
            <li class="wave-item">
              <div class="wave-header">Wave ${wave.wave}</div>
              <div class="wave-tasks">
                ${wave.tasks.map(taskId => {
                  const task = taskGraph.nodes.find(n => n.id === taskId);
                  return `<div class="wave-task">${task ? task.title : taskId}</div>`;
                }).join('')}
              </div>
            </li>
          `).join('') : '<p>No execution waves defined</p>'}
        </ul>
      </div>

      <div class="section">
        <h2>Teaching Opportunities</h2>
        ${taskGraph.teaching_opportunities && taskGraph.teaching_opportunities.length > 0 ?
          taskGraph.teaching_opportunities.map(opp => {
            const task = taskGraph.nodes.find(n => n.id === opp.task);
            return `
              <div class="teaching-item">
                <div class="teaching-header">
                  <span class="teaching-icon">📚</span>
                  ${opp.skill}
                </div>
                <div class="teaching-details">
                  <strong>Task:</strong> ${task ? task.title : opp.task}<br>
                  <strong>Module:</strong> ${opp.module}<br>
                  <strong>Scheduled Before:</strong> ${opp.scheduled_before}
                </div>
              </div>
            `;
          }).join('') : '<p>No teaching opportunities identified</p>'}
      </div>
    </div>

    <div class="legend">
      <h3>Legend</h3>
      <div class="legend-items">
        <div class="legend-item">
          <div class="legend-color completed"></div>
          <span>Completed</span>
        </div>
        <div class="legend-item">
          <div class="legend-color in-progress"></div>
          <span>In Progress</span>
        </div>
        <div class="legend-item">
          <div class="legend-color pending"></div>
          <span>Pending</span>
        </div>
        <div class="legend-item">
          <div class="legend-color critical"></div>
          <span>Critical Path</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Main execution function - CLI interface
 * @description Reads task graph from file or uses default, generates HTML visualization
 */
function main() {
  const args = process.argv.slice(2);
  let taskGraph;

  if (args.length > 0) {
    // Read from file
    const filePath = path.resolve(args[0]);
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      taskGraph = JSON.parse(content);
    } catch (error) {
      console.error(`Error reading/parsing file: ${error.message}`);
      process.exit(1);
    }
  } else {
    // Use default task graph
    console.log('No input file provided. Using default task graph.');
    console.log('Usage: node task-graph.js <task-graph.json>');
    taskGraph = defaultTaskGraph;
  }

  // Generate HTML
  const html = generateHTML(taskGraph);

  // Output to file
  const outputPath = path.join(process.cwd(), 'task-graph-visualization.html');
  fs.writeFileSync(outputPath, html, 'utf8');

  console.log(`\nVisualization generated successfully!`);
  console.log(`Output: ${outputPath}`);
  console.log(`\nOpen this file in your browser to view the interactive task graph.`);
}

main();
