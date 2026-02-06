# Implementation Plan: Task 042 - tempoEnvelope()

**Date:** 2026-02-05
**Author:** Symphony-Engineer-Zero
**Mode:** MODE C (High-Level DSL)

---

## Analysis

The task requires implementing multi-keyframe tempo transitions via `tempoEnvelope()`. This allows gradual tempo changes over time with different curve types.

## Atomic Tasks

### Task 1: Add types to types.ts
- Add `TempoCurve` type: `'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'`
- Add `TempoKeyframe` interface: `{ beat: number; bpm: number; curve?: TempoCurve }`
- Add `TempoEnvelopeOp` interface: `{ kind: 'tempoEnvelope'; keyframes: TempoKeyframe[]; tick: number }`
- Update `ClipNode.operations` union to include `TempoEnvelopeOp`

### Task 2: Implement `tempoEnvelope()` on SynapticClip
- Signature: `tempoEnvelope(keyframes: TempoKeyframe[]): this`
- Validate minimum 2 keyframes (throw if < 2)
- Push `TempoEnvelopeOp` to operations at current tick
- Return `this` for chaining

### Task 3: Add cursor escape method
- Add `tempoEnvelope(keyframes: TempoKeyframe[]): SynapticClip` to ComposerCursor

### Task 4: Export types from index.ts

### Task 5: Create comprehensive tests

---

## Files to Modify

1. `packages/composer/src/types.ts` - Add types, update union
2. `packages/composer/src/clips/SynapticClip.ts` - Add tempoEnvelope()
3. `packages/composer/src/cursors/ComposerCursor.ts` - Add escape
4. `packages/composer/src/index.ts` - Export types
5. `packages/composer/src/__tests__/TempoEnvelope.test.ts` - Create tests

---

**Status:** AWAITING_APPROVAL
