#!/bin/bash
# watch-folder.sh - Watch folder for new files matching a pattern
#
# Usage: ./watch-folder.sh <directory> <pattern>
#
# Examples:
#   Architect waits for engineer: ./watch-folder.sh communication "*-by-engineer-*.md"
#   Engineer waits for architect: ./watch-folder.sh communication "*-by-architect-*.md"
#
# Behavior:
#   - Blocks until a NEW file matching the pattern appears
#   - Outputs the filename and exits
#   - Uses fswatch for native filesystem events (no polling)

set -e

DIR="$1"
PATTERN="$2"

if [ -z "$DIR" ] || [ -z "$PATTERN" ]; then
    echo "Usage: $0 <directory> <pattern>"
    echo "  directory: Path to watch for new files"
    echo "  pattern: Glob pattern to match (e.g., '*-by-engineer-*.md')"
    exit 1
fi

if [ ! -d "$DIR" ]; then
    echo "Error: Directory not found: $DIR"
    exit 1
fi

# Check if fswatch is available
if ! command -v fswatch &> /dev/null; then
    echo "Error: fswatch not found. Install with: brew install fswatch"
    exit 1
fi

# Get current files before watching
BEFORE=$(ls -1 "$DIR"/$PATTERN 2>/dev/null | sort || true)

# Watch for new files
# fswatch -1 exits after first event, --event Created filters to file creation
fswatch -1 --event Created --event Renamed "$DIR" | while read -r _; do
    # Get files after event
    AFTER=$(ls -1 "$DIR"/$PATTERN 2>/dev/null | sort || true)
    
    # Find new files (in AFTER but not in BEFORE)
    NEW=$(comm -13 <(echo "$BEFORE") <(echo "$AFTER"))
    
    if [ -n "$NEW" ]; then
        # Output just the filename (basename), not full path
        basename "$NEW"
        exit 0
    fi
done
