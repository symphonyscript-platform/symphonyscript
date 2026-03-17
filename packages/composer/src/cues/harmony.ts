import { HarmonyBuilder, type ChordIntervals } from '../builders/HarmonyBuilder'
import type { NotePitch } from '../types'
import { resolvePitch } from '../utils/pitch'
import { resolveDuration, type NoteDuration } from '../utils/duration'

/**
 * Create a {@link HarmonyBuilder} from chord intervals and root pitch.
 *
 * Unlike {@link chord} which parses a string symbol, `harmony()` accepts
 * pre-computed intervals directly. Use this when working with programmatic
 * interval sets or theory-layer outputs.
 *
 * @param intervals - Chord intervals in cents from root (e.g. [0, 400, 700]).
 *                    `undefined` = empty (no intervals).
 * @param root - Root pitch as string cue or cents. `undefined` = C4 (4800).
 * @param duration - Duration in ticks for all chord tones. `undefined` = bridge default.
 *
 * @returns Immutable {@link HarmonyBuilder}
 *
 * @example
 * ```ts
 * harmony([0, 400, 700], 4800)            // C major chord
 * harmony([0, 400, 700], 5500, 960)       // G major, whole note
 * harmony([0, 400, 700], 4800).drop2().strum(20)
 * ```
 */
export function harmony(
  intervals?: ChordIntervals,
  root?: NotePitch,
  duration?: NoteDuration,
): HarmonyBuilder {
  const rootCents = root !== undefined ? resolvePitch(root) : undefined
  const resolvedDuration = resolveDuration(duration)

  return new HarmonyBuilder({
    intervals: intervals ?? [],
    root: rootCents,
    duration: resolvedDuration,
  })
}
