# Directive: Task 035

Implement parameter automation per `research/workflow/tasks/035-2026-02-03-implement-automation.md`

## Expectations

- Add types to `types.ts`:
  ```typescript
  type AutomationTarget = 'volume' | 'pan' | 'filter' | 'resonance' | 'attack' | 'release';
  
  interface AutomationOperation {
      kind: 'automation';
      target: AutomationTarget;
      value: number;        // Normalized (volume: 0-1, pan: -1 to 1)
      rampBeats?: number;   // Duration to ramp (instant if undefined)
      curve?: 'linear' | 'exponential' | 'smooth';
      tick: number;
  }
  ```
- Add `automate(target, value, rampBeats?, curve?)` to SynapticClip
- Add `volume(value, rampBeats?)` shorthand (target='volume')
- Add `pan(value, rampBeats?)` shorthand (target='pan')
- Pan range: -1 (left) to +1 (right), validate
- Volume range: 0-1, validate
- Update `ClipNode.operations` union
- Add escape methods to ComposerCursor

## Files

- `packages/composer/src/types.ts` (add types, update union)
- `packages/composer/src/clips/SynapticClip.ts` (add methods)
- `packages/composer/src/cursors/ComposerCursor.ts` (add escapes)
- `packages/composer/src/index.ts` (export types)
- `packages/composer/src/__tests__/Automation.test.ts` (create)
