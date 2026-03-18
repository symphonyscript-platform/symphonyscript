import { PipeStep, step } from '@symphonyscript/composer'
import type { NoteDuration } from '../utils/duration'

/**
 * Advance the timeline by a duration without emitting any events.
 *
 * Skips the given tick count; useful for spacing notes, creating gaps in
 * patterns, or aligning subsequent events to a later tick.
 *
 * @param duration - Silence length in ticks.

 * @returns {@link PipeStep} that advances `bridge.tick` by `duration`.
 *
 * @example
 * ```ts
 * rest(480)                    // Half note rest
 * note('C4').then(rest(240))   // C4 then quarter rest
 * ```
 */
export function rest(duration: NoteDuration): PipeStep {
  return step((bridge) => {
    const ticks = typeof duration === 'string'
      ? bridge.notation().durationToTicks(duration, bridge.ppq)
      : duration
    return bridge.withTick(bridge.tick + ticks)
  })
}
