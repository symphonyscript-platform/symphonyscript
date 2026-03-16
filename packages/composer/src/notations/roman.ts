import { RomanBuilder } from '../builders/RomanBuilder'
import type { RomanNumeral } from '@symphonyscript/theory'

/**
 * Create a {@link RomanBuilder} that emits chord tones from a roman numeral.
 *
 * Maps numerals (I, iv, V7, etc.) to diatonic scale degrees via
 * {@link ROMAN_DEGREE_MAP}, resolves degrees to MIDI pitches using the bridge's
 * scale context (scaleRoot, scaleMode), and emits simultaneous notes. Supports
 * inversions via `.inversion()`. Unlike {@link chord}, uses scale-relative
 * resolution rather than absolute chord symbols.
 *
 * Called without arguments, uses default `'I'` (tonic triad).
 *
 * @param numeral - Roman numeral (e.g. `'I'`, `'iv'`, `'V7'`, `'bVII'`). Must exist in {@link ROMAN_DEGREE_MAP}.
 * @param duration - Note duration in ticks for all chord tones. `undefined` = bridge default.
 * @returns Immutable {@link RomanBuilder} — chain `.inversion()`, `.velocity()`, etc.
 * @throws When numeral is not in ROMAN_DEGREE_MAP (during `apply()`)
 *
 * @example
 * ```ts
 * roman('I')                          // Tonic triad (C, E, G in C major)
 * roman('V7').duration(480)            // Dominant 7th, half-note
 * roman('vi').velocity(900)           // Submediant minor, louder
 * roman('ii').inversion(1)            // First inversion (third in bass)
 * roman()                             // Default I
 * ```
 */
export function roman(numeral?: RomanNumeral, duration?: number): RomanBuilder {
  return new RomanBuilder({ numeral, duration })
}
