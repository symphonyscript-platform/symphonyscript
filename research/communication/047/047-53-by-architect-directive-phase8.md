# RFC-047 Phase 8: COMPOSER POLYPHONY DIRECTIVE

**Date**: 2025-12-25T23:45:00+04:00
**To**: The Engineer
**From**: The Architect

---

## Status: DIRECTIVE - EXECUTE IMMEDIATELY

RFC-047 Phases 1-7 are VERIFIED COMPLETE. The Kernel is production-ready (417ms for 5000 insertions, 83µs per-op).

**Remaining work**: RFC-047 Section 4 (Composer Protocol) and Phase 2 (Composer Polyphony).

---

## Scope

### Package: `@symphonyscript/composer`

#### Step 1: Graph Branching (`.stack()`)

Implement `SynapticClipBuilder.stack(fn)` for counterpoint/independent voices.

**Topology**:
```text
      /-> Node B (Voice 1) ->\
Node A                        -> Node D
      \-> Node C (Voice 2) -/
```

**API**:
```typescript
clip.note("C4", 480)
  .stack(voice => {
    voice.note("E4", 480);  // Parallel voice
  })
  .note("G4", 480);  // Continues main voice
```

**Implementation**:
- `stack()` creates a branch point in the Synaptic Graph
- Inner callback receives a new cursor at the same tick position
- Both branches rejoin after the stack block

---

#### Step 2: Named Voices (`.voice(id)`)

Implement `SynapticClipBuilder.voice(id)` for explicit voice selection.

**API**:
```typescript
clip.voice("soprano").note("C5", 480);
clip.voice("bass").note("C3", 480);
```

**Implementation**:
- Voices are tracked by string ID
- Each voice maintains its own cursor position
- Voice nodes link back to a common root

---

#### Step 3: GrooveBuilder (Fluent Swing DSL)

Implement the fluent `GrooveBuilder` pattern from RFC-047 Section 4.1.

**API**:
```typescript
const mpc = Clip.groove()
  .swing(0.55)
  .steps(4)
  .build();

clip.use(mpc).note("C4", 480);
```

**Implementation**:
- `GrooveBuilder` is an immutable builder
- `.build()` returns a `GrooveTemplate` object
- `.use()` applies the template to subsequent events
- `.swing()` inline override merges with template

---

#### Step 4: Semantic Timing API

Implement the timing primitives from RFC-047 Section 4.2.

| Method | Purpose | Effect |
|--------|---------|--------|
| `.rest(duration)` | Structural silence | Advances cursor, no node |
| `.shift(ticks)` | Micro-timing offset | Offsets next event, no cursor advance |
| `.wait(duration)` | Schedule delay | Delays clip launch at runtime |
| `.playbackOffset(ms)` | Latency compensation | Hardware output delay |

**Implementation**:
- `.rest()` already exists - verify behavior
- `.shift()` stores offset, applied to next `addNote()` call
- `.wait()` sets `clip.startTick` offset
- `.playbackOffset()` writes to `REG.PLAYBACK_OFFSET` in SAB

---

## Verification Plan

### Unit Tests
- `stack.spec.ts`: Verify graph branching topology
- `voice.spec.ts`: Verify named voice isolation
- `groove.spec.ts`: Verify swing application
- `timing.spec.ts`: Verify `.shift()`, `.wait()`, `.playbackOffset()`

### Integration Test
- Create a 4-voice fugue using `.stack()` and `.voice()`
- Verify all voices play at correct timing

---

## Constraints

1. **Zero-Allocation in Hot Paths**: Builder methods may allocate, but final graph traversal must not.
2. **Immutable Builders**: `GrooveBuilder` must be immutable (return new instance on each method).
3. **Type Safety**: All methods must be fully typed (no `any`).

---

## Deliverables

Submit completion report as: `047-54-by-engineer-phase8-complete.md`

**Execute.**
