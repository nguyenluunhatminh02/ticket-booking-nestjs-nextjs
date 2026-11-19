#!/usr/bin/env node

/**
 * llms.txt Analyzer Script
 *
 * PURPOSE:
 * Parses llms.txt content (structured documentation format) and categorizes URLs
 * by priority for optimal agent distribution. Helps determine how many agents to
 * deploy and which URLs each should fetch.
 *
 * WHY THIS SCRIPT:
 * - Analyzes documentation structure from llms.txt files
 * - Categorizes URLs by importance (critical, important, supplementary)
 * - Suggests optimal agent distribution strategy
 * - Enables parallel documentation fetching with load balancing
 *
 * LLMS.TXT FORMAT:
 *   Structured documentation format with URLs and descriptions
 *   Example:
 *     # Next.js Documentation
 *     - Getting Started: https://nextjs.org/docs/getting-started
 *     - Routing: https://nextjs.org/docs/routing
 *     - API Routes: https://nextjs.org/docs/api-routes
 *
 * URL CATEGORIZATION:
 *   Critical (fetch first):
 *     - getting-started, quick-start, quickstart, introduction, intro, overview
 *     - installation, install, setup, basics, core-concepts, fundamentals
 *   WHY: Essential for understanding the library
 *
 *   Important (fetch second):
 *     - guide, tutorial, example, api-reference, api, reference
 *     - configuration, config, routing, route, data-fetching, authentication, auth
 *   WHY: Common use cases and API documentation
 *
 *   Supplementary (fetch last):
 *     - advanced, internals, migration, migrate, troubleshooting, troubleshoot
 *     - faq, frequently-asked, changelog, contributing, contribute
 *   WHY: Edge cases and maintenance information
 *
 * AGENT DISTRIBUTION STRATEGIES:
 *   1. Single agent (1-3 URLs):
 *      - One agent handles all URLs
 *      - Simple sequential fetching
 *
 *   2. Parallel agents (4-10 URLs):
 *      - 2-5 agents in parallel
 *      - Each agent handles 2 URLs
 *      - Balanced workload distribution
 *
 *   3. Parallel agents (11-20 URLs):
 *      - 7 agents in parallel
 *      - Each agent handles ~3 URLs
 *      - Optimal for medium-sized documentation
 *
 *   4. Phased approach (20+ URLs):
 *      - 7 agents in two phases
 *      - Phase 1: Critical URLs
 *      - Phase 2: Important and supplementary URLs
 *      - Prevents overwhelming the system
 *
 * COMMAND LINE USAGE:
 *   node analyze-llms-txt.js <content-file-or-stdin>
 *   cat llms.txt | node analyze-llms-txt.js
 *
 * INPUT:
 *   - File path: node analyze-llms-txt.js llms.txt
 *   - Stdin: cat llms.txt | node analyze-llms-txt.js -
 *   - Stdin: echo "content" | node analyze-llms-txt.js
 *
 * OUTPUT FORMAT:
 *   {
 *     "totalUrls": 15,
 *     "urls": ["https://...", "https://...", ...],
 *     "grouped": {
 *       "critical": ["https://..."],
 *       "important": ["https://...", "https://..."],
 *       "supplementary": ["https://..."]
 *     },
 *     "distribution": {
 *       "agentCount": 5,
 *       "strategy": "parallel",
 *       "urlsPerAgent": 3,
 *       "description": "Deploy 5 agents in parallel"
 *     },
 *     "summary": {
 *       "critical": 2,
 *       "important": 10,
 *       "supplementary": 3
 *     }
 *   }
 *
 * EXIT CODES:
 *   0 - Analysis successful
 *   1 - Error occurred (file not found, invalid input)
 *
 * USAGE EXAMPLES:
 *   # Analyze from file
 *   node analyze-llms-txt.js llms.txt
 *
 *   # Analyze from stdin
 *   cat llms.txt | node analyze-llms-txt.js -
 *
 *   # Pipe from fetch script
 *   curl https://context7.com/vercel/next.js/llms.txt | node analyze-llms-txt.js -
 *
 * EXPORTED FUNCTIONS:
 *   - analyzeLlmsTxt(content): Main analysis function
 *   - parseUrls(content): Extract URLs from llms.txt content
 *   - groupByPriority(urls): Group URLs by priority category
 *   - categorizeUrl(url): Determine priority for single URL
 *   - suggestAgentDistribution(urlCount): Suggest agent strategy
 *
 * MODULE EXPORT:
 *   Exports functions for use in other scripts
 *   Can be imported: const {analyzeLlmsTxt} = require('./analyze-llms-txt.js');
 *
 * NOTES:
 *   - URL categorization is keyword-based (checks URL path)
 *   - Priority order: critical > supplementary > important
 *   - WHY: Specific keywords (advanced, internals) caught before generic ones
 *   - Default priority is "important" if no keywords match
 *   - Agent distribution is heuristic-based (not optimal)
 *   - Designed for docs-seeker skill's parallel fetching
 */

const { loadEnv } = require('./utils/env-loader.js');

// Load environment
const env = loadEnv();
const DEBUG = env.DEBUG === 'true';

/**
 * URL priority categories
 */
const PRIORITY_KEYWORDS = {
  critical: [
    'getting-started', 'quick-start', 'quickstart', 'introduction', 'intro', 'overview',
    'installation', 'install', 'setup', 'basics', 'core-concepts', 'fundamentals',
  ],
  supplementary: [
    'advanced', 'internals', 'migration', 'migrate', 'troubleshooting', 'troubleshoot',
    'faq', 'frequently-asked', 'changelog', 'contributing', 'contribute',
  ],
  important: [
    'guide', 'tutorial', 'example', 'api-reference', 'api', 'reference',
    'configuration', 'config', 'routing', 'route', 'data-fetching', 'authentication', 'auth',
  ],
};

/**
 * Categorize URL by priority
 * @param {string} url - Documentation URL
 * @returns {string} Priority level (critical/important/supplementary)
 */
function categorizeUrl(url) {
  const urlLower = url.toLowerCase();

  // Check in priority order: critical first, then supplementary, then important
  // This ensures specific keywords (advanced, internals) are caught before generic ones
  const priorities = ['critical', 'supplementary', 'important'];

  for (const priority of priorities) {
    const keywords = PRIORITY_KEYWORDS[priority];
    for (const keyword of keywords) {
      if (urlLower.includes(keyword)) {
        return priority;
      }
    }
  }

  return 'important'; // Default
}

/**
 * Parse llms.txt content to extract URLs
 * @param {string} content - llms.txt content
 * @returns {Array<string>} Array of URLs
 */
function parseUrls(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const urls = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Extract URLs (look for http/https)
    const urlMatch = trimmed.match(/https?:\/\/[^\s<>"]+/i);
    if (urlMatch) {
      urls.push(urlMatch[0]);
    }
  }

  return urls;
}

/**
 * Group URLs by priority
 * @param {Array<string>} urls - Array of URLs
 * @returns {Object} URLs grouped by priority
 */
function groupByPriority(urls) {
  const groups = {
    critical: [],
    important: [],
    supplementary: [],
  };

  for (const url of urls) {
    const priority = categorizeUrl(url);
    groups[priority].push(url);
  }

  return groups;
}

/**
 * Suggest optimal agent distribution
 * @param {number} urlCount - Total number of URLs
 * @returns {Object} Agent distribution suggestion
 */
function suggestAgentDistribution(urlCount) {
  if (urlCount <= 3) {
    return {
      agentCount: 1,
      strategy: 'single',
      urlsPerAgent: urlCount,
      description: 'Single agent can handle all URLs',
    };
  } else if (urlCount <= 10) {
    const agents = Math.min(Math.ceil(urlCount / 2), 5);
    return {
      agentCount: agents,
      strategy: 'parallel',
      urlsPerAgent: Math.ceil(urlCount / agents),
      description: `Deploy ${agents} agents in parallel`,
    };
  } else if (urlCount <= 20) {
    return {
      agentCount: 7,
      strategy: 'parallel',
      urlsPerAgent: Math.ceil(urlCount / 7),
      description: 'Deploy 7 agents with balanced workload',
    };
  } else {
    return {
      agentCount: 7,
      strategy: 'phased',
      urlsPerAgent: Math.ceil(urlCount / 7),
      phases: 2,
      description: 'Use two-phase approach: critical first, then important',
    };
  }
}

/**
 * Analyze llms.txt content
 * @param {string} content - llms.txt content
 * @returns {Object} Analysis result
 */
function analyzeLlmsTxt(content) {
  const urls = parseUrls(content);
  const grouped = groupByPriority(urls);
  const distribution = suggestAgentDistribution(urls.length);

  return {
    totalUrls: urls.length,
    urls,
    grouped,
    distribution,
    summary: {
      critical: grouped.critical.length,
      important: grouped.important.length,
      supplementary: grouped.supplementary.length,
    },
  };
}

/**
 * CLI entry point
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node analyze-llms-txt.js <content-file-or-stdin>');
    console.error('Or pipe content: cat llms.txt | node analyze-llms-txt.js');
    process.exit(1);
  }

  const fs = require('fs');
  let content;

  if (args[0] === '-') {
    // Read from stdin
    content = fs.readFileSync(0, 'utf8');
  } else {
    // Read from file
    const filePath = args[0];
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    content = fs.readFileSync(filePath, 'utf8');
  }

  const result = analyzeLlmsTxt(content);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  analyzeLlmsTxt,
  parseUrls,
  groupByPriority,
  categorizeUrl,
  suggestAgentDistribution,
};
