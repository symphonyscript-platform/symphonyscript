# Fixes: Task 051

Fixed: Math.random() at SynapticChordCursor.ts:171
Build: FAIL (pre-existing errors only)

## Changes

1. `SynapticClip.ts`: Added `getSeededRng(): SeededRandom` getter
2. `SynapticChordCursor.ts`: Replaced `Math.random()` with `clip.getSeededRng().next()`

Awaiting hostile review.
