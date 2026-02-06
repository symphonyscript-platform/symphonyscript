# Task 053: Document Octave-Aware voiceMovementCost

**Priority:** LOW  
**Category:** Documentation  
**Status:** Open  
**Created:** 2026-02-06  
**Source:** Composer Audit M-002

---

## Problem

`voiceMovementCost()` exists in both theory package (HarmonyMask-based, pitch-class only) and composer package (number[]-based, octave-aware). This is intentional but not documented.

## Current State

```typescript
// Theory: packages/theory/src/harmony/voiceleading.ts
// Uses HarmonyMask, pitch-class comparison (0-23)
export function voiceMovementCost(fromMask: HarmonyMask, toMask: HarmonyMask): number

// Composer: packages/composer/src/clips/SynapticMelody.ts:311-328
// Uses number[], absolute pitch comparison (includes octave)
private voiceMovementCost(from: number[], to: number[]): number
```

## Required Implementation

Add documentation to clarify the distinction:

```typescript
/**
 * Calculate voice movement cost between two voicings.
 * 
 * NOTE: This is intentionally different from theory's voiceMovementCost.
 * - Theory version: pitch-class only (HarmonyMask), for scale-degree analysis
 * - Composer version: absolute pitch (number[]), for octave-aware voice leading
 * 
 * The octave-aware version is essential for proper voice leading where
 * we want to minimize actual pitch distance, not just pitch-class distance.
 * 
 * @internal
 */
private voiceMovementCost(from: number[], to: number[]): number
```

## Files to Modify

- `[MODIFY] packages/composer/src/clips/SynapticMelody.ts`

## Acceptance Criteria

- [ ] JSDoc comment explains why two versions exist
- [ ] Comment clarifies octave-aware vs pitch-class distinction
- [ ] No code changes, documentation only
