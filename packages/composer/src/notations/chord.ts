import { HarmonyBuilder } from '../builders/HarmonyBuilder'
import { parseChord } from '../utils/chord'
import type { HarmonyMask } from '@symphonyscript/theory'

/**
 * Create a {@link HarmonyBuilder} from a chord symbol string.
 *
 * Parses the symbol into a root pitch and 24-EDO {@link HarmonyMask} via
 * {@link parseChord}, then returns an immutable builder for chord emission.
 *
 * Called without arguments, creates an empty harmony (zero mask) that can
 * be configured later via `.mask()` and `.root()`.
 *
 * **Supported qualities:** `''`/`maj`, `m`/`min`, `dim`, `aug`, `maj7`,
 * `m7`/`min7`, `7`, `dim7`, `m7b5`, `sus2`, `sus4`.
 *
 * @param symbol - Chord symbol (e.g. `'Cmaj7'`, `'Am'`, `'F#dim'`, `'Bbsus2'`)
 * @param duration - Duration in ticks for all chord tones. `undefined` = bridge default.

 * @returns Immutable {@link HarmonyBuilder} — chain `.drop2()`, `.strum()`, `.velocity()`, etc.
 * @throws If `symbol` is empty or contains an unrecognized root note or quality
 *
 * @example
 * ```ts
 * chord('Cmaj7')                    // C major 7th, close voicing
 * chord('Am', 960)                  // A minor, whole note
 * chord('F#dim').drop2()            // F# diminished, drop-2 voicing
 * chord().mask(myMask).root(60)     // From raw mask
 * ```
 */
export function chord(symbol?: string, duration?: number): HarmonyBuilder {
  if (symbol === undefined) {
    return new HarmonyBuilder({ mask: 0 as HarmonyMask, duration })
  }

  const parsed = parseChord(symbol)

  return new HarmonyBuilder({
    mask: parsed.mask,
    root: parsed.root,
    duration,
  })
}
