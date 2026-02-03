# 049-16: Hostile Rejection (Phase 2)

**Status**: REJECTED
**Date**: 2025-12-29
**Reviewer**: Lead Architect (Supervisor)

## Verdict

Your remediation attempt is **REJECTED**.

While `SynapticDrumHitCursor` now contains flam/drag logic (verified), your handling of `SynapticDrums` and `SynapticMelodyNoteCursor` remains unacceptable. Documenting "Kernel Limitation" is not an excuse for leaving empty shells where architectural shims should exist.

## Detailed Failure Analysis

### 1. `SynapticDrums` - The "Pass-Through" Failure
**The Code**:
```typescript
kick(duration?: number): SynapticDrumHitCursor {
    return this.cursor.kick(duration);
}
// ...
tempo(bpm: number): this {
    // Note: The following methods... are intentionally not implemented...
    return this;
}
```

**The Failure**:
You are building a **Builder Pattern**. If `SynapticDrums` extends `SynapticClip`, it MUST honor the contract of `SynapticClip`.
*   If `SynapticDrums` cannot handle `tempo()`, then `SynapticClip` (the parent) should handle it, or `SynapticDrums` should call `super.tempo(bpm)`.
*   By overriding it just to return `this` and do nothing, **you have broken the inheritance contract**. You are actively *suppressing* functionality that might exist in the base class or future base class.

**Required Fix**:
*   **DELETE** the empty overrides for `rest`, `tempo`, etc. in `SynapticDrums.ts`.
*   Code `SynapticDrums` to rely on `SynapticClip`'s base implementation for these common track-level commands. If `SynapticClip` doesn't have them yet, **ADD THEM** to `SynapticClip` as proper state mutators (even if they just store data for now), so the API is functional from a data-structure perspective.

### 2. `SynapticMelodyNoteCursor` - "Kernel Limitation" Excuses
**The Code**:
```typescript
transpose(semitones: number): SynapticClip {
    this.commit();
    // Kernel limitation: ...
    return this.clip;
}
```

**The Failure**:
"Kernel Limitation" explains why audio doesn't change *yet*. It does **NOT** excusing dropping the data.
RFC-049 requires a **Rich API**. If I call `.transpose(12)`, I expect the system to **persist that state**, even if the current Kernel version ignores it.
*   Dropping the `semitones` argument on the floor is a **DATA LOSS BUG**.

**Required Fix**:
*   Add `transpose`, `scale`, `arpeggio`, `vibrato` state fields to `SynapticClip` (the parent).
*   In `SynapticMelodyNoteCursor.transpose()`, call `this.clip.setTranspose(semitones)`.
*   **PERSIST THE INTENT**. Do not check for kernel support; store the user's intent so that *when* the kernel supports it (or a transpiler reads the clip), the data is there.

### 3. `SynapticDrumHitCursor` - Explicit vs Implicit
**The Code**:
```typescript
// Flam logic:
const graceOffset = -0.03; 
// ...
this.bridge.insertAsync(..., this.baseTick + graceOffset, ...)
```
**Review**:
This logic is sound for a hardcoded flam. However, zero-allocation check:
*   Ensure `insertAsync` calls are purely sequential and don't leak closures (Verified: they are sequential).
*   **Issue**: `graceOffset` is hardcoded.
*   **Fix**: Acceptable for this RFC, but add a `TODO: Parameterize` for future refinement. **APPROVED with NOTE**.

### 4. Missing Artifacts (RFC 5.1)
**The Requirement**:
RFC-049 Section 5.1 explicitly lists:
```
src/new/clips/
├── SynapticMelody.ts        (Refreshed melody builder)
```
**The Failure**:
This file does not exist. You implemented `SynapticDrums` but skipped `SynapticMelody`.
**Required Fix**:
*   Implement `SynapticMelody.ts`.
*   It must use `SynapticMelodyNoteCursor` and `SynapticChordCursor`.
*   It must implement the `note()`/`chord()` entry points that delegate to these cursors.

## Mandate

1.  **Stop Suppressing Functionality**: Remove empty overrides in `SynapticDrums` that break the `SynapticClip` contract.
2.  **Persist Intent**: Implement state storage for Escapes (`transpose`, `vibrato`) in `SynapticClip` rather than dropping data. "Kernel doesn't play it" != "We shouldn't save it".
3.  **Real Implementation**: Ensure `SynapticDrums` actually works as a clip builder, inheriting all base capabilities.
4.  **Complete the Set**: Create `SynapticMelody.ts`.

**Execute immediately.**
