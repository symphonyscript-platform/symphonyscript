# C-002: executeDelete Missing Identity Table Cleanup Fix

**Fix ID:** C-002
**Status:** IMPLEMENTED
**Date:** 2026-01-28

## Problem

`executeDelete()` called `_deleteNode()` but did not clean up Identity Table or Symbol Table entries, leaving dangling pointers that could cause use-after-free vulnerabilities.

## Files Changed

- `packages/kernel/src/silicon-synapse.ts`
- `packages/kernel/src/__tests__/stress-tests.test.ts`

## Changes Made

### 1. `executeDelete()` (lines 1769-1793)

**Before:**
```typescript
private executeDelete(ptr: NodePtr): boolean {
  // RFC-045-04: _deleteNode now returns boolean instead of throwing
  return this._deleteNode(ptr)
}
```

**After:**
```typescript
private executeDelete(ptr: NodePtr): boolean {
  // Extract sourceId BEFORE unlinking (node data may be overwritten after free)
  const offset = ptr / 4
  const sourceId = Atomics.load(this.sab, offset + NODE.SOURCE_ID)

  // Delete from chain (handles mutex, unlinking, free list return)
  const success = this._deleteNode(ptr)

  // Clean up Identity Table and Symbol Table entries
  if (success && sourceId > 0) {
    this.idTableRemove(sourceId)
    this.symTableRemove(sourceId)
  }

  return success
}
```

### 2. Test Added

Added test `should clean up Identity Table and Symbol Table on executeDelete` in `stress-tests.test.ts`:

```typescript
it('should clean up Identity Table and Symbol Table on executeDelete', () => {
  const linker = createTestLinker(64)
  const sourceId = 5000

  // Insert a node with sourceId
  const ptr = linker.insertHead(OPCODE.NOTE, 60, 100, 96, 0, sourceId, FLAG.ACTIVE)
  expect(ptr).not.toBe(NULL_PTR)

  // Verify it's in the Identity Table
  expect(linker.idTableLookup(sourceId)).toBe(ptr)

  // Store symbol data
  linker.symTableStore(sourceId, 0xABCD, 42, 10)

  // Verify symbol data can be retrieved
  let foundBefore = false
  linker.symTableLookup(sourceId, (fh, l, c) => {
    foundBefore = (fh === 0xABCD && l === 42 && c === 10)
  })
  expect(foundBefore).toBe(true)

  // Delete the node
  linker.deleteNode(ptr)

  // Verify Identity Table entry is removed
  expect(linker.idTableLookup(sourceId)).toBe(NULL_PTR)

  // Verify Symbol Table entry is removed
  let foundAfter = false
  linker.symTableLookup(sourceId, () => { foundAfter = true })
  expect(foundAfter).toBe(false)
})
```

## Test Result

```
Test Suites: 12 passed, 12 total
Tests:       204 passed, 204 total
```

**PASS**

## Notes

- Critical fix: sourceId is extracted BEFORE calling `_deleteNode()` because node memory may be overwritten after it's returned to the free list
- Only cleans up if `sourceId > 0` (invalid/zero sourceIds are not tracked in tables)
- Updated JSDoc to document the RFC-002 remediation
