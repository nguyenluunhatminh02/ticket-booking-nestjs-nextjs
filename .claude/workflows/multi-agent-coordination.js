#!/usr/bin/env node

/**
 * @fileoverview Multi-Agent Coordination System
 * @module workflows/multi-agent-coordination
 * @description Coordinates multiple specialized agents for complex tasks with task decomposition,
 * agent specialization and routing, state management and synchronization, conflict resolution,
 * and progress tracking and reporting. Provides a complete framework for orchestrating
 * multiple AI agents working on different aspects of a task.
 * @version 1.0.0
 * @author Mastery Node.js Project
 */

const fs = require('fs');
const path = require('path');

/**
 * Agent Coordination system for managing multiple specialized agents
 * @class AgentCoordination
 * @description Manages agent registration, task decomposition, assignment, execution,
 * and conflict resolution for multi-agent workflows.
 *
 * @example
 * const coordination = new AgentCoordination();
 * coordination.registerAgent('agent1', 'planner', { speed: 'fast' });
 * const task = coordination.decomposeTask('Implement user authentication');
 * console.log(task.subtasks);
 */
class AgentCoordination {
  /**
   * Creates a new AgentCoordination instance
   * @constructor
   */
  constructor() {
    /** @type {Map<string, Object>} Map of agent IDs to agent objects */
    this.agents = new Map();
    /** @type {Map<string, Object>} Map of task IDs to task objects */
    this.tasks = new Map();

    /**
     * Coordination state
     * @type {Object}
     * @property {string} status - Current status ('idle', 'running', 'completed')
     * @property {Array<string>} activeTasks - Currently active task IDs
     * @property {Array<string>} completedTasks - Completed task IDs
     * @property {Array<string>} failedTasks - Failed task IDs
     * @property {number|null} startTime - Start timestamp
     * @property {number|null} endTime - End timestamp
     */
    this.state = {
      status: 'idle',
      activeTasks: [],
      completedTasks: [],
      failedTasks: [],
      startTime: null,
      endTime: null
    };

    /**
     * Agent type specializations with roles and priorities
     * @type {Object<string, Object>}
     * @property {Object} planner - Task decomposition agent (priority 1)
     * @property {Object} implementer - Code implementation agent (priority 2)
     * @property {Object} tester - Test creation agent (priority 3)
     * @property {Object} reviewer - Code review agent (priority 4)
     * @property {Object} debugger - Bug fixing agent (priority 5)
     * @property {Object} documenter - Documentation agent (priority 6)
     */
    this.agentTypes = {
      'planner': { role: 'task_decomposition', priority: 1 },
      'implementer': { role: 'code_implementation', priority: 2 },
      'tester': { role: 'test_creation', priority: 3 },
      'reviewer': { role: 'code_review', priority: 4 },
      'debugger': { role: 'bug_fixing', priority: 5 },
      'documenter': { role: 'documentation', priority: 6 }
    };
  }

  /**
   * Register a new agent with the coordination system
   * @param {string} agentId - Unique agent identifier
   * @param {string} agentType - Agent type (planner, implementer, tester, reviewer, debugger, documenter)
   * @param {Object} [capabilities={}] - Agent capabilities
   * @returns {Object} Registration result
   * @returns {boolean} returns.success - True if registration succeeded
   * @returns {string} returns.agentId - Registered agent ID
   * @throws {Error} If agent type is unknown
   */
  registerAgent(agentId, agentType, capabilities = {}) {
    if (!this.agentTypes[agentType]) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    this.agents.set(agentId, {
      id: agentId,
      type: agentType,
      capabilities,
      status: 'idle',
      currentTask: null,
      completedTasks: [],
      registeredAt: Date.now()
    });

    return { success: true, agentId };
  }

  /**
   * Decompose a complex task into subtasks
   * @param {string} taskDescription - Task description to decompose
   * @param {Object} [options={}] - Task options
   * @returns {Object} Task object with subtasks and dependencies
   * @returns {string} returns.id - Task ID
   * @returns {string} returns.description - Task description
   * @returns {string} returns.status - Task status ('pending')
   * @returns {Array<Object>} returns.subtasks - Array of subtask objects
   * @returns {Array<Object>} returns.dependencies - Dependency relationships
   * @returns {string|null} returns.assignedAgent - Assigned agent ID
   * @returns {number} returns.createdAt - Creation timestamp
   */
  decomposeTask(taskDescription, options = {}) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const task = {
      id: taskId,
      description: taskDescription,
      status: 'pending',
      subtasks: [],
      dependencies: [],
      assignedAgent: null,
      createdAt: Date.now(),
      options
    };

    // Analyze task and create subtasks
    task.subtasks = this.analyzeAndCreateSubtasks(taskDescription);

    // Determine dependencies
    task.dependencies = this.determineDependencies(task.subtasks);

    this.tasks.set(taskId, task);

    return task;
  }

  /**
   * Analyze task description and create appropriate subtasks
   * @param {string} description - Task description
   * @returns {Array<Object>} Array of subtask objects
   * @returns {string} returns[].id - Subtask ID
   * @returns {string} returns[].type - Subtask type (planning, implementation, testing, review, documentation)
   * @returns {string} returns[].description - Subtask description
   * @returns {string} returns[].agentType - Required agent type
   * @returns {string} returns[].status - Subtask status ('pending')
   * @returns {number} returns[].priority - Priority level (1-5)
   * @returns {Array<string>} [returns[].dependsOn] - Dependencies
   * @description Creates subtasks based on keywords:
   *   - 'implement/create/build' triggers planning phase
   *   - Always creates implementation, testing, and review phases
   *   - 'feature/api/module' triggers documentation phase
   */
  analyzeAndCreateSubtasks(description) {
    const subtasks = [];
    const lowerDesc = description.toLowerCase();

    // Generate unique base ID with counter to prevent duplicates
    const baseId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let taskCounter = 0;

    // Planning phase
    if (lowerDesc.includes('implement') || lowerDesc.includes('create') || lowerDesc.includes('build')) {
      subtasks.push({
        id: `subtask_${baseId}_${taskCounter++}_plan`,
        type: 'planning',
        description: 'Analyze requirements and create implementation plan',
        agentType: 'planner',
        status: 'pending',
        priority: 1
      });
    }

    // Implementation phase
    subtasks.push({
      id: `subtask_${baseId}_${taskCounter++}_impl`,
      type: 'implementation',
      description: 'Implement the feature/fix',
      agentType: 'implementer',
      status: 'pending',
      priority: 2,
      dependsOn: ['planning']
    });

    // Testing phase
    subtasks.push({
      id: `subtask_${baseId}_${taskCounter++}_test`,
      type: 'testing',
      description: 'Create and run tests',
      agentType: 'tester',
      status: 'pending',
      priority: 3,
      dependsOn: ['implementation']
    });

    // Review phase
    subtasks.push({
      id: `subtask_${baseId}_${taskCounter++}_review`,
      type: 'review',
      description: 'Code review and quality check',
      agentType: 'reviewer',
      status: 'pending',
      priority: 4,
      dependsOn: ['testing']
    });

    // Documentation phase (if needed)
    if (lowerDesc.includes('feature') || lowerDesc.includes('api') || lowerDesc.includes('module')) {
      subtasks.push({
        id: `subtask_${baseId}_${taskCounter++}_docs`,
        type: 'documentation',
        description: 'Update documentation',
        agentType: 'documenter',
        status: 'pending',
        priority: 5,
        dependsOn: ['review']
      });
    }

    return subtasks;
  }

  /**
   * Determine task dependencies from subtasks
   * @param {Array<Object>} subtasks - Array of subtask objects
   * @returns {Array<Object>} Array of dependency objects
   * @returns {string} returns[].from - Source subtask ID
   * @returns {Array<string>} returns[].to - Target subtask IDs
   */
  determineDependencies(subtasks) {
    const dependencies = [];

    for (let i = 1; i < subtasks.length; i++) {
      if (subtasks[i].dependsOn) {
        dependencies.push({
          from: subtasks[i].id,
          to: subtasks[i].dependsOn
        });
      }
    }

    return dependencies;
  }

  /**
   * Assign a subtask to an appropriate agent
   * @param {string} taskId - Task ID
   * @param {string} subtaskId - Subtask ID to assign
   * @returns {Object} Assignment result
   * @returns {boolean} returns.success - True if assignment succeeded
   * @returns {string} [returns.agentId] - Assigned agent ID (if success)
   * @returns {string} [returns.reason] - Failure reason (if failed)
   * @throws {Error} If task or subtask not found
   */
  assignTask(taskId, subtaskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const subtask = task.subtasks.find(st => st.id === subtaskId);
    if (!subtask) {
      throw new Error(`Subtask not found: ${subtaskId}`);
    }

    // Find available agent of appropriate type
    const availableAgent = this.findAvailableAgent(subtask.agentType);

    if (!availableAgent) {
      return { success: false, reason: 'No available agent' };
    }

    // Assign task
    subtask.assignedAgent = availableAgent.id;
    subtask.status = 'in_progress';
    availableAgent.status = 'busy';
    availableAgent.currentTask = { taskId, subtaskId };

    return { success: true, agentId: availableAgent.id };
  }

  /**
   * Find an available agent of the specified type
   * @param {string} agentType - Required agent type
   * @returns {Object|null} Available agent object or null if none available
   */
  findAvailableAgent(agentType) {
    for (const [agentId, agent] of this.agents) {
      if (agent.type === agentType && agent.status === 'idle') {
        return agent;
      }
    }
    return null;
  }

  /**
   * Complete a subtask and free up the assigned agent
   * @param {string} taskId - Task ID
   * @param {string} subtaskId - Subtask ID to complete
   * @param {Object} [result={}] - Completion result data
   * @returns {Object} Completion result
   * @returns {boolean} returns.success - True if completion succeeded
   * @returns {boolean} returns.allComplete - True if all subtasks are complete
   * @throws {Error} If task or subtask not found
   */
  completeSubtask(taskId, subtaskId, result = {}) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const subtask = task.subtasks.find(st => st.id === subtaskId);
    if (!subtask) {
      throw new Error(`Subtask not found: ${subtaskId}`);
    }

    // Update subtask status
    subtask.status = 'completed';
    subtask.completedAt = Date.now();
    subtask.result = result;

    // Free up agent
    if (subtask.assignedAgent) {
      const agent = this.agents.get(subtask.assignedAgent);
      if (agent) {
        agent.status = 'idle';
        agent.currentTask = null;
        agent.completedTasks.push({ taskId, subtaskId });
      }
    }

    // Check if all subtasks complete
    const allComplete = task.subtasks.every(st => st.status === 'completed');
    if (allComplete) {
      task.status = 'completed';
      task.completedAt = Date.now();
      this.state.completedTasks.push(taskId);
    }

    return { success: true, allComplete };
  }

  /**
   * Handle subtask failure and free up the assigned agent
   * @param {string} taskId - Task ID
   * @param {string} subtaskId - Subtask ID that failed
   * @param {Error|string} error - Error object or message
   * @returns {Object} Failure result
   * @returns {boolean} returns.success - True (always succeeds in recording failure)
   * @throws {Error} If task or subtask not found
   */
  failSubtask(taskId, subtaskId, error) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const subtask = task.subtasks.find(st => st.id === subtaskId);
    if (!subtask) {
      throw new Error(`Subtask not found: ${subtaskId}`);
    }

    subtask.status = 'failed';
    subtask.error = error;
    subtask.failedAt = Date.now();

    // Free up agent
    if (subtask.assignedAgent) {
      const agent = this.agents.get(subtask.assignedAgent);
      if (agent) {
        agent.status = 'idle';
        agent.currentTask = null;
      }
    }

    this.state.failedTasks.push({ taskId, subtaskId, error });

    return { success: true };
  }

  /**
   * Get execution plan for a task with dependency resolution
   * @param {string} taskId - Task ID
   * @returns {Object} Execution plan
   * @returns {string} returns.taskId - Task ID
   * @returns {string} returns.description - Task description
   * @returns {number} returns.totalSubtasks - Total subtask count
   * @returns {Array<Array<string>>} returns.executionOrder - Ordered groups of subtask IDs
   * @returns {Array<Array<string>>} returns.parallelOpportunities - Parallel execution groups
   * @returns {string} returns.estimatedComplexity - Complexity estimate ('low', 'medium', 'high')
   * @throws {Error} If task not found or circular dependency detected
   */
  getExecutionPlan(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const plan = {
      taskId,
      description: task.description,
      totalSubtasks: task.subtasks.length,
      executionOrder: [],
      parallelOpportunities: [],
      estimatedComplexity: this.estimateComplexity(task)
    };

    // Determine execution order based on dependencies
    const completed = new Set();
    const remaining = [...task.subtasks];

    while (remaining.length > 0) {
      const ready = remaining.filter(st => {
        if (!st.dependsOn) return true;
        return st.dependsOn.every(dep => completed.has(dep));
      });

      if (ready.length === 0) {
        throw new Error('Circular dependency detected');
      }

      plan.executionOrder.push(ready.map(st => st.id));

      if (ready.length > 1) {
        plan.parallelOpportunities.push(ready.map(st => st.id));
      }

      ready.forEach(st => {
        completed.add(st.type);
        remaining.splice(remaining.indexOf(st), 1);
      });
    }

    return plan;
  }

  /**
   * Estimate task complexity based on subtasks and dependencies
   * @param {Object} task - Task object
   * @returns {string} Complexity estimate ('low', 'medium', 'high')
   * @description Scoring:
   *   - Each subtask: +10 points
   *   - Each dependency: +5 points
   *   - Each unique agent type: +15 points
   *   - <30 points: 'low'
   *   - 30-59 points: 'medium'
   *   - >=60 points: 'high'
   */
  estimateComplexity(task) {
    let complexity = 0;

    complexity += task.subtasks.length * 10;
    complexity += task.dependencies.length * 5;

    const types = new Set(task.subtasks.map(st => st.agentType));
    complexity += types.size * 15;

    if (complexity < 30) return 'low';
    if (complexity < 60) return 'medium';
    return 'high';
  }

  /**
   * Get current coordination status
   * @returns {Object} Status object with state, agents, and tasks
   * @returns {Object} returns.state - Coordination state
   * @returns {Array<Object>} returns.agents - Agent status array
   * @returns {Array<Object>} returns.tasks - Task status array with progress
   */
  getStatus() {
    return {
      state: this.state,
      agents: Array.from(this.agents.values()).map(a => ({
        id: a.id,
        type: a.type,
        status: a.status,
        currentTask: a.currentTask
      })),
      tasks: Array.from(this.tasks.values()).map(t => ({
        id: t.id,
        description: t.description,
        status: t.status,
        progress: this.calculateProgress(t)
      }))
    };
  }

  /**
   * Calculate task progress percentage
   * @param {Object} task - Task object
   * @returns {number} Progress percentage (0-100)
   */
  calculateProgress(task) {
    if (task.subtasks.length === 0) return 0;

    const completed = task.subtasks.filter(st => st.status === 'completed').length;
    return Math.round((completed / task.subtasks.length) * 100);
  }

  /**
   * Resolve conflicts between agents
   * @param {Object} conflict - Conflict object
   * @param {string} conflict.type - Conflict type ('resource_contention', 'data_conflict', etc.)
   * @param {Array<string>} conflict.agents - Conflicting agent IDs
   * @returns {Object} Resolution result
   * @returns {string} returns.type - Conflict type
   * @returns {Array<string>} returns.agents - Conflicting agents
   * @returns {string} returns.strategy - Resolution strategy ('priority', 'queue', 'merge')
   * @returns {boolean} returns.resolved - True if resolved
   * @returns {number|null} returns.resolvedAt - Resolution timestamp
   */
  resolveConflict(conflict) {
    const resolution = {
      type: conflict.type,
      agents: conflict.agents,
      strategy: this.determineResolutionStrategy(conflict),
      resolved: false,
      resolvedAt: null
    };

    // Apply resolution strategy
    switch (resolution.strategy) {
      case 'priority':
        resolution.resolved = true;
        resolution.winner = conflict.agents[0]; // Higher priority agent wins
        break;
      case 'queue':
        resolution.resolved = true;
        resolution.queue = conflict.agents;
        break;
      case 'merge':
        resolution.resolved = true;
        resolution.merged = true;
        break;
    }

    if (resolution.resolved) {
      resolution.resolvedAt = Date.now();
    }

    return resolution;
  }

  /**
   * Determine resolution strategy for a conflict
   * @param {Object} conflict - Conflict object
   * @returns {string} Resolution strategy ('priority', 'queue', 'merge')
   * @description Strategy selection:
   *   - 'resource_contention' -> 'priority' (higher priority agent wins)
   *   - 'data_conflict' -> 'merge' (merge changes)
   *   - default -> 'queue' (queue agents)
   */
  determineResolutionStrategy(conflict) {
    if (conflict.type === 'resource_contention') {
      return 'priority';
    }
    if (conflict.type === 'data_conflict') {
      return 'merge';
    }
    return 'queue';
  }
}

/**
 * CLI interface for multi-agent coordination
 * @description Commands:
 *   - status: Get coordination status
 *   - decompose "<description>": Decompose task into subtasks
 *   - plan <taskId>: Get execution plan
 */
if (require.main === module) {
  const coordination = new AgentCoordination();
  const command = process.argv[2];

  switch (command) {
    case 'status':
      console.log(JSON.stringify(coordination.getStatus(), null, 2));
      break;

    case 'decompose':
      const taskDesc = process.argv[3];
      if (!taskDesc) {
        console.error('Usage: multi-agent-coordination.js decompose "<task description>"');
        process.exit(1);
      }
      const task = coordination.decomposeTask(taskDesc);
      console.log(JSON.stringify(task, null, 2));
      break;

    case 'plan':
      const taskId = process.argv[3];
      if (!taskId) {
        console.error('Usage: multi-agent-coordination.js plan <taskId>');
        process.exit(1);
      }
      const plan = coordination.getExecutionPlan(taskId);
      console.log(JSON.stringify(plan, null, 2));
      break;

    default:
      console.log('Multi-Agent Coordination System');
      console.log('Commands:');
      console.log('  status                          - Get coordination status');
      console.log('  decompose "<description>"       - Decompose task into subtasks');
      console.log('  plan <taskId>                   - Get execution plan');
  }
}

module.exports = AgentCoordination;
