# Composer Package Audit

**Package**: `@symphonyscript/composer`  
**Date**: 2025-02-06  
**Auditor**: Antigravity  
**Severity Levels**: 🔴 Critical | 🟠 Major | 🟡 Minor | 🟢 Info

---

## Executive Summary

The composer package has a **solid API design** and **excellent test coverage** (37 test files). However, there are **dead code paths**, **DRY violations**, and **incomplete implementations** that need remediation.

| Category | Issues Found |
|----------|-------------|
| Dead Code | 2 |
| DRY Violations | 2 |
| Incomplete Impl | 2 |
| Inconsistency | 2 |

---

## 🔴 Critical Issues

### C-001: `arpeggio()` Method Does Nothing

**File**: `clips/SynapticClip.ts` lines 361-364

```typescript
arpeggio(pattern: string): this {
    this.arpeggioPattern = pattern;  // NEVER READ
    return this;
}
```

**Evidence**: `grep -r "arpeggioPattern" src/` shows only writes, no reads.

**Impact**: User calls `clip.arpeggio('up')` expecting arpeggiation, but notes play as normal chords. This is API fraud.

**Required**: Implement actual arpeggio expansion in `flushNote()` or chord emission.

---

### C-002: `vibrato()` Method Does Nothing

**File**: `clips/SynapticClip.ts` lines 366-370

```typescript
vibrato(rate: number, depth: number): this {
    this.vibratoRate = rate;    // NEVER READ
    this.vibratoDepth = depth;  // NEVER READ
    return this;
}
```

**Evidence**: `grep -r "vibratoRate\|vibratoDepth" src/` shows only writes, no reads.

**Impact**: User sets vibrato parameters but no pitch modulation occurs.

**Required**: Emit CC1 (modulation) or pitch bend automation, or generate micro-pitch events.

---

## 🟠 Major Issues

### M-001: Duplicated `SCALE_INTERVALS` Constant

**Files**: 
- `clips/SynapticMelody.ts` lines 17-25
- `cursors/SynapticMelodyNoteCursor.ts` (original)

```typescript
/**
 * Scale intervals for degree-to-pitch conversion.
 * Duplicated from SynapticMelodyNoteCursor to avoid circular dependency.
 */
const SCALE_INTERVALS: Record<ScaleMode, number[]> = { ... };
```

**Impact**: Changes to scale intervals must be made in two places. Divergence risk.

**Required**: Extract to shared location or restructure imports.

---

### M-002: Duplicated `voiceMovementCost()` Implementation

**Files**:
- `@symphonyscript/theory` harmony/voiceleading.ts (zero-alloc, uses HarmonyMask)
- `clips/SynapticMelody.ts` lines 311-328 (allocating, uses number[])

Two implementations of the same algorithm with different signatures.

**Impact**: Bug fixes in one don't propagate to the other.

**Required**: Unify or adapt theory's implementation for composer use.

---

## 🟡 Minor Issues

### N-001: Mixed Error Handling Conventions

**Observation**: Theory package uses null returns (RFC-058). Composer throws:

```typescript
// SynapticMelody.ts line 87
throw new Error('degreeChord() requires scale() to be called first');
```

**Impact**: Inconsistent API contracts across packages.

**Recommendation**: Decide on convention. Throwing is acceptable for composer (main-thread only).

---

### N-002: Large Type Union in Operations

**File**: `types.ts` line 7

```typescript
operations: (NoteOperation | LoopOp | ClipOp | CCOperation | 
             PitchBendOperation | AftertouchOperation | 
             AutomationOperation | ScopeOp | TempoEnvelopeOp)[];
```

9 distinct operation types. Switch statements handling all cases are verbose.

**Recommendation**: Consider a visitor pattern or operation processor abstraction.

---

### N-003: Unused `loopEnabled` and `loopStart/End` State

**File**: `clips/SynapticClip.ts` lines 33-35

```typescript
protected loopEnabled: boolean = false;
protected loopStart: number = 0;
protected loopEnd: number = 0;
```

`setLoopRegion()` sets these but the state is never consumed in playback.

**Impact**: Loop region API exists but doesn't affect behavior.

---

### N-004: ccAutomation Map Allocation

**File**: `clips/SynapticClip.ts` line 31

```typescript
protected ccAutomation: Map<number, number>;
```

Allocates at construction. Acceptable for main-thread composer, but comments elsewhere claim "KERNEL-SAFE" which could cause confusion.

---

## 🟢 Info: What's Working Well

| Component | Assessment |
|-----------|------------|
| Fluent API | Excellent - all methods return `this`, intuitive chaining |
| Test Coverage | Excellent - 37 dedicated test files |
| Cursor Architecture | Good - clean separation of concerns |
| `flushNote()` Pipeline | Correct - single escape point with proper ordering |
| `progression()`, `voiceLead()` | Functional - real musical value |
| FrozenClip | Good - immutable snapshot pattern |

---

## Files Requiring Remediation

| File | Issues |
|------|--------|
| `clips/SynapticClip.ts` | C-001, C-002, N-003 |
| `clips/SynapticMelody.ts` | M-001, M-002 |
| `cursors/SynapticMelodyNoteCursor.ts` | M-001 (source of duplication) |

---

## Test Coverage Status

All existing tests pass. New tests will be needed for:
- Arpeggio expansion verification
- Vibrato CC/pitch-bend emission
- Loop region playback behavior

---

## Sign-off

This audit identifies 8 issues requiring attention:
- 2 Critical (dead code that misleads users)
- 2 Major (DRY violations with divergence risk)
- 4 Minor (conventions, unused state)

Remediation plan to follow in `002-remediation-plan.md`.
