import { PipeStep, step } from '@symphonyscript/composer'
import { ChanceBuilder } from '../builders/ChanceBuilder'

/**
 * Probabilistic note emission.
 * Subsequent notes have an independent probability of being emitted.
 */
export function chance(probability: number, seed?: number): ChanceBuilder {
  return new ChanceBuilder({ probability, seed })
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
