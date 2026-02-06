# Directive: Task 041

Implement `degreeChord()` per `research/workflow/tasks/041-2026-02-03-implement-degree-chord.md`

## Expectations

- Implement `degreeChord(degrees: number[], duration?: number): SynapticChordCursor` on SynapticMelody
- Requires `_scaleContext` to be set (throw if not)
- Convert each degree to pitch using scale context
- Delegate to `chord(pitches, duration)` internally
- Returns SynapticChordCursor for chaining

## Files

- `packages/composer/src/clips/SynapticMelody.ts` (add degreeChord)
- `packages/composer/src/__tests__/DegreeChord.test.ts` (create)
