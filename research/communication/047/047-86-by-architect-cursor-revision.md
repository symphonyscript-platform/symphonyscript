# RFC-047 Phase 9: CURSOR ARCHITECTURE REVISION

**Date**: 2025-12-28T18:42:00+04:00  
**From**: The Architect  
**To**: Stakeholder / Engineer  
**RFC**: 047  
**Document**: 047-86-by-architect-cursor-revision.md

---

## CRITICAL DESIGN ISSUE IDENTIFIED

The current `SynapticNoteCursor` implementation is **architecturally incorrect**.

After analyzing the legacy codebase (`MelodyNoteCursor`, `NoteCursor`, `MelodyBuilder`, `ClipBuilder`), it is clear that the cursor pattern has been **fundamentally misunderstood**.

---

## Current (WRONG) Implementation

```typescript
// SynapticNoteCursor.ts - WRONG PATTERN
export class SynapticNoteCursor {
    pitch: number = 60
    velocity: number = 100
    duration: number = 480
    baseTick: number = 0
    muted: boolean = false

    set(pitch, velocity, duration, baseTick, muted): this
    reset(): this
}
```

**Problem**: This is just a data container with public fields. It has no relationship with the builder and cannot provide the fluent modifier API.

---

## Legacy (CORRECT) Pattern

### Core Concept

```typescript
// NoteCursor holds a PENDING OPERATION, not just parameters
export class NoteCursor<B extends ClipBuilder> {
    constructor(
        protected readonly builder: B,           // Reference to parent builder
        protected readonly pendingOp: NoteOp     // The uncommitted operation
    ) {}

    // MODIFIERS - mutate pending op, return this
    velocity(v: number): this
    staccato(): this
    humanize(options): this

    // ESCAPES - commit pending op, return to builder
    rest(duration): B
    tempo(bpm): B
    build(): ClipNode

    // RELAYS - commit pending, start new pending (for cursor-specific types)
    note(pitch, duration): MelodyNoteCursor  // In MelodyNoteCursor

    // Internal
    commit(): B  // Add pending op to builder's chain
}
```

### MelodyBuilder.note() Returns a Cursor

```typescript
// MelodyBuilder.ts
note(pitch: NoteName, duration?: NoteDuration): MelodyNoteCursor {
    const op = Actions.note(pitch, duration, velocity)
    return new MelodyNoteCursor(this, op)  // Returns cursor, not this!
}
```

### Usage Pattern

```typescript
clip.note('C4', '4n')        // Returns MelodyNoteCursor (pending op created)
    .velocity(0.8)           // Modifier (returns cursor)
    .staccato()              // Modifier (returns cursor)
    .note('D4', '4n')        // Relay: commits C4, creates D4 pending, returns new cursor
    .legato()                // Modifier on D4
    .rest('4n')              // Escape: commits D4, returns builder
    .note('E4')              // New note operation
    .build()                 // Escape: commits, builds
```

---

## Key Insight: Cursor Holds a Pending Operation

| Aspect | Legacy Pattern | Current (Wrong) |
|--------|---------------|-----------------|
| **Stores** | `pendingOp: NoteOp` (the full operation) | Just primitive fields |
| **Builder reference** | `builder: B` (parent) | None |
| **Modifiers** | Mutate `pendingOp`, return `this` | Just `.set()` |
| **Escapes** | Commit op, return builder | None |
| **Relays** | Commit, create new cursor | None |
| **Zero-allocation** | ❌ Creates cursor per note | ✅ Reuses cursor |

---

## Architectural Decision Point

### Option A: Match Legacy Pattern Exactly

Create cursor that holds pending operation and provides full modifier API.

**Pros**:
- Matches proven design
- Full expressiveness (velocity, articulation, expression)
- Clean separation of concerns

**Cons**:
- Allocates new cursor instance per `.note()` call
- More complex implementation
- Violates RFC-045-04 zero-allocation

### Option B: Hybrid Pattern (Reusable Cursor)

Keep a single cursor instance in the builder, but move modifier logic to cursor.

```typescript
class SynapticNoteCursor {
    private builder: SynapticNode
    pitch: number
    velocity: number
    // ... other fields

    // New: Modifier methods
    velocity(v: number): this {
        this.velocity = v
        return this
    }

    // Commit when next note() is called
    flush(): void {
        this.builder.addNoteFromCursor(this)
    }
}

class SynapticNode {
    private cursor: SynapticNoteCursor

    note(pitch, duration): SynapticNoteCursor {
        // Flush previous note if exists
        if (this.hasPending) this.cursor.flush()
        // Populate cursor for new note
        this.cursor.pitch = pitch
        this.cursor.duration = duration
        return this.cursor  // Returns same instance
    }
}
```

**Pros**:
- Zero-allocation (single cursor reused)
- Modifier API still available
- Compatible with RFC-045-04

**Cons**:
- Deviates from legacy pattern
- Must track "has pending" state
- `note()` must flush previous implicitly

### Option C: Keep Current Simple Pattern

Accept that `SynapticNoteCursor` is just a data holder, and modifiers stay on the builder.

**Pros**:
- Simplest implementation
- Already done
- Zero-allocation

**Cons**:
- No per-note modifier API
- Less expressive
- Different pattern from legacy

---

## Architect's Recommendation

**Option B (Hybrid Pattern)** is the correct choice because:

1. **Zero-allocation**: Single cursor instance, reused for each note
2. **Modifier API**: `.velocity()`, `.staccato()` etc. are still chainable
3. **Compatible**: Works with synaptic kernel architecture
4. **Implicit commit**: `.note()` call flushes previous pending note automatically

---

## Required Changes

If we proceed with Option B:

### 1. Modify `SynapticNoteCursor`

Add modifier methods:
```typescript
velocity(v: number): this
expression(id: number): this
mute(): this
unmute(): this
```

Add builder reference:
```typescript
private builder: SynapticNode | null = null
bind(builder: SynapticNode): void
```

### 2. Modify `SynapticNode.note()`

Instead of adding note immediately:
```typescript
note(pitch, duration): SynapticNoteCursor {
    // Flush previous note if cursor has pending
    if (this.cursor.isPending) {
        this.addNoteFromCursor()
    }
    // Populate cursor for new note
    this.cursor.set(pitch, velocity, duration, this.currentTick)
    this.cursor.isPending = true
    return this.cursor
}
```

### 3. Track pending state

Add `isPending: boolean` to cursor or builder.

---

## Questions for Stakeholder

1. **Scope**: Should we implement the full legacy modifier API (velocity, staccato, legato, humanize, expression) or just the basics?

2. **Commit semantics**: Should we use implicit commit (on next note) or require explicit `.commit()`?

3. **Zero-allocation priority**: Is RFC-045-04 compliance mandatory, or can we allocate cursors per note like legacy?

4. **Phase 9 impact**: This changes Tasks 3 and 4. Should we revise completed work or create new cursor alongside?

---

**Awaiting Stakeholder decision before proceeding.**
