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
#   - Tracks last seen file in a state file
#   - Outputs any file newer than last seen (immediately if exists)
#   - If no new file, blocks until one appears
#   - Uses fswatch for native filesystem events

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

# State file to track last seen file (in the watched directory)
# Create a safe filename from the pattern
SAFE_PATTERN=$(echo "$PATTERN" | tr '*/' 'x_')
STATE_FILE="$DIR/.last-seen-$SAFE_PATTERN"

# Get last seen file (empty if state file doesn't exist)
LAST_SEEN=""
if [ -f "$STATE_FILE" ]; then
    LAST_SEEN=$(cat "$STATE_FILE")
fi

# Function to find newest file matching pattern that's newer than last seen
find_new_file() {
    # Get all matching files sorted by name (descending = newest first with your naming scheme)
    local FILES=$(ls -1 "$DIR"/$PATTERN 2>/dev/null | sort -r)
    
    for FILE in $FILES; do
        local BASENAME=$(basename "$FILE")
        # If we haven't seen any file, or this file is "greater than" (newer than) last seen
        if [ -z "$LAST_SEEN" ] || [[ "$BASENAME" > "$LAST_SEEN" ]]; then
            echo "$BASENAME"
            return 0
        fi
    done
    return 1
}

# First, check if there's already a new file (handles timing issues)
NEW_FILE=$(find_new_file || true)
if [ -n "$NEW_FILE" ]; then
    echo "$NEW_FILE" > "$STATE_FILE"
    echo "$NEW_FILE"
    exit 0
fi

# No new file yet - watch for changes
while true; do
    # Wait for any file system event
    fswatch -1 --event Created --event Renamed --event Updated "$DIR" > /dev/null 2>&1 || true
    
    # Check for new file
    NEW_FILE=$(find_new_file || true)
    if [ -n "$NEW_FILE" ]; then
        echo "$NEW_FILE" > "$STATE_FILE"
        echo "$NEW_FILE"
        exit 0
    fi
    
    # No match yet - keep watching
done
