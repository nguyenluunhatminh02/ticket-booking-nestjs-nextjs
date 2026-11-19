#!/usr/bin/env node

/**
 * @fileoverview Messaging Protocol Library for inter-agent communication
 * @module lib/messaging
 * @description Handles structured message passing between agents with support for
 * different message types, priority levels, correlation IDs, and message handlers.
 * Provides a complete messaging infrastructure for multi-agent coordination.
 * @version 1.0.0
 * @author Mastery Node.js Project
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../../test-utils/logger');

// Create logger for messaging module
const logger = createLogger({ module: 'messaging' });

/**
 * Messaging Protocol implementation for structured inter-agent communication
 * @class MessagingProtocol
 * @description Provides a complete messaging system with support for task delegation,
 * result reporting, error handling, status updates, and query/response patterns.
 *
 * @example
 * const messaging = new MessagingProtocol();
 * const msgId = messaging.sendTask('agent1', 'agent2', 'processData', {
 *   context: { data: [...] },
 *   requirements: ['accuracy > 95%']
 * });
 */
class MessagingProtocol {
  /**
   * Creates a new MessagingProtocol instance
   * @constructor
   */
  constructor() {
    /**
     * Available message types
     * @type {Object<string, string>}
     * @enum {string}
     */
    this.messageTypes = {
      TASK: 'task',
      RESULT: 'result',
      ERROR: 'error',
      STATUS: 'status',
      QUERY: 'query',
      RESPONSE: 'response',
      NOTIFICATION: 'notification'
    };

    /**
     * Priority levels for messages (higher number = higher priority)
     * @type {Object<string, number>}
     * @enum {number}
     */
    this.priorityLevels = {
      LOW: 0,
      NORMAL: 1,
      HIGH: 2,
      CRITICAL: 3
    };

    /** @type {Object[]} Queue of pending messages */
    this.messageQueue = [];

    /** @type {Object<string, Function[]>} Map of message types to handler arrays */
    this.messageHandlers = {};

    /** @type {Object[]} Log of all sent messages */
    this.messageLog = [];
  }

  /**
   * Create a structured message with all required fields
   * @param {string} type - Message type (from messageTypes enum)
   * @param {string} from - Sender identifier
   * @param {string} to - Recipient identifier
   * @param {Object} payload - Message payload
   * @param {Object} [options={}] - Optional message options
   * @param {number} [options.priority] - Message priority (default: NORMAL)
   * @param {string} [options.correlationId] - Correlation ID for request/response pairing
   * @param {Object} [options.metadata] - Additional metadata
   * @param {number} [options.ttl] - Time-to-live in milliseconds (default: 3600000 = 1 hour)
   * @returns {Object} Structured message object
   * @returns {string} returns.id - Unique message ID
   * @returns {string} returns.timestamp - ISO timestamp
   * @returns {string} returns.type - Message type
   * @returns {string} returns.from - Sender
   * @returns {string} returns.to - Recipient
   * @returns {Object} returns.payload - Message payload
   * @returns {number} returns.priority - Priority level
   * @returns {string|null} returns.correlationId - Correlation ID
   * @returns {Object} returns.metadata - Additional metadata
   * @returns {number} returns.ttl - Time-to-live in ms
   */
  createMessage(type, from, to, payload, options = {}) {
    const message = {
      id: this.generateMessageId(),
      timestamp: new Date().toISOString(),
      type: type,
      from: from,
      to: to,
      payload: payload,
      priority: options.priority || this.priorityLevels.NORMAL,
      correlationId: options.correlationId || null,
      metadata: options.metadata || {},
      ttl: options.ttl || 3600000 // 1 hour default
    };

    return message;
  }

  /**
   * Generate a unique message ID
   * @returns {string} Unique message ID in format 'msg_{timestamp}_{random}'
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Send a message through the protocol
   * @param {Object} message - Message object to send
   * @returns {string} Message ID
   * @throws {Error} If message validation fails
   */
  sendMessage(message) {
    // Validate message
    const validation = this.validateMessage(message);
    if (!validation.valid) {
      throw new Error(`Invalid message: ${validation.errors.join(', ')}`);
    }

    // Add to queue
    this.messageQueue.push(message);

    // Log message
    this.logMessage(message);

    // Trigger handlers
    this.triggerHandlers(message);

    return message.id;
  }

  /**
   * Send a task message to delegate work to another agent
   * @param {string} from - Sender identifier
   * @param {string} to - Recipient identifier
   * @param {string} task - Task description or identifier
   * @param {Object} [options={}] - Task options
   * @param {Object} [options.context] - Task context data
   * @param {Array<string>} [options.requirements] - Task requirements
   * @param {Array<string>} [options.constraints] - Task constraints
   * @param {string} [options.deadline] - Task deadline
   * @returns {string} Message ID
   */
  sendTask(from, to, task, options = {}) {
    const payload = {
      task: task,
      context: options.context || {},
      requirements: options.requirements || [],
      constraints: options.constraints || [],
      deadline: options.deadline || null
    };

    const message = this.createMessage(
      this.messageTypes.TASK,
      from,
      to,
      payload,
      { priority: this.priorityLevels.HIGH, ...options }
    );

    return this.sendMessage(message);
  }

  /**
   * Send a result message in response to a task
   * @param {string} from - Sender identifier
   * @param {string} to - Recipient identifier
   * @param {any} result - Task result
   * @param {string} correlationId - Correlation ID from original task
   * @param {Object} [options={}] - Result options
   * @param {string} [options.status='success'] - Result status
   * @param {Object} [options.metrics={}] - Performance metrics
   * @param {Array<string>} [options.artifacts=[]] - Generated artifacts
   * @returns {string} Message ID
   */
  sendResult(from, to, result, correlationId, options = {}) {
    const payload = {
      result: result,
      status: options.status || 'success',
      metrics: options.metrics || {},
      artifacts: options.artifacts || []
    };

    const message = this.createMessage(
      this.messageTypes.RESULT,
      from,
      to,
      payload,
      { correlationId: correlationId, ...options }
    );

    return this.sendMessage(message);
  }

  /**
   * Send an error message
   * @param {string} from - Sender identifier
   * @param {string} to - Recipient identifier
   * @param {Error|string} error - Error object or message
   * @param {string} correlationId - Correlation ID from original request
   * @param {Object} [options={}] - Error options
   * @param {Object} [options.context={}] - Error context
   * @returns {string} Message ID
   */
  sendError(from, to, error, correlationId, options = {}) {
    const payload = {
      error: error.message || error,
      code: error.code || 'UNKNOWN_ERROR',
      stack: error.stack || null,
      context: options.context || {}
    };

    const message = this.createMessage(
      this.messageTypes.ERROR,
      from,
      to,
      payload,
      { priority: this.priorityLevels.CRITICAL, correlationId: correlationId, ...options }
    );

    return this.sendMessage(message);
  }

  /**
   * Send a status update message
   * @param {string} from - Sender identifier
   * @param {string} to - Recipient identifier
   * @param {string} status - Status description
   * @param {Object} [options={}] - Status options
   * @param {number} [options.progress=0] - Progress percentage (0-100)
   * @param {string} [options.phase] - Current phase
   * @param {Object} [options.details={}] - Additional details
   * @returns {string} Message ID
   */
  sendStatus(from, to, status, options = {}) {
    const payload = {
      status: status,
      progress: options.progress || 0,
      phase: options.phase || null,
      details: options.details || {}
    };

    const message = this.createMessage(
      this.messageTypes.STATUS,
      from,
      to,
      payload,
      options
    );

    return this.sendMessage(message);
  }

  /**
   * Validate a message structure
   * @param {Object} message - Message to validate
   * @returns {Object} Validation result
   * @returns {boolean} returns.valid - True if message is valid
   * @returns {Array<string>} returns.errors - Array of validation errors
   */
  validateMessage(message) {
    const errors = [];

    if (!message.id) errors.push('Missing message ID');
    if (!message.type) errors.push('Missing message type');
    if (!message.from) errors.push('Missing sender');
    if (!message.to) errors.push('Missing recipient');
    if (!message.payload) errors.push('Missing payload');
    if (!message.timestamp) errors.push('Missing timestamp');

    if (message.type && !Object.values(this.messageTypes).includes(message.type)) {
      errors.push(`Invalid message type: ${message.type}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Register a handler for a specific message type
   * @param {string} messageType - Message type to handle
   * @param {Function} handler - Handler function(message)
   */
  registerHandler(messageType, handler) {
    if (!this.messageHandlers[messageType]) {
      this.messageHandlers[messageType] = [];
    }
    this.messageHandlers[messageType].push(handler);
  }

  /**
   * Trigger all handlers for a message
   * @param {Object} message - Message to handle
   */
  triggerHandlers(message) {
    const handlers = this.messageHandlers[message.type] || [];

    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        logger.error('Handler error', {
          messageId: message.id,
          messageType: message.type,
          error: error.message,
          stack: error.stack
        });
      }
    });
  }

  /**
   * Get messages from queue with optional filtering
   * @param {Object} [filter={}] - Filter criteria
   * @param {string} [filter.type] - Filter by message type
   * @param {string} [filter.from] - Filter by sender
   * @param {string} [filter.to] - Filter by recipient
   * @param {string} [filter.correlationId] - Filter by correlation ID
   * @returns {Object[]} Filtered and sorted messages (by priority descending)
   */
  getMessages(filter = {}) {
    let messages = [...this.messageQueue];

    if (filter.type) {
      messages = messages.filter(m => m.type === filter.type);
    }
    if (filter.from) {
      messages = messages.filter(m => m.from === filter.from);
    }
    if (filter.to) {
      messages = messages.filter(m => m.to === filter.to);
    }
    if (filter.correlationId) {
      messages = messages.filter(m => m.correlationId === filter.correlationId);
    }

    // Sort by priority (descending)
    messages.sort((a, b) => b.priority - a.priority);

    return messages;
  }

  /**
   * Remove a message from the queue
   * @param {string} messageId - Message ID to remove
   * @returns {boolean} True if message was found and removed
   */
  removeMessage(messageId) {
    const index = this.messageQueue.findIndex(m => m.id === messageId);
    if (index !== -1) {
      this.messageQueue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Log a message to the message log
   * @param {Object} message - Message to log
   */
  logMessage(message) {
    this.messageLog.push({
      id: message.id,
      timestamp: message.timestamp,
      type: message.type,
      from: message.from,
      to: message.to,
      priority: message.priority
    });
  }

  /**
   * Get statistics about messages
   * @returns {Object} Message statistics
   * @returns {number} returns.total - Total messages in queue
   * @returns {Object<string, number>} returns.byType - Count by message type
   * @returns {Object<number, number>} returns.byPriority - Count by priority
   * @returns {Object[]} returns.recentActivity - Last 10 messages from log
   */
  getStats() {
    const stats = {
      total: this.messageQueue.length,
      byType: {},
      byPriority: {},
      recentActivity: this.messageLog.slice(-10)
    };

    this.messageQueue.forEach(msg => {
      stats.byType[msg.type] = (stats.byType[msg.type] || 0) + 1;
      stats.byPriority[msg.priority] = (stats.byPriority[msg.priority] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clear all messages from the queue
   * @returns {number} Number of messages cleared
   */
  clearQueue() {
    const count = this.messageQueue.length;
    this.messageQueue = [];
    return count;
  }

  /**
   * Export message log to a file
   * @param {string} filePath - Path to export file
   */
  exportLog(filePath) {
    const logData = {
      exported: new Date().toISOString(),
      messages: this.messageLog,
      stats: this.getStats()
    };

    fs.writeFileSync(filePath, JSON.stringify(logData, null, 2));
  }

  /**
   * Import message log from a file
   * @param {string} filePath - Path to import file
   */
  importLog(filePath) {
    const logData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    this.messageLog = logData.messages || [];
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MessagingProtocol;
}
