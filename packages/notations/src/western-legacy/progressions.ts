/**
 * RFC-060: Chord Progressions (Cent-Based)
 *
 * Progression presets, batch resolution, and tritone substitution.
 * All resolution uses romanToChordIntervals() and cent-based intervals.
 * Zero bitmasks, zero 24-EDO dependencies.
 */

import type { ScaleIntervals } from '@symphonyscript/theory'
import { romanToChordIntervals, type RomanChordResult } from './chords'

// ============================================================================
// Progression Presets
// ============================================================================

/**
 * Common chord progression presets.
 * Each value is a frozen array of roman numeral strings.
 */
export const PROGRESSION = {
  /** Pop: I - V - vi - IV */
  POP: Object.freeze(['I', 'V', 'vi', 'IV']),

  /** 12-Bar Blues */
  BLUES_12: Object.freeze([
    'I', 'I', 'I', 'I',
    'IV', 'IV', 'I', 'I',
    'V', 'IV', 'I', 'V',
  ]),

  /** Jazz ii-V-I */
  JAZZ_II_V_I: Object.freeze(['ii7', 'V7', 'Imaj7']),

  /** Jazz Turnaround */
  JAZZ_TURNAROUND: Object.freeze(['Imaj7', 'vi7', 'ii7', 'V7']),

  /** Andalusian Cadence */
  ANDALUSIAN: Object.freeze(['i', 'VII', 'VI', 'V']),

  /** 50s Progression */
  FIFTIES: Object.freeze(['I', 'vi', 'IV', 'V']),

  /** Pachelbel Canon */
  PACHELBEL: Object.freeze(['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V']),

  /** Axis of Awesome (same as POP but different order) */
  AXIS: Object.freeze(['I', 'V', 'vi', 'IV']),

  /** Royal Road (Japanese pop) */
  ROYAL_ROAD: Object.freeze(['IV', 'V', 'iii', 'vi']),

  /** Sensitive Female Chord Progression */
  SENSITIVE: Object.freeze(['vi', 'IV', 'I', 'V']),
} as const

// ============================================================================
// Batch Resolution
// ============================================================================

/**
 * Resolve an array of roman numerals to chord results in a scale.
 *
 * @param numerals - Array of roman numeral strings
 * @param scaleIntervals - Scale intervals in cents (from SCALE_INTERVALS)
 * @returns Array of RomanChordResult (null entries for invalid numerals)
 *
 * @example
 * ```ts
 * const major = SCALE_INTERVALS[ScaleMode.MAJOR]!
 * resolveProgression(PROGRESSION.POP, major)
 * // → [{ rootCents: 0, intervals: [...] }, { rootCents: 700, ... }, ...]
 * ```
 */
export function resolveProgression(
  numerals: readonly string[],
  scaleIntervals: ScaleIntervals,
): (RomanChordResult | null)[] {
  return numerals.map(n => romanToChordIntervals(n, scaleIntervals))
}

// ============================================================================
// Tritone Substitution (cent-based)
// ============================================================================

/** Tritone interval in cents. */
const TRITONE_CENTS = 600

/**
 * Apply tritone substitution to a resolved chord.
 * Shifts the root by +600 cents (tritone), wrapping at 1200.
 *
 * @param result - Resolved chord result
 * @returns New RomanChordResult with tritone-substituted root
 */
export function tritoneSubstitute(result: RomanChordResult): RomanChordResult {
  return {
    rootCents: (result.rootCents + TRITONE_CENTS) % 1200,
    intervals: result.intervals,
  }
}

/**
 * Apply tritone substitutions to an array of resolved chords.
 * Only dominant 7th chords are substituted (intervals matching DOM7).
 *
 * @param results - Array of resolved chords
 * @returns New array with dominant 7th chords tritone-substituted
 */
export function applyTritoneSubstitutions(
  results: RomanChordResult[],
): RomanChordResult[] {
  // DOM7 intervals: [0, 400, 700, 1000]
  const DOM7_SIGNATURE = [0, 400, 700, 1000]

  return results.map(result => {
    const isDom7 =
      result.intervals.length === DOM7_SIGNATURE.length &&
      result.intervals.every((v, i) => v === DOM7_SIGNATURE[i])

    return isDom7 ? tritoneSubstitute(result) : result
  })
}
