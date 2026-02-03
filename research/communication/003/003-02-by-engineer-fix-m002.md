# M-002: Atomics.load Consistency Fix

**Fix ID:** M-002
**Status:** IMPLEMENTED
**Date:** 2026-01-28

## Problem

6 locations in `silicon-synapse.ts` used direct array access (`this.sab[HDR.X]`) instead of `Atomics.load()`. While some values were "immutable," direct access breaks memory ordering guarantees, especially on ARM architectures (per RFC-045-04).

## Files Changed

- `packages/kernel/src/silicon-synapse.ts`

## Changes Made

### 1. Constructor (line ~90)

**Before:**
```typescript
this.nodeCapacity = this.sab[HDR.NODE_CAPACITY]
```

**After:**
```typescript
// M-002: Use Atomics.load for thread-safe header access
this.nodeCapacity = Atomics.load(this.sab, HDR.NODE_CAPACITY)
```

### 2. `checkSafeZone()` (line ~449)

**Before:**
```typescript
const safeZone = this.sab[HDR.SAFE_ZONE_TICKS]
```

**After:**
```typescript
// M-002: Use Atomics.load for thread-safe header access
const safeZone = Atomics.load(this.sab, HDR.SAFE_ZONE_TICKS)
```

### 3. `_deleteNode()` (line ~681)

**Before:**
```typescript
const targetTick = this.sab[offset + NODE.BASE_TICK]
```

**After:**
```typescript
// M-002: Use Atomics.load for thread-safe node field access
const targetTick = Atomics.load(this.sab, offset + NODE.BASE_TICK)
```

### 4. `getPpq()` (line ~1058)

**Before:**
```typescript
return this.sab[HDR.PPQ]
```

**After:**
```typescript
return Atomics.load(this.sab, HDR.PPQ)
```

Updated comment from "Non-atomic read is safe since PPQ never changes" to "M-002: Use Atomics.load for memory ordering guarantees (especially ARM)."

### 5. `getSafeZoneTicks()` (line ~1226)

**Before:**
```typescript
return this.sab[HDR.SAFE_ZONE_TICKS]
```

**After:**
```typescript
return Atomics.load(this.sab, HDR.SAFE_ZONE_TICKS)
```

Updated comment from "Non-atomic read is safe since value never changes" to "M-002: Use Atomics.load for memory ordering guarantees (especially ARM)."

### 6. `deleteNode()` (line ~2034)

**Before:**
```typescript
const targetTick = this.sab[offset + NODE.BASE_TICK]
```

**After:**
```typescript
// M-002: Use Atomics.load for thread-safe node field access
const targetTick = Atomics.load(this.sab, offset + NODE.BASE_TICK)
```

## Test Result

```
Test Suites: 12 passed, 12 total
Tests:       205 passed, 205 total
```

**PASS**

## Notes

- All 6 locations now use `Atomics.load()` for consistency with the rest of the codebase
- Even "immutable" values benefit from atomic reads for proper memory ordering
- Particularly important on ARM architectures where memory ordering is more relaxed
- The codebase already correctly uses `Atomics.load()` in most places (e.g., `traverse()` method)
