# Directive: Task 042

Implement `tempoEnvelope()` per `research/workflow/tasks/042-2026-02-03-implement-tempo-envelope.md`

## Expectations

- Add types to `types.ts`:
  ```typescript
  type TempoCurve = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  
  interface TempoKeyframe {
      beat: number;
      bpm: number;
      curve?: TempoCurve;
  }
  
  interface TempoEnvelopeOp {
      kind: 'tempoEnvelope';
      keyframes: TempoKeyframe[];
      tick: number;
  }
  ```
- Implement `tempoEnvelope(keyframes: TempoKeyframe[]): this` on SynapticClip
- Validate minimum 2 keyframes
- Queue `TempoEnvelopeOp` at current tick
- Update `ClipNode.operations` union
- Add cursor escape method
- Export types from index.ts

## Files

- `packages/composer/src/types.ts` (add types, update union)
- `packages/composer/src/clips/SynapticClip.ts` (add tempoEnvelope)
- `packages/composer/src/cursors/ComposerCursor.ts` (add escape)
- `packages/composer/src/index.ts` (export)
- `packages/composer/src/__tests__/TempoEnvelope.test.ts` (create)
