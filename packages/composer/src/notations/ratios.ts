import { RatioHarmonyBuilder } from '../builders/RatioHarmonyBuilder'
import { ratioToCents } from '@symphonyscript/theory'
import { resolveDuration, type NoteDuration } from '../utils/duration'

/**
 * Create a {@link RatioHarmonyBuilder} from frequency ratios.
 *
 * Converts frequency ratios (e.g. just intonation `[1, 5/4, 3/2]`) to cent
 * intervals via `ratioToCents()`, then emits them as simultaneous notes
 * relative to the root.
 *
 * The first ratio should be `1` (unison / root). Each ratio is converted to
 * cents and stored as an interval offset from the root.
 *
 * @param freqRatios - Frequency ratios relative to fundamental (e.g. `[1, 5/4, 3/2]`)
 * @param rootCents - Root pitch in absolute cents from C0. Default: 4800 (C4).
 * @param duration - Duration in ticks. `undefined` = bridge default.
 *
 * @returns Immutable {@link RatioHarmonyBuilder} — chain `.velocity()`, `.repeat()`, etc.
 *
 * @example
 * ```ts
 * ratios([1, 5/4, 3/2])                // Just major triad from C4
 * ratios([1, 6/5, 3/2], 5700)          // Just minor triad from A4
 * ratios([1, 5/4, 3/2, 7/4], 4800, 960) // Just dominant 7th, whole note
 * ```
 */
export function ratios(
  freqRatios: number[],
  rootCents: number = 4800,
  duration?: NoteDuration,
): RatioHarmonyBuilder {
  const resolvedDuration = resolveDuration(duration)

  // Convert ratios to cent intervals from root
  const centIntervals = freqRatios.map(r => Math.round(ratioToCents(r)))

  return new RatioHarmonyBuilder({
    intervals: centIntervals,
    root: rootCents,
    duration: resolvedDuration,
  })
}
