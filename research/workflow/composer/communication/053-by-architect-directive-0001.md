# Directive: Task 053

## Task
Document the intentional difference between `SynapticMelody.voiceMovementCost` and `theory.voiceMovementCost`.

## Requirements

1.  Locate `voiceMovementCost` in `packages/composer/src/clips/SynapticMelody.ts`.
2.  Add a JSDoc comment explaining the distinction:
    *   Theory version uses `HarmonyMask` (pitch-class only) for scale degree analysis.
    *   Composer version uses `number[]` (absolute pitch) for octave-aware voice leading.
    *   This distinction is intentional and critical for minimizing physical interval distance.

## Files

- `[MODIFY] packages/composer/src/clips/SynapticMelody.ts`

## Acceptance Criteria

- [ ] JSDoc comment clearly explains octave-aware vs pitch-class distinction.
- [ ] No logic changes.
