# Implementation Plan: Task 040 - Custom Drum Mapping

**Date:** 2026-02-05
**Author:** Symphony-Engineer-Zero
**Mode:** MODE C (High-Level DSL)

---

## Analysis

The task requires implementing custom drum sound mappings for `SynapticDrums`, allowing users to:
1. Override default GM drum sounds
2. Add new custom drum sounds
3. Use custom sounds via `hit()` or named methods

## Atomic Tasks

### Task 1: Add `DrumMap` type to types.ts
- Add `DrumMap = Record<string, string | number>` type
- Values can be note names ('C2') or MIDI numbers (36)

### Task 2: Add default drum map and `_drumMap` to SynapticDrums
- Define `DEFAULT_DRUM_MAP` constant with GM standard mappings
- Add `protected _drumMap: DrumMap` property initialized with default

### Task 3: Implement `withMapping(mapping: DrumMap): this`
- Merges provided mapping with existing `_drumMap`
- Returns `this` for chaining

### Task 4: Add `resolveDrumPitch(name: string): number` helper
- Looks up name in `_drumMap`
- Falls back to `parsePitch` if not found
- Returns MIDI note number

### Task 5: Update `hit()` to accept string drum names
- Change signature: `hit(pitch: string | number, duration?: number)`
- Use `resolveDrumPitch` for string inputs

### Task 6: Update cursor's drum methods to use map
- `kick()`, `snare()`, `hat()`, etc. should use map lookup
- Delegate to `hit('kick')`, `hit('snare')`, etc.

### Task 7: Export `DrumMap` from index.ts

### Task 8: Create comprehensive tests

---

## Files to Modify

1. `packages/composer/src/types.ts` - Add DrumMap type
2. `packages/composer/src/clips/SynapticDrums.ts` - Add _drumMap, withMapping, resolveDrumPitch
3. `packages/composer/src/cursors/SynapticDrumHitCursor.ts` - Update hit() signature and drum methods
4. `packages/composer/src/index.ts` - Export DrumMap
5. `packages/composer/src/__tests__/DrumMap.test.ts` - Create tests

---

**Status:** AWAITING_APPROVAL
