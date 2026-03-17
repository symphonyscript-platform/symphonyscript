import type { RomanNumeral } from '@symphonyscript/notations'
import { ProgressionBuilder } from '../builders/ProgressionBuilder'

/**
 * Create a {@link ProgressionBuilder} that emits a chord progression from roman numerals.
 *
 * Sequences chords by applying a {@link RomanBuilder} for each numeral. Chords emit
 * sequentially; each advances the bridge tick. Use {@link voiceLead} for progressions
 * that minimize voice movement between chords.
 *
 * @param numerals - Ordered roman numerals (e.g. `['I', 'IV', 'V', 'I']`). Must all exist in {@link ROMAN_DEGREE_MAP}.
 * @param duration - Per-chord duration in ticks. `undefined` = bridge default.

 * @returns Immutable {@link ProgressionBuilder} — chain `.velocity()` if needed
 *
 * @example
 * ```ts
 * progression(['I', 'IV', 'V', 'I'])             // I–IV–V–I (e.g. C–F–G–C)
 * progression(['I', 'vi', 'IV', 'V']).duration(480)
 * progression(['ii', 'V7', 'I']).velocity(900)    // ii–V7–I jazz cadence
 * progression(['I']).apply(bridge)                // Single chord
 * ```
 */
export function progression(numerals: RomanNumeral[], duration?: number): ProgressionBuilder {
  return new ProgressionBuilder({ numerals, duration })
}
