# Directive: Task 033

Implement control() for MIDI CC per `research/workflow/tasks/033-2026-02-03-implement-control-cc.md`

## Expectations

- Reuse existing `CCOperation` type from Task 025 (already exists in types.ts)
- Add `control(controller: number, value: number): this` to SynapticClip
- Controller: 0-127, Value: 0-127 (validate both)
- Queue CC operation at current tick
- Add `control()` escape method to cursors (ComposerCursor base class)
- Store CC operations in `_pendingCCOperations: CCOperation[]`
- Flush in `flushNote()` or provide separate `flushCC()` method
- CC operations should appear in `build()` output

## Files

- `packages/composer/src/clips/SynapticClip.ts` (add control method, CC queue)
- `packages/composer/src/cursors/ComposerCursor.ts` (add control escape)
- `packages/composer/src/__tests__/Control.test.ts` (create)
