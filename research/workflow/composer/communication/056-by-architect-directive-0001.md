# Directive: Fix Pre-existing Build Errors

## Task
Fix build errors in `SynapticClip.ts` and `SynapticMelody.ts` that were identified as "pre-existing".

## Requirements

1.  **Fix `SynapticClip.ts` (Line ~852)**:
    *   Replace invalid property `this.dynamicsPoints` with `this.velocityCurvePoints`.
    *   Ensure `activeDynamics` and `dynamicsStartTick` are also saved/restored in `isolate()` when `options.dynamics` is true.

2.  **Fix `SynapticMelody.ts` (Line ~644)**:
    *   Add `override` modifier to the method identified in the build error (likely `generateSourceId` or `build`).

## Files

- `[MODIFY] packages/composer/src/clips/SynapticClip.ts`
- `[MODIFY] packages/composer/src/clips/SynapticMelody.ts`

## Acceptance Criteria

- [ ] `SynapticClip.ts` compiles without error.
- [ ] `SynapticMelody.ts` compiles without error.
- [ ] `isolate()` correctly restores full dynamics state.
