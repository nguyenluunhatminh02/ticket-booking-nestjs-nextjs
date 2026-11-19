#!/usr/bin/env python3
"""
Pack a directory into a .docx file.

DOCX files are ZIP archives containing XML and other resources.
This script packages the contents of a directory into a valid .docx file.

Usage:
    python pack.py <input_directory> <output.docx>

Example:
    python pack.py unpacked_doc/ output.docx
"""

import argparse
import os
import sys
import zipfile
from pathlib import Path


def pack_docx(input_dir: Path, output_file: Path):
    """
    Pack a directory into a .docx file.

    Args:
        input_dir: Directory containing unpacked DOCX contents
        output_file: Output .docx file path
    """
    if not input_dir.exists():
        print(f"Error: Input directory {input_dir} does not exist")
        sys.exit(1)

    if not input_dir.is_dir():
        print(f"Error: {input_dir} is not a directory")
        sys.exit(1)

    # Create the ZIP archive
    with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Walk through all files in the input directory
        for root, dirs, files in os.walk(input_dir):
            for file in files:
                file_path = Path(root) / file
                # Calculate relative path for archive
                arcname = file_path.relative_to(input_dir)
                zipf.write(file_path, arcname)

    print(f"Successfully packed {input_dir} to {output_file}")


def main():
    parser = argparse.ArgumentParser(description="Pack directory into .docx file")
    parser.add_argument("input_dir", type=Path, help="Input directory containing DOCX contents")
    parser.add_argument("output_file", type=Path, help="Output .docx file path")

    args = parser.parse_args()

    pack_docx(args.input_dir, args.output_file)


if __name__ == "__main__":
    main()
