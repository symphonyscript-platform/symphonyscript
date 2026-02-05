# Directive: Task 034

Implement aftertouch per `research/workflow/tasks/034-2026-02-03-implement-aftertouch.md`

## Expectations

- Add types to `types.ts`:
  ```typescript
  interface AftertouchOperation {
      kind: 'aftertouch';
      type: 'channel' | 'poly';
      value: number;  // 0-127 (scaled from 0-1 input)
      note?: number;  // MIDI note for poly aftertouch
      tick: number;
  }
  ```
- Add `aftertouch(value, options?)` to SynapticClip
- Value input is normalized 0-1, scale to 0-127
- Default type is 'channel'
- For 'poly' type, `note` is required (parse if string)
- Update `ClipNode.operations` union to include `AftertouchOperation`
- Add escape method to ComposerCursor

## Files

- `packages/composer/src/types.ts` (add AftertouchOperation, update union)
- `packages/composer/src/clips/SynapticClip.ts` (add aftertouch method)
- `packages/composer/src/cursors/ComposerCursor.ts` (add aftertouch escape)
- `packages/composer/src/index.ts` (export AftertouchOperation)
- `packages/composer/src/__tests__/Aftertouch.test.ts` (create)
