# Implementation: Task 019

## Changes

### Modified `packages/composer/src/types.ts`
- Added `ScaleMode` type: `'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian'`
- Added `ScaleContext` interface with `root`, `mode`, `octave`
- Added `DegreeOptions` interface with `octaveOffset?` and `alteration?`

### Modified `packages/composer/src/clips/SynapticClip.ts`
- Added import for `ScaleContext`, `ScaleMode`
- Added field: `protected scaleContext: ScaleContext | null = null`
- Added method: `setScale(root, mode, octave = 4)` — sets scale context
- Added method: `getScaleContext()` — returns current scale context

### Modified `packages/composer/src/clips/SynapticMelody.ts`
- Updated `degree()` signature to include `options?: DegreeOptions`
- Passes options through to cursor

### Modified `packages/composer/src/cursors/SynapticMelodyNoteCursor.ts`
- Added import for `DegreeOptions`, `ScaleMode`
- Added `SCALE_INTERVALS` constant with intervals for all 7 modes
- Completely rewrote `degree()` to:
  - Require scale context (throws if not set)
  - Use scale intervals for pitch calculation
  - Support `octaveOffset` and `alteration` options
  - Handle degree wrapping across octaves

### Created `packages/composer/src/__tests__/scale.test.ts`
- 14 tests covering setScale(), degree(), modes, octaveOffset, alteration

## Verify
```
cd packages/composer && pnpm exec jest scale.test.ts
```
Output: 14 passed, 14 total

## Acceptance
- [x] `ScaleContext` type defined
- [x] `setScale('G', 'major')` sets context
- [x] `degree(1)` returns root in current scale
- [x] `degree(3)` returns major/minor third correctly
- [x] `degree(1, 0.5, { octaveOffset: 1 })` shifts octave
- [x] `degree(2, 0.5, { alteration: 1 })` adds sharp
- [x] Error if degree() without setScale()
- [x] Tests pass (14/14)
