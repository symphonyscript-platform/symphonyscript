import { CompositionBridge, PipeStep, step } from '@symphonyscript/composer'

/**
 * Probabilistic note emission.
 * Wraps the bridge to randomly skip notes based on probability.
 */
export function chance(probability: number): PipeStep {
  return step((bridge) => {
    // probability 0..1: chance that subsequent notes will actually emit
    // This is a state modifier — the bridge needs to track it
    // For now, we approximate via muting: if random > probability, mute
    if (Math.random() > probability) {
      return bridge.withMuted(true)
    }
    return bridge.withMuted(false)
  })
}

/**
 * Reverse — reverses the tick positions of a composed sequence.
 * This is a clip-level operation, returns a PipeStep that can be
 * applied to reverse the overall tick order.
 */
export function reverse(): PipeStep {
  // Reverse requires post-processing of committed thunks.
  // For now this placeholder adjusts nothing — full implementation
  // requires the Clip class to support post-compose transforms.
  // TODO: Implement via FrozenClip → reverse tick positions → re-emit
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
