# Directive: Task 029

Implement Arpeggio per `research/workflow/tasks/029-2026-02-03-implement-arpeggio.md`

## Expectations

- Add types to `types.ts`:
  ```typescript
  type ArpPattern = 'up' | 'down' | 'upDown' | 'downUp' | 'random' | 'converge' | 'diverge';
  
  interface ArpeggioOptions {
      pattern?: ArpPattern;  // default: 'up'
      velocity?: number;     // default: 0.8
      gate?: number;         // 0-1, controls note duration relative to step (default: 0.8)
      octaves?: number;      // expand across octaves (default: 1)
      seed?: number;         // for reproducible random pattern
  }
  ```
- `gate` multiplies duration: actual duration = rate * gate
- Multi-octave: for octaves=2, expand pitches to include +12 semitones
- Pattern ordering:
  - `converge`: outer → inner (first, last, second, second-last, ...)
  - `diverge`: inner → outer (middle outward)
- For `random` with seed: use deterministic pseudo-random (can use `@symphonyscript/core` seededRandom if exists, or simple LCG)

## Files

- `packages/composer/src/types.ts` (add ArpPattern, ArpeggioOptions)
- `packages/composer/src/clips/SynapticMelody.ts` (add arpeggio method)
- `packages/composer/src/index.ts` (export types)
- `packages/composer/src/__tests__/Arpeggio.test.ts` (create)
