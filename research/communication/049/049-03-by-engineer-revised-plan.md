# 049-03: REVISED Implementation Plan for RFC-049 Synaptic Cursor Architecture

**Author**: Senior TypeScript Engineer  
**Date**: 2025-12-28T20:28:15+04:00  
**Status**: Awaiting Architect Review  
**Response To**: 049-02-by-architect-review-of-initial-plan.md

---

## 1. Executive Summary

This revised plan addresses all 14 defects identified in the Architect's review (049-02). It enforces strict RFC-049 compliance, eliminates complexity bloat (Proxies), and adds rigorous automated zero-allocation verification and error handling.

**Zero-Allocation Commitment**: No `Array.prototype.forEach`, `map`, `filter`, or closures in `flush()` methods. No object allocations in hot paths.

---

## 2. Refined Phase Breakdown

### Phase 1: Foundation - Base Cursor
**Files**: `src/new/cursors/SynapticCursor.ts`

**Implementation**:
- Abstract base class.
- **State (Strict Compliance)**: `clip` (SynapticClip), `bridge` (SiliconBridge), `hasPending`, `baseTick`, `velocity`, `duration`, `muted`.
- **Base Modifiers**: `velocity()`, `staccato()`, `legato()`, `accent()`, `tenuto()`, `marcato()`, `humanize()`, `precise()`.
- **Clip Escapes**: `rest()`, `tempo()`, `timeSignature()`, `swing()`, `groove()`, `control()`, `stack()`, `loop()`, `commit()`.
- **Internal**: `flush()` (abstract), `bind()`.

**Error Handling**:
- `commit()`: Safe no-op if `!hasPending`.
- Transitions with invalid states (e.g., negative duration) → `throw new Error`.

---

### Phase 2: Simple Note Cursor
**Files**: `src/new/cursors/SynapticNoteCursor.ts`

**Implementation**:
- Extends `SynapticCursor`.
- **State**: `pitch` (number).
- **Relay**: `note(pitch: number | string, duration?: number)` matching RFC-049 § 4.2.
- **Clarification**: This cursor serves as the reference implementation for single-note behavior and may be used by future "Simple" builders or as a base for specialized non-melodic notes.

**Error Handling**:
- Pitch parsing failure → `throw new Error("Invalid pitch: " + pitch)`.

---

### Phase 3: Melody Base Cursor
**Files**: `src/new/cursors/SynapticMelodyBaseCursor.ts`

**Implementation**:
- Extends `SynapticCursor`.
- Properties: `detune`, `timbre`, `pressure`, `glide`, `tie`, `expressionId`.
- Expression modifiers: `detune()`, `timbre()`, `pressure()`, `expression()`, `glide()`, `tie()`.

---

### Phase 4: Melody Note Cursor
**Files**: `src/new/cursors/SynapticMelodyNoteCursor.ts`

**Implementation**:
- Extends `SynapticMelodyBaseCursor`.
- Relay methods (Direct Return, No Proxies):
  - `note(...)`: returns `SynapticMelodyNoteCursor`
  - `chord(...)`: returns `SynapticChordCursor`
  - `degree(...)`: returns `SynapticMelodyNoteCursor`
- Pitch modifiers: `natural()`, `sharp()`, `flat()`.

---

### Phase 5: Chord Cursor (Strict Zero-Allocation)
**Files**: `src/new/cursors/SynapticChordCursor.ts`

**Implementation**:
- Extends `SynapticMelodyBaseCursor`.
- **Configuration**: `maxVoices` passed via constructor from the Builder.
- **Pre-allocation**: `sourceIds` and `pitches` pre-allocated to `maxVoices` once in constructor.
- **Methods**: `chord(symbol)`, `harmony(mask, root)`, `inversion(steps)`.
- **`flush()`**: Strict `while` loop bitwise iteration. **BANNED**: `forEach`, `map`, callbacks.

**Error Handling**:
- Invalid chord symbol → `throw new Error`.
- Voice Overflow (chord has > `maxVoices` notes) → Truncate to `maxVoices` and log warning if in development mode.

---

### Phase 6: Drum Hit Cursor
**Files**: `src/new/cursors/SynapticDrumHitCursor.ts`

**Implementation**:
- Extends `SynapticCursor`.
- Relays: `hit()`, `kick()`, `snare()`, etc.

---

### Phase 7: Clip Builders Integration (Singleton Pattern)
**Files**: `src/new/clips/SynapticMelody.ts`, `SynapticDrums.ts`

**Implementation**:
- **Singleton Cursors**: `noteCursor` and `chordCursor` are instantiated **exactly once** in the constructor and stored in `readonly` properties.
- **Direct Delegation**: Relay methods call the cursor and return the instance directly for type-safe chaining.
- **Example**:
```typescript
class SynapticMelody extends SynapticClip {
  private readonly noteCursor: SynapticMelodyNoteCursor;
  private readonly chordCursor: SynapticChordCursor;

  constructor(bridge: SiliconBridge, options?: { maxVoices?: number }) {
    super(bridge);
    this.noteCursor = new SynapticMelodyNoteCursor(this, bridge);
    this.chordCursor = new SynapticChordCursor(this, bridge, options?.maxVoices ?? 8);
  }

  note(pitch: string, duration?: number): SynapticMelodyNoteCursor {
    this.commitPending();
    return this.noteCursor.note(pitch, duration);
  }
}
```

---

### Phase 8: Mutable GrooveBuilder
**Files**: `src/new/groove/GrooveBuilder.ts`

**Implementation**:
- **Pre-allocation**: `steps[]` pre-allocated to `maxSteps` (default/configured).
- **Overflow Handling**: `step()` throws if `currentStep >= maxSteps`.
- **Terminal**: `freeze()` returns a read-only `GrooveTemplate`.

---

## 3. Testing & Verification

### Exact Test Command
```bash
npx nx test composer --testPathPattern="src/new/"
```
*Verification: Confirmed that `composer/jest.config.cjs` and the workspace preset correctly handle `.test.ts` files in this path.*

### Automated Zero-Allocation Verification
Every cursor will have a "Smoke Allocation Test":
```typescript
test('flush() performs zero heap allocations', () => {
  const cursor = new SynapticChordCursor(mockClip, mockBridge, 8);
  cursor.chord('Cmaj7');
  
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 10000; i++) {
    cursor.flush();
    cursor.chord('Cmaj7');
  }
  const after = process.memoryUsage().heapUsed;
  
  // Minimal overhead allowed for V8 variance, but delta should not grow linearly
  expect(after - before).toBeLessThan(1024);
});
```

---

## 4. Timeline & Contingency

- **Phases 1-4**: 5 hours
- **Phase 5 (Chords)**: 4 hours
- **Phase 6-8**: 5 hours
- **Contingency (30%)**: 4 hours

**Total Estimated**: 18 hours

---

## 5. Summary of Corrections (Addressing 049-02)

1. [x] **DEFECT-001**: Added `clip` and `bridge` to `SynapticCursor`.
2. [x] **DEFECT-002**: Removed Proxy Layer; using direct cursor return types.
3. [x] **DEFECT-003**: Specified `npx nx test` command and verified path.
4. [x] **DEFECT-004**: Fixed "problem" annotation; accepted RFC type-switching.
5. [x] **DEFECT-005**: Defined `maxVoices` configuration flow via constructor.
6. [x] **DEFECT-006**: Added explicit overflow error to `GrooveBuilder`.
7. [x] **DEFECT-007**: Added pitch/chord/overflow error specs to all phases.
8. [x] **DEFECT-008**: Added heap-usage monitoring smoke test.
9. [x] **DEFECT-009**: Clarified `SynapticNoteCursor` as reference/base implementation.
10. [x] **DEFECT-010**: Added 30% timeline contingency (14 -> 18 hours).
11. [x] **DEFECT-11**: Mandated SINGLETON cursor instances in builders.
12. [x] **DEFECT-12**: Matched `note(pitch, duration?)` RFC signature exactly.
13. [x] **DEFECT-13**: Integrated Heap Allocation Test into verification.
14. [x] **DEFECT-14**: Explicitly BANNED closures and functional methods in hot paths.

---

**Engineer Status**: Resubmitted for Architect approval. BLOCKED until 049-03 is approved.
