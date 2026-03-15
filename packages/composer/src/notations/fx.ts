import { PipeStep, step } from '@symphonyscript/composer'
import { ChanceBridge } from '../composition/ChanceBridge'

/**
 * Probabilistic note emission.
 * Subsequent notes have an independent probability of being emitted.
 * Uses a seeded PRNG for reproducibility.
 *
 * @param probability - 0..1 chance each note is emitted (1 = always, 0 = never)
 * @param seed - Optional seed for reproducibility (defaults to Date.now())
 */
export function chance(probability: number, seed: number = Date.now()): PipeStep {
  return step((bridge) => new ChanceBridge(bridge, probability, seed))
}

/**
 * Reverse — reverses the tick positions of a composed sequence.
 * Requires post-processing of committed thunks via FrozenClip.
 * TODO: Implement via FrozenClip → reverse tick positions → re-emit
 */
export function reverse(): PipeStep {
  return step((bridge) => bridge)
}

/**
 * Time-stretch — multiply all durations by a factor.
 * Adjusts the default duration to scale subsequent notes.
 */
export function stretch(factor: number): PipeStep {
  return step((bridge) => {
    const newDuration = Math.round(bridge.defaultDuration * factor)
    return bridge.withDefaultDuration(newDuration)
  })
}
