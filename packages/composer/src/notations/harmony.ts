import { HarmonyBuilder } from '../builders/HarmonyBuilder'
import type { HarmonyMask } from '@symphonyscript/theory'
import type { NotePitch } from '../types'
import { resolvePitch } from '../utils/pitch'

/**
 * Create a {@link HarmonyBuilder} from a raw 24-EDO bitmask and root pitch.
 *
 * Unlike {@link chord} which parses a string symbol, `harmony()` accepts
 * a pre-computed {@link HarmonyMask} directly. Use this when working with
 * programmatic interval sets or theory-layer outputs.
 *
 * @param mask - 24-EDO packed interval bitmask. `undefined` = empty (zero mask).
 * @param root - Root pitch as string notation or MIDI number. `undefined` = C4 (60).
 * @param duration - Duration in ticks for all chord tones. `undefined` = bridge default.
 * @returns Immutable {@link HarmonyBuilder}
 *
 * @example
 * ```ts
 * import { pack } from '@symphonyscript/theory'
 *
 * const maj = pack([0, 8, 14])         // C major in 24-EDO
 * harmony(maj, 'C4')                    // C major chord
 * harmony(maj, 'G3', 960)              // G major, whole note
 * harmony(maj, 60).drop2().strum(20)   // Drop-2, strummed
 * ```
 */
export function harmony(
  mask?: HarmonyMask,
  root?: NotePitch,
  duration?: number,
): HarmonyBuilder {
  const rootPitch = root !== undefined ? resolvePitch(root) : undefined

  return new HarmonyBuilder({ mask, root: rootPitch, duration })
}
