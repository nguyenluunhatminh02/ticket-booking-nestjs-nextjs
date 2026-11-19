#!/bin/bash
#
# install-deps.sh - System dependencies installation for Chrome/Chromium
#
# PURPOSE:
# Installs all required system libraries for running Chrome/Chromium in headless
# mode. Handles multiple Linux distributions with appropriate package managers.
#
# WHY THIS SCRIPT:
# - Chrome/Chromium requires many system libraries not included by default
# - Different Linux distributions use different package names
# - Provides one-command installation for all dependencies
# - Prevents "Chrome failed to start" errors
#
# SUPPORTED DISTRIBUTIONS:
#   1. Ubuntu/Debian/Pop!_OS (apt-get)
#   2. Fedora/RHEL/CentOS (dnf or yum)
#   3. Arch/Manjaro (pacman)
#
# INSTALLED DEPENDENCIES (Ubuntu/Debian example):
#   - ca-certificates: SSL certificates
#   - fonts-liberation: Font rendering
#   - libasound2t64: Audio support
#   - libatk-bridge2.0-0, libatk1.0-0: Accessibility toolkit
#   - libc6: C library
#   - libcairo2: 2D graphics
#   - libcups2: Printing support
#   - libdbus-1-3: Inter-process communication
#   - libexpat1: XML parsing
#   - libfontconfig1: Font configuration
#   - libgbm1: Graphics buffer management (critical)
#   - libgcc1: GCC runtime
#   - libglib2.0-0: GLib library
#   - libgtk-3-0: GTK+ toolkit
#   - libnspr4, libnss3: Network security (critical)
#   - libpango-1.0-0, libpangocairo-1.0-0: Text rendering
#   - libstdc++6: C++ standard library
#   - libx11-6, libx11-xcb1, libxcb1: X11 libraries
#   - libxcomposite1, libxcursor1, libxdamage1: X extensions
#   - libxext6, libxfixes3, libxi6: X extensions
#   - libxrandr2, libxrender1, libxss1, libxtst6: X extensions
#   - lsb-release: Distribution info
#   - wget: Download tool
#   - xdg-utils: Desktop integration
#
# COMMAND LINE USAGE:
#   ./install-deps.sh
#
# PRIVILEGE REQUIREMENTS:
#   - Requires root/sudo for package installation
#   - Automatically detects if running as root
#   - Uses sudo if not root
#   - May prompt for password
#
# OUTPUT:
#   - Detected OS information
#   - Package manager being used
#   - Installation progress
#   - Success message with next steps
#
# EXIT CODES:
#   0 - Installation successful
#   1 - Error occurred (OS not supported, installation failed)
#
# OS DETECTION:
#   - Reads /etc/os-release
#   - Extracts OS ID (ubuntu, debian, fedora, arch, etc.)
#   - Falls back to error if /etc/os-release not found
#
# PACKAGE MANAGER SELECTION:
#   - Ubuntu/Debian/Pop: apt-get
#   - Fedora/RHEL/CentOS: dnf (preferred) or yum (fallback)
#   - Arch/Manjaro: pacman
#   - Other: Error message with manual installation link
#
# AFTER INSTALLATION:
#   1. Run: cd <chrome-devtools-scripts-dir>
#   2. Run: npm install
#   3. Test: node navigate.js --url https://example.com
#
# TROUBLESHOOTING:
#   - If Chrome still fails, check: https://pptr.dev/troubleshooting
#   - Some systems may need additional fonts
#   - Docker containers may need --no-sandbox flag
#
# NOTES:
#   - Script is idempotent (safe to run multiple times)
#   - Package names vary by distribution
#   - Some packages may already be installed (apt handles this)
#   - Installation may take 1-5 minutes depending on system
#   - Requires internet connection for package download
#   - Does NOT install Node.js or npm (must be installed separately)
#

set -e

echo "🚀 Installing system dependencies for Chrome/Chromium..."
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ Cannot detect OS. This script supports Debian/Ubuntu-based systems."
    exit 1
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    SUDO="sudo"
    echo "⚠️  This script requires root privileges to install system packages."
    echo "   You may be prompted for your password."
    echo ""
else
    SUDO=""
fi

# Install dependencies based on OS
case $OS in
    ubuntu|debian|pop)
        echo "Detected: $PRETTY_NAME"
        echo "Installing dependencies with apt..."
        echo ""

        $SUDO apt-get update

        # Install Chrome dependencies
        $SUDO apt-get install -y \
            ca-certificates \
            fonts-liberation \
            libasound2t64 \
            libatk-bridge2.0-0 \
            libatk1.0-0 \
            libc6 \
            libcairo2 \
            libcups2 \
            libdbus-1-3 \
            libexpat1 \
            libfontconfig1 \
            libgbm1 \
            libgcc1 \
            libglib2.0-0 \
            libgtk-3-0 \
            libnspr4 \
            libnss3 \
            libpango-1.0-0 \
            libpangocairo-1.0-0 \
            libstdc++6 \
            libx11-6 \
            libx11-xcb1 \
            libxcb1 \
            libxcomposite1 \
            libxcursor1 \
            libxdamage1 \
            libxext6 \
            libxfixes3 \
            libxi6 \
            libxrandr2 \
            libxrender1 \
            libxss1 \
            libxtst6 \
            lsb-release \
            wget \
            xdg-utils

        echo ""
        echo "✅ System dependencies installed successfully!"
        ;;

    fedora|rhel|centos)
        echo "Detected: $PRETTY_NAME"
        echo "Installing dependencies with dnf/yum..."
        echo ""

        # Try dnf first, fallback to yum
        if command -v dnf &> /dev/null; then
            PKG_MGR="dnf"
        else
            PKG_MGR="yum"
        fi

        $SUDO $PKG_MGR install -y \
            alsa-lib \
            atk \
            at-spi2-atk \
            cairo \
            cups-libs \
            dbus-libs \
            expat \
            fontconfig \
            glib2 \
            gtk3 \
            libdrm \
            libgbm \
            libX11 \
            libxcb \
            libXcomposite \
            libXcursor \
            libXdamage \
            libXext \
            libXfixes \
            libXi \
            libxkbcommon \
            libXrandr \
            libXrender \
            libXScrnSaver \
            libXtst \
            mesa-libgbm \
            nspr \
            nss \
            pango

        echo ""
        echo "✅ System dependencies installed successfully!"
        ;;

    arch|manjaro)
        echo "Detected: $PRETTY_NAME"
        echo "Installing dependencies with pacman..."
        echo ""

        $SUDO pacman -Sy --noconfirm \
            alsa-lib \
            at-spi2-core \
            cairo \
            cups \
            dbus \
            expat \
            glib2 \
            gtk3 \
            libdrm \
            libx11 \
            libxcb \
            libxcomposite \
            libxcursor \
            libxdamage \
            libxext \
            libxfixes \
            libxi \
            libxkbcommon \
            libxrandr \
            libxrender \
            libxshmfence \
            libxss \
            libxtst \
            mesa \
            nspr \
            nss \
            pango

        echo ""
        echo "✅ System dependencies installed successfully!"
        ;;

    *)
        echo "❌ Unsupported OS: $OS"
        echo "   This script supports: Ubuntu, Debian, Fedora, RHEL, CentOS, Arch, Manjaro"
        echo ""
        echo "   Please install Chrome/Chromium dependencies manually for your OS."
        echo "   See: https://pptr.dev/troubleshooting"
        exit 1
        ;;
esac

echo ""
echo "📝 Next steps:"
echo "   1. Run: cd $(dirname "$0")"
echo "   2. Run: npm install"
echo "   3. Test: node navigate.js --url https://example.com"
echo ""
