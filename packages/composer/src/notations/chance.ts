import { ChanceBuilder } from '../builders/ChanceBuilder'
import { SeededRandom } from '@symphonyscript/core'

/**
 * Create a {@link ChanceBuilder} for probabilistic note emission.
 *
 * Each note independently rolls against the configured probability; failed
 * rolls emit a rest (advance tick) instead. Chain `.steps()` for scoped
 * application or `.default()` to cascade downstream.
 *
 * @param probability - Chance each note is emitted (0–1). 1 = always. Default 1.
 * @param seed - Integer seed for reproducible rolls. Omitted = tick-derived seed.

 * @returns Immutable {@link ChanceBuilder} — chain `.probability()`, `.seed()`, `.steps()`, `.default()`
 *
 * @example
 * ```ts
 * chance(0.5)                              // Each note has 50% chance
 * chance(0.5, 42)                          // Reproducible with seed
 * chance(1).steps(note('C4'))              // Always emits (no randomization)
 * chance().probability(0.3).steps(note('E4'))
 * chance(0.5).default()                    // Cascade downstream
 * ```
 */
export function chance(probability?: number, seed?: number): ChanceBuilder {
  return new ChanceBuilder({
    probability,
    rng: seed !== undefined ? new SeededRandom(seed) : undefined,
  })
}
