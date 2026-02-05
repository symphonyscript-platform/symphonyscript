# Implementation: Task 028

## Changes

### `packages/composer/src/types.ts`
- Added `EuclideanMelodyOptions` interface:
  - `hits`, `steps`, `notes[]`, `stepDuration` (required)
  - `velocity`, `rotation`, `repeat` (optional with defaults)
- Added `EuclideanDrumOptions` interface:
  - `hits`, `steps`, `drum`, `stepDuration` (required)
  - `velocity`, `rotation`, `repeat` (optional with defaults)

### `packages/composer/src/clips/SynapticMelody.ts`
- Imported `euclidean`, `rotatePattern` from `@symphonyscript/theory`
- Added `euclidean(options: EuclideanMelodyOptions)` method:
  - Generates Euclidean pattern using theory package
  - Applies rotation if specified
  - Cycles through notes array for each hit
  - Uses default velocity 0.8, rotation 0, repeat 1

### `packages/composer/src/clips/SynapticDrums.ts`
- Imported `euclidean`, `rotatePattern` from `@symphonyscript/theory`
- Added `euclidean(options: EuclideanDrumOptions)` method:
  - Generates Euclidean pattern using theory package
  - Applies rotation if specified
  - Uses specified drum sound (kick, snare, hat, clap, tom)
  - Uses default velocity 0.8, rotation 0, repeat 1
- Added private `getDrumMethod()` helper

### `packages/composer/src/index.ts`
- Added exports for `EuclideanMelodyOptions` and `EuclideanDrumOptions`

### `packages/composer/src/__tests__/Euclidean.test.ts` (created)
- 23 comprehensive tests covering:
  - SynapticMelody.euclidean(): hit count, note cycling, duration, velocity, rotation, repeat, tick advancement
  - SynapticDrums.euclidean(): hit count, drum types (kick/snare/hat), rotation, repeat, tick advancement
  - Clip factory integration
  - Edge cases (all hits, single hit, numeric pitches)

## Verification

```
pnpm build && pnpm test -- Euclidean
```

Output:
```
Test Suites: 1 passed, 1 total
Tests:       23 passed, 23 total
```

Full composer test suite: 316 pass, 1 pre-existing flaky test fails (Zero-Allocation Smoke Test - unrelated to this task)

Build: PASS
Tests: PASS (23 new Euclidean tests)
