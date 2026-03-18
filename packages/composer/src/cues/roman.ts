import { RomanBuilder } from '../builders/RomanBuilder'
import type { Degree } from '@symphonyscript/core'

/**
 * Create a {@link RomanBuilder} that emits chord tones from a roman numeral.
 *
 * Resolves the numeral via `bridge.notation().resolveProgression()` to obtain
 * root cents and chord intervals, then emits simultaneous chord tones. Supports
 * inversions via `.inversion()`. Unlike {@link chord}, uses scale-relative
 * resolution rather than absolute chord symbols.
 *
 * Called without arguments, uses default `'I'` (tonic triad).
 *
 * @param numeral - Roman numeral (e.g. `'I'`, `'iv'`, `'V7'`, `'bVII'`).
 * @param duration - Note duration in ticks for all chord tones. `undefined` = bridge default.
 *
 * @returns Immutable {@link RomanBuilder} — chain `.inversion()`, `.velocity()`, etc.
 * @throws At apply-time if numeral is not recognized by the notation
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
export function roman(numeral?: Degree, duration?: number): RomanBuilder {
  return new RomanBuilder({ numeral, duration })
}
