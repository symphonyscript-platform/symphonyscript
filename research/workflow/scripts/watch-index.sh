#!/bin/bash
# watch-index.sh - Watch index file for new unread entries
#
# Usage: ./watch-index.sh <index_file> [poll_interval]
#
# Examples:
#   Architect waits for engineer: ./watch-index.sh 0000-INDEX-BY-ENGINEER.md
#   Engineer waits for architect: ./watch-index.sh 0000-INDEX-BY-ARCHITECT.md
#
# Behavior:
#   - Polls the file for lines NOT marked as read (not starting with #)
#   - When found: outputs the filename, marks line as read (prepends #), exits
#   - Lines starting with # are considered "read" and skipped

set -e

INDEX_FILE="$1"
POLL_INTERVAL="${2:-2}"  # Default 2 seconds

if [ -z "$INDEX_FILE" ]; then
    echo "Usage: $0 <index_file> [poll_interval]"
    echo "  index_file: Path to the index file"
    echo "  poll_interval: Seconds between checks (default: 2)"
    exit 1
fi

if [ ! -f "$INDEX_FILE" ]; then
    echo "Error: Index file not found: $INDEX_FILE"
    exit 1
fi

# Poll until we find an unread line
while true; do
    FOUND_LINE=""
    FOUND_LINE_NUM=0
    LINE_NUM=0
    
    while IFS= read -r line || [ -n "$line" ]; do
        LINE_NUM=$((LINE_NUM + 1))
        
        # Skip empty lines
        [ -z "$line" ] && continue
        
        # Skip lines already marked as read (start with #)
        [[ "$line" == \#* ]] && continue
        
        # Found an unread line
        FOUND_LINE="$line"
        FOUND_LINE_NUM=$LINE_NUM
        break  # Take the first unread line
    done < "$INDEX_FILE"
    
    # If we found an unread line
    if [ -n "$FOUND_LINE" ]; then
        # Output the filename
        echo "$FOUND_LINE"
        
        # Mark as read by prepending # to that specific line
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "${FOUND_LINE_NUM}s/^/#/" "$INDEX_FILE"
        else
            sed -i "${FOUND_LINE_NUM}s/^/#/" "$INDEX_FILE"
        fi
        
        exit 0
    fi
    
    # Not found yet, wait and try again
    sleep "$POLL_INTERVAL"
done
