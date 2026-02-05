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
#   - Tracks last seen file's mtime (modification time)
#   - Outputs any file with mtime > last seen (immediately if exists)
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

# State file to track last seen mtime
SAFE_PATTERN=$(echo "$PATTERN" | tr '*/' 'x_')
STATE_FILE="$DIR/.last-seen-$SAFE_PATTERN"

# Get last seen mtime (0 if state file doesn't exist)
LAST_MTIME=0
if [ -f "$STATE_FILE" ]; then
    LAST_MTIME=$(cat "$STATE_FILE")
fi

# Function to get mtime as epoch seconds (works on macOS and Linux)
get_mtime() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        stat -f "%m" "$1"
    else
        stat -c "%Y" "$1"
    fi
}

# Function to find newest file (by mtime) that's newer than last seen
find_new_file() {
    local NEWEST_FILE=""
    local NEWEST_MTIME=0
    
    for FILE in "$DIR"/$PATTERN; do
        [ -f "$FILE" ] || continue
        
        local MTIME=$(get_mtime "$FILE")
        
        # File must be newer than last seen AND newer than any other candidate
        if [ "$MTIME" -gt "$LAST_MTIME" ] && [ "$MTIME" -gt "$NEWEST_MTIME" ]; then
            NEWEST_FILE="$FILE"
            NEWEST_MTIME="$MTIME"
        fi
    done
    
    if [ -n "$NEWEST_FILE" ]; then
        echo "$NEWEST_FILE|$NEWEST_MTIME"
        return 0
    fi
    return 1
}

# First, check if there's already a new file (handles timing issues)
RESULT=$(find_new_file || true)
if [ -n "$RESULT" ]; then
    FILE=$(echo "$RESULT" | cut -d'|' -f1)
    MTIME=$(echo "$RESULT" | cut -d'|' -f2)
    echo "$MTIME" > "$STATE_FILE"
    basename "$FILE"
    exit 0
fi

# No new file yet - watch for changes
while true; do
    # Wait for any file system event
    fswatch -1 --event Created --event Renamed --event Updated "$DIR" > /dev/null 2>&1 || true
    
    # Check for new file
    RESULT=$(find_new_file || true)
    if [ -n "$RESULT" ]; then
        FILE=$(echo "$RESULT" | cut -d'|' -f1)
        MTIME=$(echo "$RESULT" | cut -d'|' -f2)
        echo "$MTIME" > "$STATE_FILE"
        basename "$FILE"
        exit 0
    fi
    
    # No match yet - keep watching
done
