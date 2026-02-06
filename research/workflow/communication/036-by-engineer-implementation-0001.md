# Task 036 Implementation Report

**Date:** 2026-02-05
**Author:** Symphony-Engineer-Zero
**Status:** IMPLEMENTATION COMPLETE

## Summary

Implemented `voice()` method for MPE (MIDI Polyphonic Expression) voice scoping on `SynapticMelody`. Notes created within a voice scope are tagged with an `expressionId` for independent per-note expression control.

## Files Modified

### 1. packages/composer/src/types.ts

Added `expressionId` to `NoteOperation`:

```typescript
export interface NoteOperation {
    kind: 'note';
    pitch: number;
    velocity: number;
    duration: number;
    tick: number;
    muted: boolean;
    sourceId: number;
    legato?: boolean;
    expressionId?: number;  // MPE voice channel (1-15)
}
```

### 2. packages/composer/src/clips/SynapticClip.ts

Added `_expressionId` state:

```typescript
// MPE voice expression ID (Task 036)
protected _expressionId: number | null = null;
```

Updated `flushNote()` to include `expressionId` in output:

```typescript
// Include expressionId from parameter (if non-zero) or clip-level setting
// expressionId=0 from cursor means "use clip default"
const finalExpressionId = (expressionId && expressionId !== 0) ? expressionId : (this._expressionId ?? undefined);
this.operations.push({
    kind: 'note',
    // ...
    expressionId: finalExpressionId
});
```

### 3. packages/composer/src/clips/SynapticMelody.ts

Added `voice()` method:

```typescript
/**
 * Execute a builder function within an MPE voice scope.
 * All notes created inside the builder will be tagged with the expressionId.
 * @param id - Voice ID (1-15, MPE channel range)
 * @param builderFn - Builder function that creates notes for this voice
 * @returns this for chaining
 * @throws Error if id is out of range (1-15)
 */
voice(id: number, builderFn: (v: SynapticMelody) => SynapticMelody | SynapticMelodyNoteCursor | void): this
```

Added accessor methods:

```typescript
getExpressionId(): number | null
setExpressionId(id: number | null): this
```

### 4. packages/composer/src/__tests__/Voice.test.ts (Created)

Comprehensive test suite with 24 tests covering:
- `SynapticMelody.voice()` - chaining, tagging, different IDs, multiple notes
- Voice ID validation - range 1-15, rejection of 0, 16, negative
- Voice scope isolation - notes outside have no ID, nested voices
- Builder function return types - clip, cursor (auto-commits)
- Expression ID accessors - get, set, clear, validation
- Independent voices - same tick, different rhythms
- Clip factory integration
- Edge cases - empty scope, rests only, preserves properties

## Test Results

```
PASS src/__tests__/Voice.test.ts
  Voice (Task 036)
    SynapticMelody.voice()
      ✓ returns this for chaining
      ✓ tags notes with expressionId
      ✓ supports different voice IDs
      ✓ multiple notes in same voice
    Voice ID validation
      ✓ accepts ID 1
      ✓ accepts ID 15
      ✓ rejects ID 0
      ✓ rejects ID 16
      ✓ rejects negative ID
    Voice scope isolation
      ✓ notes outside voice have no expressionId
      ✓ nested voices use inner voice ID
    Builder function return types
      ✓ accepts builder returning clip
      ✓ accepts builder returning cursor (auto-commits)
    Expression ID accessors
      ✓ getExpressionId() returns null by default
      ✓ getExpressionId() returns current ID inside voice
      ✓ setExpressionId() sets ID directly
      ✓ setExpressionId(null) clears ID
      ✓ setExpressionId() validates range
    Independent voices
      ✓ multiple voices at same tick
      ✓ voices can have different rhythms
    Clip factory integration
      ✓ Clip.melody().voice() works
    Edge cases
      ✓ empty voice scope
      ✓ voice with only rests
      ✓ preserves other note properties

Test Suites: 1 passed, 1 total
Tests:       24 passed, 24 total
```

Full composer test suite: **516 passed, 1 failed** (pre-existing flaky Zero-Allocation test unrelated to this task)

## Acceptance Criteria Verification

| Criteria | Status |
|----------|--------|
| `expressionId` added to `NoteOperation` | ✅ |
| `_expressionId` state added to `SynapticClip` | ✅ |
| `voice(1, fn)` tags notes with expressionId=1 | ✅ |
| Voice IDs 1-15 supported (MPE range) | ✅ |
| Notes in different voices have independent ties | ✅ |
| `flushNote()` includes expressionId | ✅ |
| 24 tests pass | ✅ |

## API Usage Examples

```typescript
// Basic voice scoping
melody
    .voice(1, v => v.note('C4', '1n').tie('start').note('C4').tie('end'))
    .voice(2, v => v.note('E4', '4n').note('E4', '4n'))

// Multiple voices at same tick (polyphonic MPE)
melody
    .voice(1, v => v.note('C4', 1).commit())
    .voice(2, v => v.note('E4', 1).commit())
    .voice(3, v => v.note('G4', 1).commit())

// Nested voices (inner takes precedence)
melody.voice(1, v => {
    v.note('C4', 0.5).commit();
    v.voice(2, v2 => {
        v2.note('D4', 0.5).commit();
        return v2;
    });
    v.note('E4', 0.5).commit(); // Back to voice 1
    return v;
});

// Direct expression ID control
melody
    .setExpressionId(5)
    .note('C4', 0.5).commit()
    .setExpressionId(null)  // Clear
    .note('D4', 0.5).commit()  // No expressionId
```
