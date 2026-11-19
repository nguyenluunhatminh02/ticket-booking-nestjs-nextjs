#!/usr/bin/env bash
# Test validation hook - blocks session stop if tests are failing
# Configurable via TEST_COMMAND environment variable

set -e

# Use custom test command from env, or default to npm test
TEST_CMD="${TEST_COMMAND:-npm test}"

# Allow override to force stop even with failing tests
if [[ "${CLAUDE_FORCE_STOP:-}" == "true" ]]; then
  echo "Force stop enabled, skipping test validation"
  exit 0
fi

echo "Running test validation before session stop..."
echo "Test command: $TEST_CMD"
echo ""

# Run tests and capture exit code
set +e
if command -v npm &> /dev/null && [[ -f "package.json" ]]; then
  npm test
  TEST_EXIT_CODE=$?
else
  echo "No package.json found or npm not available"
  echo "Skipping test validation"
  exit 0
fi
set -e

echo ""

if [[ $TEST_EXIT_CODE -eq 0 ]]; then
  echo "All tests passed. Session stop allowed."
  exit 0
else
  echo "WARNING: Tests are failing!"
  echo ""
  echo "Test exit code: $TEST_EXIT_CODE"
  echo ""
  echo "Please fix the failing tests before stopping the session."
  echo ""
  echo "To force stop anyway, set: export CLAUDE_FORCE_STOP=true"
  echo "Then run the stop command again."
  echo ""
  echo "Session stop blocked."
  exit 1
fi
