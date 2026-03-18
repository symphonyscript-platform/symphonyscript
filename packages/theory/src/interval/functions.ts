import type { IntervalQuality } from './types'

/**
 * Convert a frequency ratio to cents.
 * Formula: 1200 × log₂(ratio)
 *
 * @param ratio - Frequency ratio (e.g. 3/2 for a perfect fifth)
 * @returns Cent value (e.g. 701.96 for 3/2)
 */
export function ratioToCents(ratio: number): number {
  return 1200 * Math.log2(ratio)
}

/**
 * Invert an interval within one octave.
 *
 * @param semitones - Interval size in semitones (0-11)
 * @returns Complement interval in semitones
 */
export function invertInterval(semitones: number): number {
  return (12 - (((semitones % 12) + 12) % 12)) % 12
}

/**
 * Check if two cent values are enharmonically equivalent
 * (same pitch class, ignoring octave).
 *
 * @param a - First pitch in cents
 * @param b - Second pitch in cents
 * @returns True if same pitch class
 */
export function isEnharmonic(a: number, b: number): boolean {
  const classA = ((a % 1200) + 1200) % 1200
  const classB = ((b % 1200) + 1200) % 1200
  return Math.abs(classA - classB) < 0.5
}

/**
 * Classify an interval given its semitone size and generic interval number.
 *
 * @param semitones - Interval size in semitones
 * @param generic - Generic interval number (1=unison, 2=second, ..., 8=octave)
 * @returns IntervalQuality or null if unclassifiable
 */
export function getIntervalQuality(semitones: number, generic: number): IntervalQuality | null {
  // Perfect intervals: 1, 4, 5, 8
  // Major/minor intervals: 2, 3, 6, 7
  const normalized = ((semitones % 12) + 12) % 12
  const normalizedGeneric = ((generic - 1) % 7) + 1

  // Expected semitones for each generic interval (in major scale)
  const expected = [0, 0, 2, 4, 5, 7, 9, 11]
  if (normalizedGeneric < 1 || normalizedGeneric > 7) return null

  const expectedSemitones = expected[normalizedGeneric]
  const diff = normalized - expectedSemitones

  const isPerfectType = normalizedGeneric === 1 || normalizedGeneric === 4 ||
                         normalizedGeneric === 5

  if (diff === 0) return isPerfectType ? 'P' : 'M'
  if (diff === -1) return isPerfectType ? 'd' : 'm'
  if (diff === 1) return 'A'
  if (diff === -2 && !isPerfectType) return 'd'

  return null
}
