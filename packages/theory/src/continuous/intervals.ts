/**
 * RFC-060: Continuous Pitch Interval Constants
 *
 * Equal-tempered cent values for standard Western intervals.
 * One octave = 1200 cents. One semitone = 100 cents.
 *
 * These are equal-tempered values. Just-intonation equivalents differ
 * (e.g. just major third = 386.31, not 400).
 */
export const Interval = {
  Unison: 0,
  Semitone: 100,
  WholeTone: 200,
  MinorThird: 300,
  MajorThird: 400,
  PerfectFourth: 500,
  Tritone: 600,
  PerfectFifth: 700,
  MinorSixth: 800,
  MajorSixth: 900,
  MinorSeventh: 1000,
  MajorSeventh: 1100,
  Octave: 1200,
} as const

/**
 * Convert a frequency ratio to cents.
 *
 * Formula: 1200 × log₂(ratio)
 *
 * @param ratio - Frequency ratio (e.g. 3/2 for a perfect fifth)
 *
 * @returns Cent value (e.g. 701.96 for 3/2)
 *
 * @example
 * ```ts
 * ratioToCents(2)     // 1200   (octave)
 * ratioToCents(3/2)   // 701.96 (just fifth)
 * ratioToCents(5/4)   // 386.31 (just major third)
 * ratioToCents(1)     // 0      (unison)
 * ```
 */
export function ratioToCents(ratio: number): number {
  return 1200 * Math.log2(ratio)
}
