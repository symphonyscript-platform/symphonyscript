# Task 056: Fix Pre-existing Build Errors

**Priority:** HIGH  
**Category:** Build Fix  
**Status:** Open  
**Created:** 2026-02-06  
**Source:** 056-by-architect-directive-0001.md

---

## Problem

Build errors exist in `SynapticClip.ts` and `SynapticMelody.ts` due to property renaming and missing override modifiers.

## Required Implementation

1.  **Fix `SynapticClip.ts`**:
    *   Replace `this.dynamicsPoints` with `this.velocityCurvePoints`.
    *   Save/restore `activeDynamics` and `dynamicsStartTick` in `isolate()`.

2.  **Fix `SynapticMelody.ts`**:
    *   Add `override` modifier to overridden methods (likely `stack` or `generateSourceId` depending on TS config).

## Files to Modify

- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`
- `[MODIFY] packages/composer/src/clips/SynapticMelody.ts`

## Acceptance Criteria

- [ ] `SynapticClip.ts` compiles without error
- [ ] `SynapticMelody.ts` compiles without error
- [ ] `isolate()` correctly restores full dynamics state
