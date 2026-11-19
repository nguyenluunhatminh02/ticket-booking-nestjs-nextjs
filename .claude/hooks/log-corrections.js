#!/usr/bin/env node

/**
 * Self-Correcting Memory System Hook
 * Automatically logs user corrections and detects patterns
 *
 * Usage: This hook is triggered when user provides corrections
 * It extracts correction details and updates the memory system
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CORRECTIONS_FILE = path.join(__dirname, '..', 'memory', 'corrections.json');
const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit

/**
 * Generate unique ID for correction
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * Get current ISO timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Load corrections from file with error handling
 */
function loadCorrections() {
  try {
    if (!fs.existsSync(CORRECTIONS_FILE)) {
      return createEmptyStructure();
    }

    const content = fs.readFileSync(CORRECTIONS_FILE, 'utf8');
    const data = JSON.parse(content);

    // Validate structure
    if (!data.corrections || !Array.isArray(data.corrections)) {
      console.warn('Corrections file has invalid structure, creating fresh');
      return createEmptyStructure();
    }

    return data;
  } catch (error) {
    console.error('Error loading corrections:', error.message);
    return createEmptyStructure();
  }
}

/**
 * Create empty corrections structure
 */
function createEmptyStructure() {
  return {
    corrections: [],
    patterns: {
      repeatedMistakes: [],
      preferredApproaches: [],
      avoidApproaches: []
    },
    metadata: {
      createdAt: getTimestamp(),
      lastUpdated: getTimestamp(),
      totalCorrections: 0
    }
  };
}

/**
 * Save corrections to file with error handling
 */
function saveCorrections(data) {
  try {
    const content = JSON.stringify(data, null, 2);

    // Check file size
    if (content.length > MAX_FILE_SIZE) {
      console.warn('Corrections file exceeds 1MB limit, archiving old entries');
      archiveOldCorrections(data);
    }

    // Ensure directory exists
    const dir = path.dirname(CORRECTIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(CORRECTIONS_FILE, content, 'utf8');
    data.metadata.lastUpdated = getTimestamp();

    return true;
  } catch (error) {
    console.error('Error saving corrections:', error.message);
    return false;
  }
}

/**
 * Archive old corrections when file gets too large
 */
function archiveOldCorrections(data) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Keep only recent or high-frequency corrections
  data.corrections = data.corrections.filter(c => {
    const isRecent = new Date(c.lastSeen) > ninetyDaysAgo;
    const isFrequent = c.frequency > 2;
    return isRecent || isFrequent;
  });

  data.metadata.totalCorrections = data.corrections.length;
}

/**
 * Detect correction category from context
 */
function detectCategory(context, wrong, right) {
  const text = `${context} ${wrong} ${right}`.toLowerCase();

  const categories = {
    'react-patterns': ['useeffect', 'usememo', 'usecallback', 'react', 'component', 'hook'],
    'api-design': ['api', 'endpoint', 'route', 'rest', 'graphql', 'request'],
    'database': ['sql', 'query', 'schema', 'table', 'index', 'migration'],
    'architecture': ['structure', 'pattern', 'design', 'module', 'service'],
    'bug-fix': ['bug', 'error', 'fix', 'broken', 'issue'],
    'style': ['style', 'format', 'lint', 'convention'],
    'logic': ['logic', 'algorithm', 'condition', 'loop'],
    'performance': ['performance', 'slow', 'optimize', 'speed']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(kw => text.includes(kw))) {
      return category;
    }
  }

  return 'general';
}

/**
 * Find similar existing correction
 */
function findSimilarCorrection(corrections, newCorrection) {
  const threshold = 0.7; // 70% similarity threshold

  for (const existing of corrections) {
    // Check if context and category match
    if (existing.category !== newCorrection.category) continue;

    // Simple similarity check based on key terms
    const existingTerms = new Set(`${existing.context} ${existing.wrong}`.toLowerCase().split(/\s+/));
    const newTerms = new Set(`${newCorrection.context} ${newCorrection.wrong}`.toLowerCase().split(/\s+/));

    const intersection = new Set([...existingTerms].filter(x => newTerms.has(x)));
    const union = new Set([...existingTerms, ...newTerms]);

    const similarity = intersection.size / union.size;

    if (similarity >= threshold) {
      return existing;
    }
  }

  return null;
}

/**
 * Update patterns based on corrections
 */
function updatePatterns(data) {
  const categoryCount = {};
  const approachCount = {};

  // Count categories
  for (const correction of data.corrections) {
    categoryCount[correction.category] = (categoryCount[correction.category] || 0) + 1;

    // Track approaches
    const rightKey = `${correction.category}:${correction.right}`;
    approachCount[rightKey] = (approachCount[rightKey] || 0) + 1;
  }

  // Identify repeated mistakes (3+ occurrences)
  data.patterns.repeatedMistakes = Object.entries(categoryCount)
    .filter(([_, count]) => count >= 3)
    .map(([category, count]) => ({ category, count }));

  // Identify preferred approaches (high frequency)
  data.patterns.preferredApproaches = Object.entries(approachCount)
    .filter(([_, count]) => count >= 2)
    .map(([approach, count]) => ({ approach, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10

  // Identify approaches to avoid
  data.patterns.avoidApproaches = data.corrections
    .filter(c => c.frequency >= 2)
    .map(c => ({
      category: c.category,
      wrong: c.wrong,
      frequency: c.frequency
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
}

/**
 * Main function to log a correction
 */
function logCorrection(correctionData) {
  try {
    // Validate input
    if (!correctionData.context || !correctionData.wrong || !correctionData.right) {
      console.error('Invalid correction data: missing required fields');
      return { success: false, error: 'Missing required fields' };
    }

    // Load existing corrections
    const data = loadCorrections();

    // Detect category if not provided
    const category = correctionData.category ||
      detectCategory(correctionData.context, correctionData.wrong, correctionData.right);

    // Create new correction object
    const newCorrection = {
      id: generateId(),
      timestamp: getTimestamp(),
      context: correctionData.context,
      wrong: correctionData.wrong,
      right: correctionData.right,
      category: category,
      frequency: 1,
      lastSeen: getTimestamp(),
      patterns: correctionData.patterns || []
    };

    // Check for similar existing correction
    const similar = findSimilarCorrection(data.corrections, newCorrection);

    if (similar) {
      // Update existing correction
      similar.frequency += 1;
      similar.lastSeen = getTimestamp();
      console.log(`Updated existing correction (frequency: ${similar.frequency})`);
    } else {
      // Add new correction
      data.corrections.push(newCorrection);
      console.log('Added new correction');
    }

    // Update metadata
    data.metadata.totalCorrections = data.corrections.length;

    // Update patterns
    updatePatterns(data);

    // Save to file
    const saved = saveCorrections(data);

    if (saved) {
      return {
        success: true,
        message: 'Correction logged successfully',
        correctionId: similar ? similar.id : newCorrection.id,
        frequency: similar ? similar.frequency : 1
      };
    } else {
      return { success: false, error: 'Failed to save corrections' };
    }

  } catch (error) {
    console.error('Error in logCorrection:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get corrections for review
 */
function getCorrections(options = {}) {
  try {
    const data = loadCorrections();
    let results = data.corrections;

    // Filter by category
    if (options.category) {
      results = results.filter(c => c.category === options.category);
    }

    // Filter by minimum frequency
    if (options.minFrequency) {
      results = results.filter(c => c.frequency >= options.minFrequency);
    }

    // Sort by frequency or timestamp
    if (options.sortBy === 'frequency') {
      results.sort((a, b) => b.frequency - a.frequency);
    } else {
      results.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
    }

    // Limit results
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return {
      success: true,
      corrections: results,
      patterns: data.patterns,
      total: data.corrections.length
    };

  } catch (error) {
    console.error('Error in getCorrections:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get patterns summary
 */
function getPatterns() {
  try {
    const data = loadCorrections();
    return {
      success: true,
      patterns: data.patterns,
      metadata: data.metadata
    };
  } catch (error) {
    console.error('Error in getPatterns:', error);
    return { success: false, error: error.message };
  }
}

// Export functions for use
module.exports = {
  logCorrection,
  getCorrections,
  getPatterns,
  loadCorrections,
  saveCorrections
};

// CLI interface
if (require.main === module) {
  const action = process.argv[2];

  switch (action) {
    case 'log':
      // Example: node log-corrections.js log '{"context":"...","wrong":"...","right":"..."}'
      const correctionData = JSON.parse(process.argv[3] || '{}');
      const result = logCorrection(correctionData);
      console.log(JSON.stringify(result, null, 2));
      break;

    case 'get':
      const options = JSON.parse(process.argv[3] || '{}');
      const corrections = getCorrections(options);
      console.log(JSON.stringify(corrections, null, 2));
      break;

    case 'patterns':
      const patterns = getPatterns();
      console.log(JSON.stringify(patterns, null, 2));
      break;

    default:
      console.log('Usage:');
      console.log('  node log-corrections.js log \'{"context":"...","wrong":"...","right":"..."}\'');
      console.log('  node log-corrections.js get \'{"category":"...","limit":10}\'');
      console.log('  node log-corrections.js patterns');
  }
}
