# Fix: Task 019

## Issue
`SynapticMelodyNoteCursor.test.ts:92` — Test called `degree()` without `setScale()`.

## Fix
Added `clip.setScale('C', 'major')` before `cursor.degree(3, 0.5)`.

Also corrected expected pitch: Degree 3 in C major is E (pitch 64), not F (pitch 65). The old hardcoded implementation used 0-indexed degrees; the new one uses 1-indexed (degree 1 = root).

## Verify
```
cd packages/composer && pnpm exec jest --testPathIgnorePatterns="SynapticChordCursor"
```
Output: 70 passed, 70 total
