#!/usr/bin/env node

/**
 * Topic Detection Script
 *
 * PURPOSE:
 * Analyzes user queries to extract library name and topic keywords. Distinguishes
 * between topic-specific queries (e.g., "How do I use routing in Next.js?") and
 * general queries (e.g., "documentation for React").
 *
 * WHY THIS SCRIPT:
 * - Enables intelligent documentation fetching based on query type
 * - Extracts structured data (library, topic) from natural language
 * - Helps fetch-docs.js construct optimal URLs
 * - Improves documentation retrieval accuracy
 *
 * QUERY TYPES:
 *
 * 1. TOPIC-SPECIFIC QUERIES:
 *    Pattern: "How do I use X in Y?" or "Y X strategies"
 *    Examples:
 *      - "How do I use routing in Next.js?"
 *        → library: "next.js", topic: "routing"
 *      - "Next.js caching strategies"
 *        → library: "next.js", topic: "caching"
 *      - "Using authentication with Remix"
 *        → library: "remix", topic: "authentication"
 *      - "Implement data fetching in Astro"
 *        → library: "astro", topic: "data-fetching"
 *
 * 2. GENERAL QUERIES (return null):
 *    Pattern: "documentation for X" or "X getting started"
 *    Examples:
 *      - "documentation for React"
 *      - "React getting started"
 *      - "How to use React"
 *      - "React API reference"
 *
 * TOPIC DETECTION PATTERNS:
 *   Pattern 0: "How do I use X in Y?"
 *     → X is topic, Y is library
 *   Pattern 1: "Y X strategies/patterns/techniques"
 *     → Y is library, X is topic
 *   Pattern 2: "X Y documentation/docs/guide"
 *     → X is topic, Y is library
 *   Pattern 3: "Using X with/in/for Y"
 *     → X is topic, Y is library
 *   Pattern 4: "Y X guide/implementation/setup"
 *     → Y is library, X is topic
 *   Pattern 5: "Implement X in/with/for Y"
 *     → X is topic, Y is library
 *
 * NORMALIZATION:
 *   Topic:
 *     - Lowercase
 *     - Remove special characters
 *     - Replace spaces with hyphens
 *     - Take first word (for multi-word topics)
 *     - Limit to 20 characters
 *     Example: "Data Fetching" → "data"
 *
 *   Library:
 *     - Lowercase
 *     - Remove special characters (except /, ., -)
 *     - Replace spaces with hyphens
 *     Example: "Next.js" → "next.js"
 *
 * COMMAND LINE USAGE:
 *   node detect-topic.js "<user query>"
 *
 * OUTPUT FORMAT:
 *   Topic-specific query:
 *   {
 *     "query": "How do I use routing in Next.js?",
 *     "topic": "routing",
 *     "library": "next.js",
 *     "isTopicSpecific": true
 *   }
 *
 *   General query:
 *   {
 *     "isTopicSpecific": false
 *   }
 *
 * EXIT CODES:
 *   0 - Detection successful (always succeeds)
 *
 * USAGE EXAMPLES:
 *   # Topic-specific query
 *   node detect-topic.js "How do I use routing in Next.js?"
 *   # Output: {"topic":"routing","library":"next.js","isTopicSpecific":true}
 *
 *   # General query
 *   node detect-topic.js "documentation for React"
 *   # Output: {"isTopicSpecific":false}
 *
 *   # Pattern with strategies
 *   node detect-topic.js "Next.js caching strategies"
 *   # Output: {"topic":"caching","library":"next.js","isTopicSpecific":true}
 *
 * EXPORTED FUNCTIONS:
 *   - detectTopic(query): Main detection function
 *   - normalizeTopic(topic): Normalize topic string
 *   - normalizeLibrary(library): Normalize library name
 *
 * MODULE EXPORT:
 *   Exports functions for use in other scripts
 *   Can be imported: const {detectTopic} = require('./detect-topic.js');
 *
 * ENVIRONMENT VARIABLES:
 *   DEBUG - Set to "true" for verbose logging (shows pattern matches)
 *
 * NOTES:
 *   - General patterns are checked FIRST (returns null if matched)
 *   - WHY: Prevents false positives on general queries
 *   - Topic patterns are checked in order (0-5)
 *   - Pattern 1 has special handling (library and topic swapped)
 *   - Returns null for invalid or empty queries
 *   - Debug mode logs which pattern matched
 *   - Used by fetch-docs.js to determine URL construction strategy
 */

const { loadEnv } = require('./utils/env-loader.js');

// Load environment
const env = loadEnv();
const DEBUG = env.DEBUG === 'true';

/**
 * Topic-specific query patterns
 */
const TOPIC_PATTERNS = [
  // "How do I use X in Y?"
  /how (?:do i|to|can i) (?:use|implement|add|setup|configure) (?:the )?(.+?) (?:in|with|for) (.+)/i,

  // "Y X strategies/patterns" - e.g., "Next.js caching strategies"
  /(.+?) (.+?) (?:strategies|patterns|techniques|methods|approaches)/i,

  // "X Y documentation" or "Y X docs"
  /(.+?) (.+?) (?:documentation|docs|guide|tutorial)/i,

  // "Using X with Y"
  /using (.+?) (?:with|in|for) (.+)/i,

  // "Y X guide/implementation/setup"
  /(.+?) (.+?) (?:guide|implementation|setup|configuration)/i,

  // "Implement X in Y"
  /implement(?:ing)? (.+?) (?:in|with|for|using) (.+)/i,
];

/**
 * General library query patterns (non-topic specific)
 */
const GENERAL_PATTERNS = [
  /(?:documentation|docs) for (.+)/i,
  /(.+?) (?:getting started|quick ?start|introduction)/i,
  /(?:how to use|learn) (.+)/i,
  /(.+?) (?:api reference|overview|basics)/i,
];

/**
 * Normalize topic keyword
 * @param {string} topic - Raw topic string
 * @returns {string} Normalized topic keyword
 */
function normalizeTopic(topic) {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .split('-')[0]                 // Take first word for multi-word topics
    .slice(0, 20);                 // Limit length
}

/**
 * Normalize library name
 * @param {string} library - Raw library string
 * @returns {string} Normalized library name
 */
function normalizeLibrary(library) {
  return library
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s\-\/\.]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Detect if query is topic-specific or general
 * @param {string} query - User query
 * @returns {Object|null} Topic info or null for general query
 */
function detectTopic(query) {
  if (!query || typeof query !== 'string') {
    return null;
  }

  const trimmedQuery = query.trim();

  // Check general patterns first
  for (const pattern of GENERAL_PATTERNS) {
    const match = trimmedQuery.match(pattern);
    if (match) {
      if (DEBUG) console.error('[DEBUG] Matched general pattern, no topic');
      return null;
    }
  }

  // Check topic-specific patterns
  for (let i = 0; i < TOPIC_PATTERNS.length; i++) {
    const pattern = TOPIC_PATTERNS[i];
    const match = trimmedQuery.match(pattern);
    if (match) {
      const [, term1, term2] = match;

      // Determine which is library and which is topic based on pattern
      let topic, library;

      // Pattern 0: "How do I use X in Y?" -> X is topic, Y is library
      // Pattern 1: "Y X strategies" -> X is topic, Y is library
      // Pattern 2-5: X is topic, Y is library in most cases

      // For pattern 1 (strategies/patterns), term1 is library, term2 is topic
      if (i === 1) {
        topic = normalizeTopic(term2);
        library = normalizeLibrary(term1);
      } else {
        // For other patterns, term1 is topic, term2 is library
        topic = normalizeTopic(term1);
        library = normalizeLibrary(term2);
      }

      if (DEBUG) {
        console.error('[DEBUG] Matched topic pattern');
        console.error('[DEBUG] Topic:', topic);
        console.error('[DEBUG] Library:', library);
      }

      return {
        query: trimmedQuery,
        topic,
        library,
        isTopicSpecific: true,
      };
    }
  }

  if (DEBUG) console.error('[DEBUG] No pattern matched, treating as general');
  return null;
}

/**
 * CLI entry point
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node detect-topic.js "<user query>"');
    process.exit(1);
  }

  const query = args.join(' ');
  const result = detectTopic(query);

  if (result) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } else {
    console.log(JSON.stringify({ isTopicSpecific: false }, null, 2));
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  detectTopic,
  normalizeTopic,
  normalizeLibrary,
};
