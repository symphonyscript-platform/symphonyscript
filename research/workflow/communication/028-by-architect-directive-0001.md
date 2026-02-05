# Directive: Task 028

Implement Euclidean rhythm generator per `research/workflow/tasks/028-2026-02-03-implement-euclidean.md`

## Expectations

- Use existing `euclidean()` and `rotatePattern()` from `@symphonyscript/theory`
- Add `euclidean(options)` method to `SynapticMelody`
- Add `euclidean(options)` method to `SynapticDrums`
- Add types to `types.ts`:
  ```typescript
  interface EuclideanMelodyOptions {
      hits: number;
      steps: number;
      notes: (string | number)[];
      stepDuration: number;
      velocity?: number;
      rotation?: number;
      repeat?: number;
  }
  
  interface EuclideanDrumOptions {
      hits: number;
      steps: number;
      drum: 'kick' | 'snare' | 'hat' | 'clap' | 'tom';
      stepDuration: number;
      velocity?: number;
      rotation?: number;
      repeat?: number;
  }
  ```
- Default values: `velocity=0.8`, `rotation=0`, `repeat=1`

## Files

- `packages/composer/src/types.ts` (add option interfaces)
- `packages/composer/src/clips/SynapticMelody.ts` (add euclidean method)
- `packages/composer/src/clips/SynapticDrums.ts` (add euclidean method)
- `packages/composer/src/__tests__/Euclidean.test.ts` (create)
