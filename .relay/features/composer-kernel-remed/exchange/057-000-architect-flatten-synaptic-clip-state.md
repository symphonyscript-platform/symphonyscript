# DIRECTIVE

Target: 057

## EXECUTE
1. **Dependency:** Ensure Task 059 (Refactor types.ts to Use Numeric Enums) is completed first. If `DynamicsType`, `ScaleMode` (as const enum with NONE), and curve enums do not exist in `packages/composer/src/types.ts`, REJECT this task until 059 is done.
2. **Flatten dynamics state** in `packages/composer/src/clips/SynapticClip.ts`: Remove `activeDynamics: DynamicsOp | null`. Add primitives: `_dynType`, `_dynStart`, `_dynDuration`, `_dynFrom`, `_dynTo`, and curve as enum/number. Update `crescendo()`, `decrescendo()`, `velocityRamp()`, `velocityCurve()`, `calculateDynamicsVelocity()`, `applyCurve()`, and `isolate()` so no object literals are allocated on state mutation. Keep `velocityCurvePoints` as-is (array is out of scope for this flatten).
3. **Flatten scale context** in `packages/composer/src/clips/SynapticClip.ts`: Remove `scaleContext: ScaleContext | null`. Add `_scaleRoot: number` (-1 = no scale), `_scaleMode` (enum), `_scaleOctave: number`. `setScale(root, mode, octave)` must convert `root` to a numeric value (e.g. 0–11 for C–B) and set the three primitives only. `getScaleContext()` may return a reconstructed object for API compatibility; internal state must be only primitives.
4. **Flatten humanize settings** in `packages/composer/src/clips/SynapticClip.ts`: Remove `_humanizeSettings: HumanizeSettings | null`. Add `_humVel: number`, `_humTiming: number`, `_humSeed: number` (or a single "has humanize" sentinel). `defaultHumanize(settings)` must only assign to these primitives; if `settings.seed` is provided, reinitialize `humanizeRng` once. `getHumanizeSettings()` may return an object built from primitives for API; no `{}` in setters or internal mutation paths.
5. **Subclasses and callers:** Update `packages/composer/src/clips/SynapticMelody.ts` and any cursor under `packages/composer/src/cursors/` that use `getScaleContext()` or scale/ humanize state so they remain compatible with the new getters. Update `packages/composer/src/__tests__/scale.test.ts` and `packages/composer/src/__tests__/Humanize.test.ts` so expectations match new getter behavior.
6. **Verification:** Run `pnpm build && pnpm test` and fix any failure. No TODOs, no placeholders, no stray `console.log`.

## CRITIQUE (If Rejecting)
1. 

## VERDICT
APPROVE
