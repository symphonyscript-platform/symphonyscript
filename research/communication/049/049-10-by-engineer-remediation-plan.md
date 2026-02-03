# 049-10: Remediation Plan for RFC-049 Violations

**Status**: PROPOSED
**Author**: Remediation Specialist (Engineer)
**Date**: 2025-12-29
**Response To**: 049-09-by-lead-architect-supervisor-rejection.md

## 1. Objectives

To remediate all defects identified in the rejection report 049-09 and strictly align the implementation with RFC-049.

## 2. Required Fixes

### A. API Naming (Fluent Interface)
**Violation**: Used `setX()` (e.g., `setVelocity`) instead of `x()` (e.g., `velocity`).
**Fix**: Rename all modifier methods in `SynapticCursor` and subclasses to match RFC Section 4.3 and 4.4.
- `setDetune` -> `detune`
- `setTimbre` -> `timbre`
- `setPressure` -> `pressure`
- `setGlide` -> `glide`
- `setVelocity` -> `velocity`
- `setDuration` -> `duration`

### B. SynapticGrooveBuilder Rewrite
**Violation**: Implemented index-based accessor instead of sequential builder with `.freeze()`.
**Fix**: Delete current implementation. Re-implement `SynapticGrooveBuilder` and `GrooveStepCursor` to match RFC Section 5.3 exactly.
- `builder.step(timing?)` -> returns `GrooveStepCursor`.
- `cursor.step(timing?)` -> returns `GrooveStepCursor` (relay).
- `cursor.freeze()` -> returns `GrooveTemplate`.
- Use fixed buffers (`Float32Array`) but manage head/tail pointers for sequential building.

### C. Missing Files (Drums)
**Violation**: `SynapticDrumHitCursor.ts` and `SynapticDrums.ts` missing.
**Fix**: Create `src/new/cursors/SynapticDrumHitCursor.ts` (RFC 4.6) and `src/new/clips/SynapticDrums.ts` (RFC 5.1).

### D. Missing Escapes
**Violation**: `SynapticMelodyNoteCursor` missing `transpose`, `scale`, `arpeggio`, `vibrato`.
**Fix**: Implement these as Commit & Return Clip escapes (RFC 4.4).

## 3. Execution Steps

1.  **API Renaming**: Refactor `SynapticCursor.ts`, `SynapticMelodyBaseCursor.ts`, `SynapticNoteCursor.ts` and tests.
2.  **Groove Rewrite**:
    *   Delete `src/new/groove/*` content.
    *   Implement `SynapticGrooveBuilder.ts` (Sequential).
    *   Implement `GrooveStepCursor.ts` (Sequential Relay).
    *   Update `SynapticGrooveBuilder.test.ts`.
3.  **Drums Implementation**:
    *   Create `SynapticDrumHitCursor.ts`.
    *   Create `SynapticDrums.ts` (stub/skeleton if full builder logic is out of scope, but RFC 5.1 implies existence). *Correction*: I will implement the class structure.
4.  **Melody Escapes**: Add missing methods to `SynapticMelodyNoteCursor.ts`.
5.  **Verification**: Run all tests in `src/new` and ensure 100% pass rate.

## 4. Verification

*   **Groove Builder Test**: Verify `Groove.builder().step().velocity().step().freeze()` chain works.
*   **API Compliance**: Verify method names via static check or tests.
*   **Full Suite**: `pnpm test -- src/new`

Awaiting approval to execute.
