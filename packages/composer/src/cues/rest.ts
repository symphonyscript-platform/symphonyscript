import { PipeStep, step } from '@symphonyscript/composer'

import { NoteDuration } from '@symphonyscript/core'

/**
 * Advance the timeline by a duration without emitting any events.
 *
 * Skips the given beat count; useful for spacing notes, creating gaps in
 * patterns, or inserting measured silence.
 *
 * @param duration - Silence length in beats (e.g. `1` = quarter note, `0.5` = eighth).
 * @returns {@link PipeStep} that advances `bridge.tick` by `duration`.
 *
 * @example
 * ```ts
 * rest(2)                      // Half note rest
 * note('C4').then(rest(1))     // C4 then quarter rest
 * ```
 */
export function rest(duration: NoteDuration): PipeStep {
  return step((bridge) => {
    const beats = typeof duration === 'string'
      ? bridge.notation().durationToBeats(duration)
      : duration
    return bridge.withTick(bridge.tick + beats)
  })
}
