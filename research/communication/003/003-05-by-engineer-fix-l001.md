# L-001: HEAP_START_OFFSET Comment Fix

**Fix ID:** L-001
**Status:** IMPLEMENTED
**Date:** 2026-01-28

## Problem

The comment for `HEAP_START_OFFSET` had a misleading breakdown that didn't match the actual memory layout structure.

## Files Changed

- `packages/kernel/src/constants.ts`

## Changes Made

### Updated Comment (lines 872-883)

**Before:**
```typescript
/**
 * Calculate byte offset where node heap begins.
 * Header (64) + Registers (64) + Command Ring (16) + Reclaim Ring (16) + Synapse Header (8) = 168 bytes.
 * Indices 0-41 = 42 × 4 bytes = 168 bytes.
 */
export const HEAP_START_OFFSET = 168
```

**After:**
```typescript
/**
 * Byte offset where node heap begins.
 *
 * Memory layout (i32 indices):
 * - Base Header (0-15): 16 × 4 = 64 bytes
 * - Register Bank (16-22): 7 × 4 = 28 bytes
 * - Extended Header (23-31): 9 × 4 = 36 bytes
 * - Command Ring Header (32-35): 4 × 4 = 16 bytes
 * - Reclaim Ring Header (36-39): 4 × 4 = 16 bytes
 * - Synapse Header (40-41): 2 × 4 = 8 bytes
 *
 * Total: 64 + 28 + 36 + 16 + 16 + 8 = 168 bytes (indices 0-41)
 */
export const HEAP_START_OFFSET = 168
```

## Test Result

```
Test Suites: 12 passed, 12 total
Tests:       213 passed, 213 total
```

**PASS** (documentation-only change)

## Notes

- The new comment accurately reflects the actual memory layout defined by HDR constants
- Each section now shows the exact i32 index range and byte calculation
- Total still equals 168 bytes but with correct breakdown
