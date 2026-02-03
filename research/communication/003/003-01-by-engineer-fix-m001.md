# M-001: SYNAPSE_COUNT Telemetry Fix

**Fix ID:** M-001
**Status:** IMPLEMENTED
**Date:** 2026-01-28

## Problem

`SYNAPSE_COUNT` header field was initialized to 0 but never updated when synapses were created, deleted, or compacted. This meant the counter always remained at 0 regardless of actual synapse operations.

## Files Changed

- `packages/kernel/src/synapse-allocator.ts`
- `packages/kernel/src/silicon-bridge.ts`

## Changes Made

### 1. `synapse-allocator.ts` - `connect()` (line ~129)

Added increment after successful synapse insertion:

```typescript
// M-001: Update SYNAPSE_COUNT telemetry
Atomics.add(this.sab, HDR.SYNAPSE_COUNT, 1)
```

### 2. `synapse-allocator.ts` - `disconnect()` (line ~147)

Added decrement when tombstoning a synapse:

```typescript
// M-001: Update SYNAPSE_COUNT telemetry
Atomics.add(this.sab, HDR.SYNAPSE_COUNT, -1)
```

Note: Using `Atomics.add(..., -1)` instead of non-existent `Atomics.sub()`.

### 3. `synapse-allocator.ts` - `compactTable()` (line ~237)

Added reset to accurate live count after compaction:

```typescript
// M-001: Reset SYNAPSE_COUNT to accurate live count after compaction
Atomics.store(this.sab, HDR.SYNAPSE_COUNT, liveCount)
```

### 4. `silicon-bridge.ts` - `disconnectAllToTarget()` (line ~1491)

Added decrement when directly tombstoning synapses via reverse index:

```typescript
// M-001: Update SYNAPSE_COUNT telemetry
Atomics.add(this.sab, HDR.SYNAPSE_COUNT, -1)
```

## Test Result

```
Test Suites: 12 passed, 12 total
Tests:       205 passed, 205 total
```

**PASS**

## Notes

- All updates use atomic operations for thread safety
- `compactTable()` uses `Atomics.store()` to reset to exact count (more efficient than incrementing during reinsert loop)
- `disconnectAllToTarget()` was an additional code path that bypassed `synapseAllocator.disconnect()` and needed its own counter update
