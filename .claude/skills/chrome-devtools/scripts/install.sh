#!/bin/bash
#
# install.sh - Installation script for Chrome DevTools Agent Skill
#
# PURPOSE:
# Sets up the Chrome DevTools automation environment by checking Node.js version,
# verifying system dependencies (Linux), and installing npm packages.
#
# WHY THIS SCRIPT:
# - Ensures prerequisites are met before installation
# - Checks for critical Chrome/Chromium system libraries
# - Provides helpful error messages with installation instructions
# - Cross-platform support (Linux, macOS, Windows)
#
# INSTALLATION STEPS:
#   1. Check Node.js version (requires 18+)
#   2. Check system dependencies (Linux only)
#      - libnss3, libnspr4, libgbm1 (critical for Chrome)
#      - Provides installation command if missing
#   3. Install npm dependencies (npm install)
#   4. Display test command and documentation links
#
# SYSTEM REQUIREMENTS:
#   - Node.js 18 or higher
#   - npm (comes with Node.js)
#   - Linux: Chrome system libraries (checked automatically)
#   - macOS: No additional dependencies
#   - Windows: No additional dependencies
#
# COMMAND LINE USAGE:
#   ./install.sh
#
# OUTPUT:
#   - Progress messages with colored output
#   - Warnings for missing dependencies
#   - Installation instructions if requirements not met
#   - Success message with test command
#
# EXIT CODES:
#   0 - Installation successful
#   1 - Error occurred (Node.js version too old, user cancelled)
#
# SYSTEM DEPENDENCY CHECK (Linux):
#   Uses ldconfig to check for:
#   - libnss3.so (Network Security Services)
#   - libnspr4.so (Netscape Portable Runtime)
#   - libgbm.so (Generic Buffer Management)
#   WHY: These are critical for Chrome/Chromium to run
#
# MISSING DEPENDENCIES HANDLING:
#   - Lists missing packages
#   - Provides apt-get install command
#   - Asks user to continue or cancel
#   - Suggests running install-deps.sh for full installation
#
# PLATFORM DETECTION:
#   - Linux: Checks system dependencies
#   - macOS: Skips dependency check (not needed)
#   - Windows: Skips dependency check (not needed)
#   - Other: Shows error message
#
# AFTER INSTALLATION:
#   Test with: node navigate.js --url https://example.com
#   Documentation: cat README.md
#
# NOTES:
#   - Requires root/sudo for system package installation (Linux)
#   - install-deps.sh provides complete dependency installation
#   - npm install handles Node.js package dependencies
#   - Interactive prompt if dependencies missing (can be skipped)
#   - Provides helpful links for Node.js upgrade
#

set -e

echo "🚀 Installing Chrome DevTools Agent Skill..."
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Error: Node.js 18+ is required. Current version: $(node --version)"
  echo "   Please upgrade Node.js: https://nodejs.org/"
  exit 1
fi

echo "✓ Node.js version: $(node --version)"
echo ""

# Check for system dependencies (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  echo "Checking system dependencies (Linux)..."

  # Check for critical Chrome dependencies
  MISSING_DEPS=()

  if ! ldconfig -p | grep -q libnss3.so; then
    MISSING_DEPS+=("libnss3")
  fi

  if ! ldconfig -p | grep -q libnspr4.so; then
    MISSING_DEPS+=("libnspr4")
  fi

  if ! ldconfig -p | grep -q libgbm.so; then
    MISSING_DEPS+=("libgbm1")
  fi

  if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo "⚠️  Missing system dependencies: ${MISSING_DEPS[*]}"
    echo ""
    echo "   Chrome/Chromium requires system libraries to run."
    echo "   Install them with:"
    echo ""
    echo "   ./install-deps.sh"
    echo ""
    echo "   Or manually:"
    echo "   sudo apt-get install -y libnss3 libnspr4 libgbm1 libasound2t64 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2"
    echo ""

    read -p "   Continue anyway? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Installation cancelled."
      exit 1
    fi
  else
    echo "✓ System dependencies found"
  fi
  echo ""
elif [[ "$OSTYPE" == "darwin"* ]]; then
  echo "Platform: macOS (no system dependencies needed)"
  echo ""
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
  echo "Platform: Windows (no system dependencies needed)"
  echo ""
fi

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

echo ""
echo "✅ Installation complete!"
echo ""
echo "Test the installation:"
echo "  node navigate.js --url https://example.com"
echo ""
echo "For more information:"
echo "  cat README.md"
echo ""
