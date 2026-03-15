import { ChanceBuilder } from '../builders/ChanceBuilder'
import { SeededRandom } from '@symphonyscript/core'

/**
 * Probabilistic note emission.
 * Subsequent notes have an independent probability of being emitted.
 */
export function chance(probability?: number, seed?: number): ChanceBuilder {
  return new ChanceBuilder({
    probability,
    rng: seed !== undefined ? new SeededRandom(seed) : undefined,
  })
}
