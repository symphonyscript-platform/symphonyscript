import { HarmonyBuilder, type ChordIntervals } from '../builders/HarmonyBuilder'
import { resolveDuration, type NoteDuration } from '../utils/duration'

/**
 * Create a {@link HarmonyBuilder} from a chord symbol string.
 *
 * Resolution is deferred to `apply(bridge)` where `bridge.notation()`
 * resolves the chord symbol to cent-based intervals and root pitch.
 *
 * Called without arguments, creates an empty harmony that can
 * be configured later via `.intervals()` and `.root()`.
 *
 * **Supported qualities:** `''`/`maj`, `m`/`min`, `dim`, `aug`, `maj7`,
 * `m7`/`min7`, `7`, `dim7`, `m7b5`, `sus2`, `sus4`.
 *
 * @param symbol - Chord symbol (e.g. `'Cmaj7'`, `'Am'`, `'F#dim'`, `'Bbsus2'`)
 * @param duration - Duration in ticks for all chord tones. `undefined` = bridge default.
 *
 * @returns Immutable {@link HarmonyBuilder} — chain `.drop2()`, `.strum()`, `.velocity()`, etc.
 * @throws At apply-time if `symbol` contains an unrecognized root note or quality
 *
 * @example
 * ```ts
 * chord('Cmaj7')                        // Deferred resolution at apply-time
 * chord('Am', 960)                      // A minor, whole note
 * chord('F#dim').drop2()                // F# diminished, drop-2 voicing
 * chord().intervals([0, 400, 700])      // From raw intervals
 *   .root(4800)
 * ```
 */
export function chord(symbol?: string, duration?: NoteDuration): HarmonyBuilder {
  const resolvedDuration = resolveDuration(duration)

  if (symbol === undefined) {
    return new HarmonyBuilder({ duration: resolvedDuration })
  }

  return new HarmonyBuilder({
    symbol,
    duration: resolvedDuration,
  })
}
