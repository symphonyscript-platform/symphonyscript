# L-004: Quadratic Probing Documentation Fix

**Fix ID:** L-004
**Status:** IMPLEMENTED
**Date:** 2026-01-28

## Problem

Documentation incorrectly described the Identity Table and Symbol Table as using "linear probing" when they actually use quadratic probing.

## Files Changed

- `packages/kernel/src/silicon-synapse.ts`
- `packages/kernel/src/constants.ts`
- `packages/kernel/src/init.ts`

## Changes Made

### 1. `silicon-synapse.ts` - `symTableStore()` JSDoc (line ~1462)

**Before:**
```typescript
/**
 * Store a packed SourceLocation in the Symbol Table for a sourceId.
 * Uses the same linear probing as Identity Table to find the slot.
```

**After:**
```typescript
/**
 * Store a packed SourceLocation in the Symbol Table for a sourceId.
 * Uses quadratic probing: slot = (baseSlot + probe²) % capacity
```

### 2. `constants.ts` - Memory Layout Comment (line ~111)

**Before:**
```
 * │ Linear-probe hash table: [TID: i32, NodePtr: u32] × capacity       │
```

**After:**
```
 * │ Quadratic-probe hash table: [TID: i32, NodePtr: u32] × capacity    │
```

### 3. `constants.ts` - ID_TABLE JSDoc (line ~469)

**Before:**
```typescript
 * Structure: Linear-probe hash table with [TID: i32, NodePtr: u32] entries.
```

**After:**
```typescript
 * Structure: Quadratic-probe hash table with [TID: i32, NodePtr: u32] entries.
 * Uses slot = (baseSlot + probe²) % capacity to reduce primary clustering.
```

### 4. `init.ts` - `initializeIdentityTable()` JSDoc (line ~178)

**Before:**
```typescript
 * The Identity Table is a linear-probe hash table mapping TID (sourceId) to NodePtr.
```

**After:**
```typescript
 * The Identity Table is a quadratic-probe hash table mapping TID (sourceId) to NodePtr.
 * Uses slot = (baseSlot + probe²) % capacity to reduce primary clustering.
```

## Test Result

```
Test Suites: 12 passed, 12 total
Tests:       213 passed, 213 total
```

**PASS** (documentation-only changes)

## Notes

- All 4 incorrect "linear-probe" references have been updated to "quadratic-probe"
- Added formula clarification where appropriate: `slot = (baseSlot + probe²) % capacity`
- Mentioned benefit of quadratic probing: "reduces primary clustering"
