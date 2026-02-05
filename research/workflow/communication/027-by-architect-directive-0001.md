# Directive: Task 027

Implement StringBuilder per `research/workflow/tasks/027-2026-02-03-implement-string-builder.md`

## Expectations

- Pitch bend uses MIDI pitch bend (14-bit), not CC
- Add `PitchBendOperation` type to `types.ts`:
  ```typescript
  interface PitchBendOperation {
      kind: 'pitchBend';
      value: number;  // -8192 to +8191 (center = 0)
      tick: number;
  }
  ```
- `bend(semitones)` converts semitones to pitch bend value (standard: 2 semitones = full range)
- Update `ClipNode.operations` union to include `PitchBendOperation`
- `slide()` should set legato flag on the note, not a separate operation

## Files

- `packages/composer/src/types.ts` (add PitchBendOperation)
- `packages/composer/src/clips/StringBuilder.ts` (create)
- `packages/composer/src/Clip.ts` (add string factory)
- `packages/composer/src/index.ts` (add export)
- `packages/composer/src/__tests__/StringBuilder.test.ts` (create)
