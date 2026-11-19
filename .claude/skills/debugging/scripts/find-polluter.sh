#!/bin/bash
#
# find-polluter.sh - Bisection script to find test pollution
#
# PURPOSE:
# Identifies which test file creates unwanted files or state (e.g., .git directory,
# temp files, database changes). Runs tests one-by-one and checks if pollution
# appears after each test.
#
# WHY THIS SCRIPT:
# - Tests should be isolated and not create side effects
# - Some tests accidentally create files/directories that break other tests
# - Manual debugging is time-consuming
# - Automates the search process
#
# COMMAND LINE ARGUMENTS:
#   $1 - File or directory to check for pollution (required)
#        Example: '.git', 'temp/', 'database.sqlite'
#   $2 - Test file pattern (required)
#        Example: 'src/**/*.test.ts', 'tests/**/*.spec.js'
#
# HOW IT WORKS:
#   1. Find all test files matching the pattern
#   2. For each test file:
#      a. Check if pollution already exists (skip if yes)
#      b. Run the test
#      c. Check if pollution appeared
#      d. If yes, report the polluter and exit
#   3. If no polluter found after all tests, report success
#
# OUTPUT:
#   - Progress: [1/10] Testing: test-file.test.ts
#   - Polluter found: Shows test file and pollution details
#   - No polluter: Success message
#
# EXIT CODES:
#   0 - No polluter found (all tests clean)
#   1 - Polluter found or error occurred
#
# USAGE EXAMPLES:
#   # Find test that creates .git directory
#   ./find-polluter.sh '.git' 'src/**/*.test.ts'
#
#   # Find test that creates temp files
#   ./find-polluter.sh 'temp/' 'tests/**/*.spec.js'
#
#   # Find test that creates database file
#   ./find-polluter.sh 'database.sqlite' '**/*.test.js'
#
# POLLUTION CHECK LOGIC:
#   - Uses [ -e "$POLLUTION_CHECK" ] to check existence
#   - Works for files and directories
#   - Checks BEFORE running test (skip if already exists)
#   - Checks AFTER running test (detect if created)
#
# TEST EXECUTION:
#   - Runs: npm test "$TEST_FILE"
#   - Suppresses output (redirects to /dev/null)
#   - Continues even if test fails (|| true)
#   - WHY: We care about side effects, not test results
#
# POLLUTER IDENTIFICATION:
#   When polluter found, displays:
#   - Test file path
#   - Pollution details (ls -la)
#   - Commands to investigate further
#
# PERFORMANCE NOTES:
#   - Runs tests sequentially (not parallel)
#   - Each test: depends on test suite speed
#   - Total time: (number of tests) × (time per test)
#   - May take several minutes for large test suites
#
# LIMITATIONS:
#   - Only detects pollution after test completes
#   - Cannot detect pollution that is cleaned up
#   - Cannot detect pollution in specific test cases (only file-level)
#   - Assumes npm test command works
#
# INVESTIGATION TIPS:
#   After finding polluter:
#   1. Run just that test: npm test <test-file>
#   2. Review test code: cat <test-file>
#   3. Look for: fs.writeFileSync, mkdirSync, database operations
#   4. Check for missing cleanup in afterEach/afterAll hooks
#   5. Add proper cleanup or use temporary directories
#
# COMMON POLLUTION SOURCES:
#   - Tests that create .git directories
#   - Tests that write to filesystem without cleanup
#   - Tests that create database files
#   - Tests that modify environment variables
#   - Tests that create temp files in wrong location
#
# NOTES:
#   - Script is safe to run multiple times
#   - Stops at first polluter found (bisection approach)
#   - Use with specific patterns to narrow search
#   - Combine with git clean -fd to reset state between runs
#

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 <file_to_check> <test_pattern>"
  echo "Example: $0 '.git' 'src/**/*.test.ts'"
  exit 1
fi

POLLUTION_CHECK="$1"
TEST_PATTERN="$2"

echo "🔍 Searching for test that creates: $POLLUTION_CHECK"
echo "Test pattern: $TEST_PATTERN"
echo ""

# Get list of test files
TEST_FILES=$(find . -path "$TEST_PATTERN" | sort)
TOTAL=$(echo "$TEST_FILES" | wc -l | tr -d ' ')

echo "Found $TOTAL test files"
echo ""

COUNT=0
for TEST_FILE in $TEST_FILES; do
  COUNT=$((COUNT + 1))

  # Skip if pollution already exists
  if [ -e "$POLLUTION_CHECK" ]; then
    echo "⚠️  Pollution already exists before test $COUNT/$TOTAL"
    echo "   Skipping: $TEST_FILE"
    continue
  fi

  echo "[$COUNT/$TOTAL] Testing: $TEST_FILE"

  # Run the test
  npm test "$TEST_FILE" > /dev/null 2>&1 || true

  # Check if pollution appeared
  if [ -e "$POLLUTION_CHECK" ]; then
    echo ""
    echo "🎯 FOUND POLLUTER!"
    echo "   Test: $TEST_FILE"
    echo "   Created: $POLLUTION_CHECK"
    echo ""
    echo "Pollution details:"
    ls -la "$POLLUTION_CHECK"
    echo ""
    echo "To investigate:"
    echo "  npm test $TEST_FILE    # Run just this test"
    echo "  cat $TEST_FILE         # Review test code"
    exit 1
  fi
done

echo ""
echo "✅ No polluter found - all tests clean!"
exit 0
