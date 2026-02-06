# Directive: Task 036

Implement `voice()` for MPE per `research/workflow/tasks/036-2026-02-03-implement-voice-scope.md`

## Expectations

- Add `expressionId?: number` to `NoteOperation` in `types.ts`
- Add `protected _expressionId: number | null = null` to SynapticMelody
- Implement `voice(id: number, builderFn: (v: this) => this): this` on SynapticMelody:
  - Validate id range 1-15 (MPE channels)
  - Create clone with `_expressionId` set
  - Execute builderFn
  - Merge operations back to parent
  - Tag all notes from builderFn with `expressionId`
- `flushNote()` should include `expressionId` in NoteOperation when set
- Independent tie handling per voice

## Files

- `packages/composer/src/types.ts` (add expressionId to NoteOperation)
- `packages/composer/src/clips/SynapticMelody.ts` (add voice method)
- `packages/composer/src/clips/SynapticClip.ts` (add _expressionId state, update flushNote)
- `packages/composer/src/__tests__/Voice.test.ts` (create)
