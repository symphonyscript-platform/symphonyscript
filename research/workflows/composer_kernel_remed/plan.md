# Composer & Kernel Remediation: Direct-to-Silicon Architecture

## Executive Summary
This document outlines the remediation strategy to align the SymphonyScript Composer layer with the Kernel's Zero-Allocation and "Direct-to-Silicon" principles. The goal is to eliminate all intermediate memory allocations during production/playback and guarantee data integrity even under high load.

## 1. Architectural Principles

### 1.1 Direct-to-Silicon
-   **No Buffering**: The Composer layer (`SynapticClip`) will **NOT** buffer operations or maintain a history array (`this.operations`).
-   **Immediate Flush**: All musical events (Notes, CCs) are flushed immediately to the Kernel's `SharedArrayBuffer` via `SiliconBridge`.
-   **Kernel as Truth**: The Kernel state is the single source of truth. The Composer layer acts purely as a stateless (or minimal state) fluent API for mutation.

### 1.2 Zero-Allocation Policy
-   **Primitive State**: `SynapticClip` and its cursors must store all state (Current Time, Transpose, Velocity, etc.) using **primitive values** (numbers, enums).
-   **No Objects**: No objects, arrays, or closures may be created in hot paths (e.g., inside loops, `note()`, `commit()`).
-   **Singleton Cursors**: Cursors (e.g., `SynapticMelodyNoteCursor`) are allocated **once** per Clip and reused. `clip.note()` merely resets the state of the existing cursor instance.

## 2. Kernel Layer Remediation

To safely support the Direct-to-Silicon architecture without data loss, the Kernel must implement backpressure.

### 2.1 Ring Buffer Expansion
-   **Capacity**: Increase Command Ring Buffer capacity from `1,024` to **65,536** entries (~1MB).
-   **Impact**: Allows bursting ~65k synchronous operations (notes/edits) before filling the buffer.

### 2.2 SiliconBridge Backpressure
-   **Mechanism**: **Spin-Wait**.
-   **Behavior**: When `SiliconBridge.insertAsync` encounters a full Ring Buffer:
    1.  It enters a tight loop (Spin-Wait).
    2.  It repeatedly checks `Atomics.load` on the Ring Buffer header.
    3.  It halts the Main Thread until the Audio Thread consumes commands and frees space.
-   **Safety**: Ensure a timeout (e.g., 500ms) throws a `KERNEL_PANIC` to prevent infinite deadlocks if the Audio Thread crashes.
-   **Justification**: This guarantees data integrity (no dropped notes) while maintaining a synchronous API for user scripts.

## 3. Composer Layer Remediation

### 3.1 SynapticClip Refactor
-   **Remove Operations Array**: Delete `protected operations: Operation[]` and all `.push()` logic.
-   **Flatten State**: Replace all state objects with primitive fields:
    -   `activeDynamics` -> `_dynType`, `_dynStart`, `_dynDuration`, `_dynFrom`, `_dynTo`.
    -   `scaleContext` -> `_scaleRoot`, `_scaleMode`.
    -   `_humanizeSettings` -> `_humVel`, `_humTiming`.
-   **Refactor `flushNote`**: Rewrite to calculate final values from primitive state and call `bridge.insertAsync` directly.

### 3.2 Method Categories

**One-Shot Methods (Direct Flush)**:
Methods that immediately write to Kernel and return `this` (the Clip):

| Method | Kernel Action |
|--------|---------------|
| `transpose(n)` | `Atomics.store(sab, REG.TRANSPOSE, n)` |
| `tempo(bpm)` | `Atomics.store(sab, HDR.BPM, bpm)` |
| `cc(num, val)` | `bridge.insertAsync(OPCODE.CC, ...)` |
| `pitchBend(val)` | `bridge.insertAsync(OPCODE.BEND, ...)` |
| `rest(dur)` | Advance internal tick (or emit REST node) |

No cursor. No buffering. Fire immediately.

**Cursor-Based Methods (Deferred Commit)**:
Methods that branch to a singleton cursor, accumulate modifiers, then commit implicitly:

```
clip.note(60)       // → cursor (sets pitch=60)
    .velocity(0.8)  // → cursor (sets _velocity=0.8)
    .staccato()     // → cursor (sets _duration *= 0.5)
    .note(62)       // → IMPLICIT COMMIT: flush to Kernel, reset, delegate
```

### 3.3 Cursor Optimization
-   **Lifecycle**: `SynapticClip` initializes `_noteCursor` and `_chordCursor` in its constructor.
-   **Re-entry**: `clip.note(pitch)` resets `_noteCursor` state (pitch, velocity, duration) and returns it.
-   **Commit**: `cursor.commit()` calls `clip.flushNote(...)` and resets pending state.

### 3.4 Cursor Architecture: Parallel Hierarchy

**Decision**: Use a **parallel class hierarchy** for cursors that mirrors the Clip hierarchy.

**Rationale**:
-   **No Proxies**: Avoids runtime magic. Performance-conscious developers won't be suspicious.
-   **No Traits/Mixins**: Avoids TypeScript complexity and hidden behavior.
-   **Explicit & Verbose**: Each cursor subclass explicitly lists its escape methods. This is the cheapest tradeoff.

**Structure**:
```
BaseClip                    ->  BaseNoteCursor<TClip>
  ├─ MelodyClip             ->    ├─ MelodyNoteCursor
  ├─ StringsClip            ->    ├─ StringsNoteCursor
  └─ KeyboardClip           ->    └─ KeyboardNoteCursor
```

**Escape Method Pattern**:
```typescript
class MelodyNoteCursor extends BaseNoteCursor<MelodyClip> {
  // Modifier (stays on cursor)
  velocity(v: number): this { this._velocity = v; return this; }

  // Escape (commits + delegates to clip)
  note(pitch: number): MelodyNoteCursor {
    this.commit();
    return this.clip.note(pitch);
  }
}
```

**Inheritance Strategy**:
-   **BaseNoteCursor**: Contains common modifiers (`velocity`, `staccato`, `articulation`) and common escapes (`rest`, `cc`, `pitchBend`).
-   **Subclasses**: Add only clip-specific escapes (`note`, `chord`, `bow`, `pizzicato`, etc.).

## 4. Implementation Tasks

> **Full task specifications:** [tasks/INDEX.md](./tasks/INDEX.md)

### Phase 1: Foundation

| Task | Priority | Description |
|------|----------|-------------|
| 060 | 🔴 CRITICAL | Kernel Backpressure (64k buffer + Spin-Wait) |
| 059 | 🟠 HIGH | Define numeric Enums for Dynamics, Curves, Modes |
| 069 | 🟠 HIGH | Mark Session/Track as design-time builders |

### Phase 2: Core Remediation

| Task | Priority | Description |
|------|----------|-------------|
| 057 | 🔴 CRITICAL | Flatten SynapticClip state to primitives |
| 066 | 🟠 HIGH | Refactor SynapticDrums drum map to Uint8Array |
| 070 | 🟠 HIGH | Refactor key.ts utilities (out-parameter pattern) |
| 068 | 🟠 HIGH | Refactor SynapticGrooveBuilder allocations |

### Phase 3: Operations Removal

| Task | Priority | Description |
|------|----------|-------------|
| 058 | 🔴 CRITICAL | Remove operations[] array entirely |
| 063 | 🟠 HIGH | Remove isolate() closures (pushState/popState) |
| 067 | 🟠 HIGH | Decide FrozenClip fate (delete/refactor/mark) |

### Phase 4: API Refactoring

| Task | Priority | Description |
|------|----------|-------------|
| 061 | 🟠 HIGH | Refactor Cursors to Parallel Hierarchy |
| 062 | 🟠 HIGH | Refactor One-Shot Methods to Direct-to-Kernel |
| 064 | 🔴 CRITICAL | Refactor SynapticMelody chord/voicing methods |
| 065 | 🟠 HIGH | Refactor loop/play/progression methods |

## 5. Verification
-   **Correctness**: Verify strict 1:1 mapping between API calls and Kernel commands.
-   **Memory**: Profile heap usage during a high-throughput loop (100k notes). Allocations should be effectively zero (GC flatline).
-   **Reliability**: Stress test with >65k burst edits to trigger and verify Spin-Wait behavior.

---

## Appendix A: Comprehensive Violations Audit

### A.1 SynapticClip.ts (Core Clip Base)

| Violation | Description | Severity |
|-----------|-------------|----------|
| `operations: Operation[]` | Array stores all operations; must be removed | 🔴 Critical |
| `operations.push({...})` | Object literal allocation on every note/cc | 🔴 Critical |
| `activeDynamics` object | Stores `{ type, start, duration, from, to }` as object | 🔴 Critical |
| `scaleContext` object | Stores `{ root, mode, octave }` as object | 🔴 Critical |
| `_humanizeSettings` object | Stores `{ velocity, timing }` as object | 🔴 Critical |
| `isolate()` closures | Creates callback closures for temp state | 🟠 High |
| `freeze()` → `new FrozenClip()` | Allocates new object | 🟠 High |
| `build()` → `{ ... }` | Allocates ClipNode object literal | 🟠 High |

---

### A.2 SynapticMelody.ts (Melody Builder)

| Violation | Description | Severity |
|-----------|-------------|----------|
| Inherits all `SynapticClip` violations | | 🔴 Critical |
| `chordSymbolToPitches()` returns `number[]` | Allocates new array per chord | 🔴 Critical |
| `findBestVoicing()` returns `number[]` | Allocates new array for best voicing | 🔴 Critical |
| `voiceLead()` allocates `let previousVoicing: number[] = []` | Array allocation in loop | 🔴 Critical |
| `loop()` takes callback `(clip) => void` | Closure allocation per loop | 🟠 High |
| `progression()` options object `{ duration?: number }` | Object parameter | 🟠 High |

---

### A.3 SynapticDrums.ts (Drum Builder)

| Violation | Description | Severity |
|-----------|-------------|----------|
| `_drumMap = { ...DEFAULT_DRUM_MAP }` | Object spread allocation in constructor | 🟠 High |
| `withMapping()` → `{ ...this._drumMap, ...mapping }` | Object spread on every call | 🟠 High |
| `euclidean()` options object | Object parameter | 🟠 High |
| Inherits all `SynapticClip` violations | | 🔴 Critical |

---

### A.4 FrozenClip.ts

| Violation | Description | Severity |
|-----------|-------------|----------|
| `toOperations()` → `[...clipNode.operations]` | Array spread allocation | 🟠 High |
| `filter()` in `duration` getter | Creates new filtered array | 🟠 High |
| `filter()` in `noteCount` getter | Creates new filtered array | 🟠 High |
| Stores `ClipNode` which has `operations[]` | Entire class is allocation-centric | 🟠 High |

---

### A.5 SynapticGrooveBuilder.ts

| Violation | Description | Severity |
|-----------|-------------|----------|
| `build()` → `{ ... }` object literal | Allocates GrooveTemplate object | 🟠 High |
| `.slice()` on Float32Arrays | Creates new typed arrays | 🟠 High |

---

### A.6 Session.ts

| Violation | Description | Severity |
|-----------|-------------|----------|
| `tracks: TrackNode[] = []` | Array allocation | 🟠 High |
| `buses: EffectBusConfig[] = []` | Array allocation | 🟠 High |
| `tracks.push(...)` | Array mutation | 🟠 High |
| `buses.push(...)` | Array mutation | 🟠 High |
| `build()` → `{ ...tracks: [...this.tracks] }` | Object + array spread | 🟠 High |
| `timeSignature: [number, number]` | Tuple allocation | 🟠 High |

---

### A.7 Track.ts

| Violation | Description | Severity |
|-----------|-------------|----------|
| `insertEffects: InsertEffect[] = []` | Array allocation | 🟠 High |
| `sendConfigs: SendConfig[] = []` | Array allocation | 🟠 High |
| `insertEffects.push(...)` | Array mutation | 🟠 High |
| `sendConfigs.push(...)` | Array mutation | 🟠 High |
| `build()` → `{ ...inserts: [...this.insertEffects] }` | Object + array spread | 🟠 High |
| `timeSignature: [number, number]` | Tuple allocation | 🟠 High |

---

### A.8 Cursors (SynapticMelodyNoteCursor, SynapticChordCursor, etc.)

| Violation | Description | Severity |
|-----------|-------------|----------|
| Calls `clip.flushNote()` which pushes to `operations[]` | Inherits clip's allocation violation | 🔴 Critical |
| Missing escape method pattern | Must implement implicit commit + delegate | 🟠 High |
| Current hierarchy doesn't match new parallel design | Need `MelodyNoteCursor`, `DrumsHitCursor`, etc. | 🟠 High |
| `SynapticChordCursor.pitches[]` | Pre-allocated array in constructor | ✅ OK |

> **Note**: Cursors need full refactoring to align with Direct-to-Kernel architecture and parallel hierarchy pattern.

---

### A.9 Utils

#### chord.ts ✅ Clean
- Uses module-level `CHORD_RESULT` reusable object.
- `parseChord()` writes to out-parameter.

#### key.ts
| Violation | Description | Severity |
|-----------|-------------|----------|
| `parseNoteName()` returns `{ letter, accidental, octave }` | Object allocation per note | 🟠 High |
| `applyKeySignature()` calls `parseNoteName()` | Object allocation per call | 🟠 High |
| Template string interpolation `${...}` | String allocation | 🟠 High |

#### pitch.ts, scales.ts, romanAdapter.ts
- **TODO**: Audit for similar violations.

---

### A.10 types.ts

| Violation | Description | Severity |
|-----------|-------------|----------|
| String-based types (`'major' | 'minor'`, `'sharp' | 'flat'`) | Should be numeric enums | 🟠 High |
| Object interfaces (`ScaleContext`, `KeyContext`, `DegreeOptions`) | Forces object allocation | 🔴 Critical |
| `ClipNode.operations[]` | Core violation: array-centric design | 🔴 Critical |

---

## Appendix B: Severity Legend

| Icon | Severity | Action |
|------|----------|--------|
| 🔴 | **Critical** | Must fix first. Blocks production. |
| 🟠 | **High** | Must fix. No exceptions. |
| ✅ | **OK** | No action needed. |

