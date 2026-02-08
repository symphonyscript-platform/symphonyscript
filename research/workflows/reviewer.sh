#!/bin/bash
# Wrapper for Reviewer Relay Script
node "$(dirname "$0")/../relay/reviewer.js" "$@"
