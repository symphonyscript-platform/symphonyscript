/**
 * RFC-060: Temperament Definitions
 *
 * A temperament is an array of 12 cent intervals from the root,
 * defining how the 12 chromatic pitch classes map to cent offsets
 * within one octave.
 *
 * When the user writes `note('E4')`, the composer:
 * 1. Parses 'E' → pitch class index 4
 * 2. Looks up temperament[4] → e.g. 386.31 (just) or 400.0 (equal)
 * 3. Adds octave: 4 × 1200 + temperament[4] = absolute cents
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A temperament: array of 12 cent offsets from the root (C = 0).
 * Each entry is the cent offset for one chromatic pitch class.
 */
export type Temperament = readonly number[]

/** Named temperament presets. */
export type TemperamentName = 'equal' | 'just' | 'pythagorean' | 'meantone'

// ============================================================================
// Presets
// ============================================================================

/**
 * 12-tone equal temperament (12-TET).
 * Each semitone is exactly 100 cents.
 */
export const EQUAL_TEMPERAMENT: Temperament = [
  0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100,
]

/**
 * 5-limit just intonation.
 * Intervals derived from pure harmonic ratios (2, 3, 5).
 *
 *  C=1/1, C#=16/15, D=9/8, Eb=6/5, E=5/4, F=4/3,
 *  F#=45/32, G=3/2, Ab=8/5, A=5/3, Bb=9/5, B=15/8
 */
export const JUST_TEMPERAMENT: Temperament = [
  0,     // C   = 1/1
  112,   // C#  = 16/15  → 111.73
  204,   // D   = 9/8    → 203.91
  316,   // Eb  = 6/5    → 315.64
  386,   // E   = 5/4    → 386.31
  498,   // F   = 4/3    → 498.04
  590,   // F#  = 45/32  → 590.22
  702,   // G   = 3/2    → 701.96
  814,   // Ab  = 8/5    → 813.69
  884,   // A   = 5/3    → 884.36
  1018,  // Bb  = 9/5    → 1017.60
  1088,  // B   = 15/8   → 1088.27
]

/**
 * Pythagorean tuning.
 * All intervals derived from pure fifths (3/2 ratio).
 *
 *  C=1/1, Db=256/243, D=9/8, Eb=32/27, E=81/64, F=4/3,
 *  F#=729/512, G=3/2, Ab=128/81, A=27/16, Bb=16/9, B=243/128
 */
export const PYTHAGOREAN_TEMPERAMENT: Temperament = [
  0,     // C   = 1/1
  90,    // Db  = 256/243 → 90.22
  204,   // D   = 9/8     → 203.91
  294,   // Eb  = 32/27   → 294.13
  408,   // E   = 81/64   → 407.82
  498,   // F   = 4/3     → 498.04
  612,   // F#  = 729/512 → 611.73
  702,   // G   = 3/2     → 701.96
  792,   // Ab  = 128/81  → 792.18
  906,   // A   = 27/16   → 905.87
  996,   // Bb  = 16/9    → 996.09
  1110,  // B   = 243/128 → 1109.78
]

/**
 * Quarter-comma meantone temperament.
 * Tempers the fifth by 1/4 of the syntonic comma so that
 * major thirds are pure (5/4 = 386.31 cents).
 */
export const MEANTONE_TEMPERAMENT: Temperament = [
  0,     // C
  76,    // C#  → 76.05
  193,   // D   → 193.16
  310,   // Eb  → 310.26
  386,   // E   → 386.31 (pure 5/4)
  503,   // F   → 503.42
  580,   // F#  → 579.47
  697,   // G   → 696.58
  814,   // Ab  → 813.69 (Ab = -4 fifths + 3 octaves)
  890,   // A   → 889.74
  1007,  // Bb  → 1006.84
  1083,  // B   → 1082.89
]

// ============================================================================
// Resolution
// ============================================================================

/** Map of named presets for O(1) lookup. */
const TEMPERAMENT_PRESETS: Record<TemperamentName, Temperament> = {
  equal: EQUAL_TEMPERAMENT,
  just: JUST_TEMPERAMENT,
  pythagorean: PYTHAGOREAN_TEMPERAMENT,
  meantone: MEANTONE_TEMPERAMENT,
}

/** The default temperament used when none is specified. */
export const DEFAULT_TEMPERAMENT: Temperament = EQUAL_TEMPERAMENT

/**
 * Resolve a temperament from a named preset or a custom cent array.
 *
 * @param input - Preset name (`'equal'`, `'just'`, `'pythagorean'`, `'meantone'`)
 *                or a custom array of cent intervals (length ≥ 12).
 *
 * @returns The resolved temperament interval array.
 *
 * @throws If `input` is a string that doesn't match any preset.
 *
 * @example
 * ```ts
 * resolveTemperament('equal')           // → EQUAL_TEMPERAMENT
 * resolveTemperament('just')            // → JUST_TEMPERAMENT
 * resolveTemperament([0, 112, 204, …])  // → pass-through
 * ```
 */
export function resolveTemperament(input: TemperamentName | readonly number[]): Temperament {
  if (typeof input === 'string') {
    const preset = TEMPERAMENT_PRESETS[input]
    if (preset === undefined) {
      throw new Error(`Unknown temperament: '${input}'`)
    }
    return preset
  }
  if (input.length < 12) {
    throw new Error(`Temperament array must have at least 12 entries, got ${input.length}`)
  }
  return input
}
