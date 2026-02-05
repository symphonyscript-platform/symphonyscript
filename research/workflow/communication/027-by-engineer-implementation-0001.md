# Implementation: Task 027

## Changes

### `packages/composer/src/types.ts`
- Added `PitchBendOperation` interface:
  ```typescript
  interface PitchBendOperation {
      kind: 'pitchBend';
      value: number;  // -8192 to +8191 (center = 0)
      tick: number;
  }
  ```
- Updated `ClipNode.operations` union to include `PitchBendOperation`
- Added optional `legato?: boolean` field to `NoteOperation` (for future use)

### `packages/composer/src/clips/StringBuilder.ts` (created)
- `StringBuilder` class extends `SynapticMelody`
- `bend(semitones: number)` - converts semitones to MIDI pitch bend value:
  - Standard range: 2 semitones = full range (8192 units per semitone)
  - Validates semitones is within ±12 range
  - Values clamped to -8192 to +8191
- `slide(targetPitch, duration)` - creates note with `glide()` for portamento
- `bendReset()` - queues pitch bend = 0 (center position)
- `override build()` - merges pitch bend operations with base operations

### `packages/composer/src/Clip.ts`
- Added `string(name: string): StringBuilder` factory method
- Imported `StringBuilder`

### `packages/composer/src/index.ts`
- Added `StringBuilder` export
- Added `PitchBendOperation` type export

### `packages/composer/src/__tests__/StringBuilder.test.ts` (created)
- 23 comprehensive tests covering:
  - Class structure (extends SynapticMelody)
  - `bend()` positive/negative/zero semitones, validation, tick position
  - `bendReset()` queues 0 value
  - `slide()` creates note with correct pitch and duration
  - Combined workflow tests
  - `Clip.string()` factory tests
  - Chaining with melody methods
  - Pitch bend value calculations

## Verification

```
pnpm build && pnpm test -- StringBuilder
```

Output:
```
Test Suites: 1 passed, 1 total
Tests:       23 passed, 23 total
```

Full composer test suite: 294 tests pass.

Build: PASS
Tests: PASS
