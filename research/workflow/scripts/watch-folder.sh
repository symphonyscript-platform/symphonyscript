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
#   - Loops until a matching file is found (won't exit empty)

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

# Loop until we find a new matching file
while true; do
    # Wait for any file system event (fswatch -1 exits after first event)
    fswatch -1 --event Created --event Renamed --event Updated "$DIR" > /dev/null 2>&1 || true
    
    # Get files after event
    AFTER=$(ls -1 "$DIR"/$PATTERN 2>/dev/null | sort || true)
    
    # Find new files (in AFTER but not in BEFORE)
    NEW=$(comm -13 <(echo "$BEFORE") <(echo "$AFTER") | head -1)
    
    if [ -n "$NEW" ]; then
        # Output just the filename (basename), not full path
        basename "$NEW"
        exit 0
    fi
    
    # No match yet - keep watching
    # (loop continues, fswatch will block again)
done
