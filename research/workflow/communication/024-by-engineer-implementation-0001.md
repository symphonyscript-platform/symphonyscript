# Implementation: Task 024

## Changes

### `packages/composer/src/types.ts`
- Added `DynamicsOp` interface for dynamics operations
- Added `VelocityPoint` interface for custom velocity curves

### `packages/composer/src/clips/SynapticClip.ts`
- Added dynamics state: `activeDynamics`, `dynamicsStartTick`, `velocityCurvePoints`
- Implemented `crescendo(duration, options?)` method
- Implemented `decrescendo(duration, options?)` method
- Implemented `velocityRamp(to, duration, options?)` method
- Implemented `velocityCurve(points, duration)` method
- Added `calculateDynamicsVelocity()` for velocity interpolation
- Added `applyCurve()` for curve transformations (linear, exponential, ease-in, ease-out)
- Added `interpolateCurveVelocity()` for custom curve interpolation
- Modified `flushNote()` to apply dynamics before humanization

### `packages/composer/src/cursors/ComposerCursor.ts`
- Added `build()` escape method to enable fluent chaining: `melody.note('C4', 1).build()`

### `packages/composer/src/__tests__/dynamics.test.ts` (created)
- 12 tests covering all acceptance criteria

## Verify

```
pnpm test -- dynamics.test.ts
```

Output: PASS (12/12 tests)

```
pnpm test (all composer tests)
```

Output: PASS (234/234 tests)

## Acceptance Checklist

- [x] `crescendo(4)` increases velocity over 4 ticks
- [x] `decrescendo(4, { from: 1, to: 0.2 })` decreases to 0.2
- [x] `velocityRamp(0.8, 2)` ramps to 0.8 over 2 ticks
- [x] `velocityCurve([...], 4)` interpolates custom curve
- [x] Dynamics apply to notes within the range
- [x] Dynamics auto-clear after duration expires
- [x] Tests pass
- [x] No TODO/FIXME comments
- [x] No console.log statements

## Note

Pre-existing build error in `packages/kernel/src/silicon-bridge.ts:1786` (type mismatch `SiliconSynapse | null` vs `SiliconSynapse`) is unrelated to this task. All composer tests pass.
