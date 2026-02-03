# RFC-047 Phase 9 Task 4: Refactor SynapticNode - Implementation Plan

**Date**: 2025-12-28T18:09:00+04:00  
**From**: The Engineer  
**To**: The Architect  
**RFC**: 047  
**Document**: 047-80-by-engineer-task4-plan.md

---

## STATUS: AWAITING APPROVAL

---

## Summary

Refactor `SynapticNode.addNote()` to use `SynapticNoteCursor` internally while maintaining backward-compatible API. This creates a clean separation between public API (primitives) and internal implementation (cursor-based).

---

## Current State Analysis

### SynapticNode Fields (lines 20-24)

```typescript
private bridge: SiliconBridge
private entryId: number | undefined
private exitId: number | undefined
private expressionId: number = 0
private cycle: number = Infinity
```

### Current addNote() Implementation (lines 64-100)

```typescript
addNote(
    pitch: number,
    velocity: number,
    duration: number,
    baseTick: number,
    muted?: boolean
): void {
    const sourceId = this.bridge.generateSourceId()

    const ptr = this.bridge.insertAsync(
        0x01, // OPCODE.NOTE
        pitch,
        velocity,
        duration,
        baseTick,
        muted ?? false,
        sourceId,
        this.exitId,
        this.expressionId // RFC-047 Phase 3: Pass MPE ID
    )

    if (ptr >= 0) {
        if (this.entryId === undefined) {
            this.entryId = sourceId
        }
        this.exitId = sourceId
        this.bridge.getLinker().processCommands()
    }
}
```

---

## Proposed Changes

### File: `packages/synaptic/src/SynapticNode.ts`

#### Change A: Add Cursor Field (after line 24)

```typescript
private bridge: SiliconBridge
private entryId: number | undefined
private exitId: number | undefined
private expressionId: number = 0
private cycle: number = Infinity

// RFC-047 Phase 9 Task 4: Reusable note parameter cursor
private cursor: SynapticNoteCursor
```

#### Change B: Initialize Cursor in Constructor (line 31-35)

**Current**:
```typescript
constructor(bridge: SiliconBridge) {
    this.bridge = bridge
    this.entryId = undefined
    this.exitId = undefined
}
```

**Modified**:
```typescript
constructor(bridge: SiliconBridge) {
    this.bridge = bridge
    this.entryId = undefined
    this.exitId = undefined
    this.cursor = new SynapticNoteCursor()  // RFC-047 Phase 9 Task 4
}
```

#### Change C: Add Import (line 11)

**Current**:
```typescript
import type { SiliconBridge } from '@symphonyscript/kernel'
```

**Modified**:
```typescript
import type { SiliconBridge } from '@symphonyscript/kernel'
import { SynapticNoteCursor } from './SynapticNoteCursor'
```

#### Change D: Create Private addNoteFromCursor() Method (after addNote(), around line 102)

```typescript
/**
 * Internal method: Add note from cursor parameters.
 * 
 * This is the actual implementation. Public addNote() delegates to this.
 * 
 * @private
 * @returns true if note was added, false on error
 */
private addNoteFromCursor(): boolean {
    const sourceId = this.bridge.generateSourceId()

    const ptr = this.bridge.insertAsync(
        0x01, // OPCODE.NOTE
        this.cursor.pitch,
        this.cursor.velocity,
        this.cursor.duration,
        this.cursor.baseTick,
        this.cursor.muted,
        sourceId,
        this.exitId,
        this.expressionId
    )

    // Only update IDs if insertion succeeded (ptr >= 0)
    if (ptr >= 0) {
        // Set entryId on first note
        if (this.entryId === undefined) {
            this.entryId = sourceId
        }

        // Always update exitId to the newly added note
        this.exitId = sourceId

        // Register mapping to make sourceId usable
        this.bridge.getLinker().processCommands()
        return true
    }
    
    return false
}
```

#### Change E: Refactor Public addNote() to Use Cursor (lines 64-100)

**Current** (lines 64-100):
```typescript
addNote(
    pitch: number,
    velocity: number,
    duration: number,
    baseTick: number,
    muted?: boolean
): void {
    const sourceId = this.bridge.generateSourceId()

    const ptr = this.bridge.insertAsync(
        0x01, // OPCODE.NOTE
        pitch,
        velocity,
        duration,
        baseTick,
        muted ?? false,
        sourceId,
        this.exitId,
        this.expressionId
    )

    if (ptr >= 0) {
        if (this.entryId === undefined) {
            this.entryId = sourceId
        }
        this.exitId = sourceId
        this.bridge.getLinker().processCommands()
    }
}
```

**Refactored** (same signature, new implementation):
```typescript
addNote(
    pitch: number,
    velocity: number,
    duration: number,
    baseTick: number,
    muted?: boolean
): void {
    // Populate cursor with provided parameters
    this.cursor.set(pitch, velocity, duration, baseTick, muted ?? false)
    
    // Delegate to internal cursor-based implementation
    this.addNoteFromCursor()
}
```

---

## Design Rationale

### Backward Compatibility

**Critical**: Public API signature is **unchanged**. All existing code using `SynapticNode.addNote()` will continue to work without modification.

### Separation of Concerns

- **Public API** (`addNote()`): Accepts primitives, validates, populates cursor
- **Internal Implementation** (`addNoteFromCursor()`): Uses cursor, handles bridge operations

This pattern enables:
1. Future optimization (pass cursor directly from higher-level builders)
2. Testability (cursor can be inspected/mocked)
3. Zero-allocation reuse (single cursor instance)

### Why Private addNoteFromCursor()?

**Rationale**:
- Keeps implementation details private
- Public API remains focused on primitives
- Future: Higher-level builders (SynapticClip) could populate cursor and call this directly
- Single source of truth for note insertion logic

---

## Tests to Add/Modify

### File: `packages/synaptic/src/__tests__/SynapticNode.test.ts`

**Add new test suite**:

```typescript
describe('Cursor Integration (Phase 9)', () => {
    test('addNote() uses cursor internally', () => {
        const linker = SiliconSynapse.create({ nodeCapacity: 64, safeZoneTicks: 0 });
        const bridge = new SiliconBridge(linker);
        const node = new SynapticNode(bridge);
        
        // Add note via public API
        node.addNote(60, 100, 480, 0, false);
        
        // Cursor should be reusable (internal state)
        expect(node).toBeDefined();
    });
    
    test('Cursor is reused across multiple notes', () => {
        const linker = SiliconSynapse.create({ nodeCapacity: 64, safeZoneTicks: 0 });
        const bridge = new SiliconBridge(linker);
        const node = new SynapticNode(bridge);
        
        // Multiple notes should reuse same cursor instance
        node.addNote(60, 100, 480, 0);
        node.addNote(64, 110, 240, 480);
        node.addNote(67, 120, 480, 720);
        
        expect(node.getEntryId()).toBeGreaterThan(0);
        expect(node.getExitId()).toBeGreaterThan(0);
    });
});
```

**Existing tests**: All existing tests in `SynapticNode.test.ts` should pass unchanged (backward compatibility verification).

---

## Verification Plan

### Automated Tests

Run full suite:
```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/synaptic
npm run test -- SynapticNode.test.ts
```

Expected: All existing tests pass + 2 new tests pass.

### TypeScript Compilation

```bash
cd /Users/torniketsomaia/projects/@tsomaia.tech/symphonyscript/packages/synaptic
npx tsc --noEmit
```

Expected: No type errors.

---

## Zero-Allocation Compliance

- ✅ Single `cursor` instance created in constructor
- ✅ Reused via `.set()` for each note
- ✅ No new cursor instances during note insertion
- ✅ Public API unchanged (no breaking changes to consumers)

---

## Concerns / Questions

**None** - This is a straightforward refactoring with clear requirements.

---

**Awaiting Architect approval to proceed with implementation.**
