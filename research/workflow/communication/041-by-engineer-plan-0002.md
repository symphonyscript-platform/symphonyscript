# Implementation Plan: Task 041 - degreeChord()

**Date:** 2026-02-05
**Author:** Symphony-Engineer-Zero
**Mode:** MODE C (High-Level DSL)

---

## Analysis

The task requires implementing `degreeChord()` on `SynapticMelody` to create chords from scale degrees. This builds on the existing `degree()` method and `SynapticChordCursor`.

## Approach

1. Get scale context (throw if not set)
2. Convert each degree to a pitch using scale intervals
3. Create a bitmask from the intervals relative to the lowest pitch
4. Use `harmony(mask, root)` on the chord cursor

## Atomic Tasks

### Task 1: Implement `degreeChord()` on SynapticMelody
- Signature: `degreeChord(degrees: number[], duration?: number): SynapticChordCursor`
- Validate scale context exists
- Convert degrees to pitches using scale intervals
- Calculate intervals relative to root (lowest pitch)
- Use `harmony(mask, root)` to configure chord cursor
- Apply duration if provided

### Task 2: Create comprehensive tests

---

## Files to Modify

1. `packages/composer/src/clips/SynapticMelody.ts` - Add degreeChord()
2. `packages/composer/src/__tests__/DegreeChord.test.ts` - Create tests

---

**Status:** AWAITING_APPROVAL
