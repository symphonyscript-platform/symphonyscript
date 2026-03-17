/**
 * RFC-060: Chord & Roman Numeral Resolution (Cent-Based)
 *
 * Chord symbol lookup and roman numeral resolution using
 * cent-interval arrays from @symphonyscript/theory.
 *
 * Extracted from theory/src/continuous/chords.ts.
 */

import { CHORD_INTERVALS, Interval } from '@symphonyscript/theory'
import type { ChordIntervals, ScaleIntervals } from '@symphonyscript/theory'

// ============================================================================
// Symbol Lookup Map
// ============================================================================

/**
 * Chord symbol to interval array lookup.
 * Maps standard chord symbols to their ChordIntervals arrays.
 */
export const CHORD_INTERVALS_MAP: ReadonlyMap<string, ChordIntervals> = new Map<string, ChordIntervals>([
  // Major
  ['', CHORD_INTERVALS.MAJ],
  ['maj', CHORD_INTERVALS.MAJ],
  ['M', CHORD_INTERVALS.MAJ],
  ['maj7', CHORD_INTERVALS.MAJ7],
  ['M7', CHORD_INTERVALS.MAJ7],
  ['Δ', CHORD_INTERVALS.MAJ7],
  ['Δ7', CHORD_INTERVALS.MAJ7],
  ['6', CHORD_INTERVALS.MAJ6],
  ['M6', CHORD_INTERVALS.MAJ6],
  ['6/9', CHORD_INTERVALS.SIX_NINE],
  ['69', CHORD_INTERVALS.SIX_NINE],
  ['6add9', CHORD_INTERVALS.SIX_NINE],
  ['maj9', CHORD_INTERVALS.MAJ9],
  ['M9', CHORD_INTERVALS.MAJ9],
  ['Δ9', CHORD_INTERVALS.MAJ9],
  ['maj11', CHORD_INTERVALS.MAJ11],
  ['M11', CHORD_INTERVALS.MAJ11],
  ['Δ11', CHORD_INTERVALS.MAJ11],
  ['maj13', CHORD_INTERVALS.MAJ13],
  ['M13', CHORD_INTERVALS.MAJ13],
  ['Δ13', CHORD_INTERVALS.MAJ13],

  // Minor
  ['m', CHORD_INTERVALS.MIN],
  ['min', CHORD_INTERVALS.MIN],
  ['-', CHORD_INTERVALS.MIN],
  ['m7', CHORD_INTERVALS.MIN7],
  ['min7', CHORD_INTERVALS.MIN7],
  ['-7', CHORD_INTERVALS.MIN7],
  ['m6', CHORD_INTERVALS.MIN6],
  ['min6', CHORD_INTERVALS.MIN6],
  ['mM7', CHORD_INTERVALS.MIN_MAJ7],
  ['m(M7)', CHORD_INTERVALS.MIN_MAJ7],
  ['minMaj7', CHORD_INTERVALS.MIN_MAJ7],
  ['m9', CHORD_INTERVALS.MIN9],
  ['min9', CHORD_INTERVALS.MIN9],
  ['m11', CHORD_INTERVALS.MIN11],
  ['min11', CHORD_INTERVALS.MIN11],
  ['m13', CHORD_INTERVALS.MIN13],
  ['min13', CHORD_INTERVALS.MIN13],

  // Dominant
  ['7', CHORD_INTERVALS.DOM7],
  ['dom7', CHORD_INTERVALS.DOM7],
  ['9', CHORD_INTERVALS.DOM9],
  ['dom9', CHORD_INTERVALS.DOM9],
  ['11', CHORD_INTERVALS.DOM11],
  ['dom11', CHORD_INTERVALS.DOM11],
  ['13', CHORD_INTERVALS.DOM13],
  ['dom13', CHORD_INTERVALS.DOM13],
  ['7sus4', CHORD_INTERVALS.DOM7_SUS4],
  ['7sus', CHORD_INTERVALS.DOM7_SUS4],
  ['9sus4', CHORD_INTERVALS.DOM9_SUS4],
  ['9sus', CHORD_INTERVALS.DOM9_SUS4],

  // Suspended
  ['sus4', CHORD_INTERVALS.SUS4],
  ['sus', CHORD_INTERVALS.SUS4],
  ['sus2', CHORD_INTERVALS.SUS2],
  ['2', CHORD_INTERVALS.SUS2],

  // Power
  ['5', CHORD_INTERVALS.POWER],
  ['(no3)', CHORD_INTERVALS.POWER],

  // Diminished
  ['dim', CHORD_INTERVALS.DIM],
  ['°', CHORD_INTERVALS.DIM],
  ['dim7', CHORD_INTERVALS.DIM7],
  ['°7', CHORD_INTERVALS.DIM7],
  ['m7b5', CHORD_INTERVALS.HALF_DIM],
  ['ø', CHORD_INTERVALS.HALF_DIM],
  ['ø7', CHORD_INTERVALS.HALF_DIM],

  // Augmented
  ['aug', CHORD_INTERVALS.AUG],
  ['+', CHORD_INTERVALS.AUG],
  ['aug7', CHORD_INTERVALS.AUG7],
  ['+7', CHORD_INTERVALS.AUG7],
  ['7#5', CHORD_INTERVALS.AUG7],
  ['maj7#5', CHORD_INTERVALS.AUG_MAJ7],
  ['Δ+', CHORD_INTERVALS.AUG_MAJ7],
  ['Δ#5', CHORD_INTERVALS.AUG_MAJ7],

  // Altered
  ['7b9', CHORD_INTERVALS.DOM7_B9],
  ['7-9', CHORD_INTERVALS.DOM7_B9],
  ['7#9', CHORD_INTERVALS.DOM7_SHARP9],
  ['7+9', CHORD_INTERVALS.DOM7_SHARP9],
  ['7b5', CHORD_INTERVALS.DOM7_B5],
  ['7-5', CHORD_INTERVALS.DOM7_B5],
  ['7alt', CHORD_INTERVALS.DOM7_ALT],
])

// ============================================================================
// Functions
// ============================================================================

/**
 * Look up chord intervals by symbol.
 *
 * @param symbol - Chord symbol (e.g., 'm7', 'maj7', '7', 'dim')
 *
 * @returns ChordIntervals array, or undefined if not found
 */
export function resolveChordIntervals(symbol: string): ChordIntervals | undefined {
  return CHORD_INTERVALS_MAP.get(symbol)
}

// ============================================================================
// Roman Numeral Resolution (self-contained, zero legacy deps)
// ============================================================================

/**
 * Roman numeral to degree mapping.
 */
const ROMAN_TO_DEGREE: Readonly<Record<string, number>> = {
  'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7,
}

/** Valid roman numeral stems. */
const VALID_ROMANS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii']

/** Regex: optional accidental, roman part, remaining suffix. */
const ROMAN_REGEX = /^(b|#)?([IViv]+)(.*)$/

/**
 * Result of romanToChordIntervals resolution.
 */
export interface RomanChordResult {
  /** Cent offset of chord root from the scale root. */
  readonly rootCents: number
  /** Chord intervals (cent offsets from chord root). */
  readonly intervals: ChordIntervals
}

/**
 * Resolve a roman numeral to a chord root and interval array.
 *
 * Self-contained parser — no legacy dependencies. Validates the
 * suffix directly against CHORD_INTERVALS_MAP, so every chord
 * symbol in the map is accepted (no hardcoded whitelist).
 *
 * @param numeral - Roman numeral string (e.g. 'V7', 'ii', 'bVII', 'V7b9')
 * @param scaleIntervals - Scale interval array (from SCALE_INTERVALS)
 *
 * @returns { rootCents, intervals } or null if the numeral is invalid
 *
 * @example
 * ```ts
 * const major = SCALE_INTERVALS[ScaleMode.MAJOR]!
 * romanToChordIntervals('I', major)      // { rootCents: 0, intervals: [0,400,700] }
 * romanToChordIntervals('V7', major)     // { rootCents: 700, intervals: [0,400,700,1000] }
 * romanToChordIntervals('ii', major)     // { rootCents: 200, intervals: [0,300,700] }
 * romanToChordIntervals('bVII', major)   // { rootCents: 1000, intervals: [0,400,700] }
 * romanToChordIntervals('V7b9', major)   // { rootCents: 700, intervals: [0,100,400,700,1000] }
 * ```
 */
export function romanToChordIntervals(
  numeral: string,
  scaleIntervals: ScaleIntervals,
): RomanChordResult | null {
  if (!numeral || typeof numeral !== 'string') return null

  const match = numeral.match(ROMAN_REGEX)
  if (!match) return null

  const accidentalStr = match[1]
  const romanPart = match[2]
  const rawSuffix = match[3]

  // --- Parse degree ---
  const romanLower = romanPart.toLowerCase()
  if (!VALID_ROMANS.includes(romanLower)) return null
  const degree = ROMAN_TO_DEGREE[romanLower]

  // --- Determine case (uppercase = major, lowercase = minor) ---
  const isLowercase = romanPart === romanPart.toLowerCase()

  // --- Build effective quality ---
  // Lowercase numerals imply minor when no explicit minor suffix is present.
  let quality = rawSuffix
  if (isLowercase) {
    if (!quality.startsWith('m') && !quality.startsWith('dim')) {
      if (quality === '') {
        quality = 'm'
      } else if (/^\d/.test(quality)) {
        quality = 'm' + quality // ii7 → m7, ii9 → m9
      }
    }
  }

  // --- Validate suffix against our chord vocabulary ---
  if (!CHORD_INTERVALS_MAP.has(quality)) return null

  // --- Determine chord root (cent offset from scale root) ---
  const degreeIdx = ((degree - 1) % scaleIntervals.length + scaleIntervals.length) % scaleIntervals.length
  let rootCents = scaleIntervals[degreeIdx]

  // Apply accidental: b = -100, # = +100
  if (accidentalStr === 'b') rootCents -= Interval.Semitone
  else if (accidentalStr === '#') rootCents += Interval.Semitone

  // --- Look up chord intervals ---
  const intervals = CHORD_INTERVALS_MAP.get(quality)!

  return { rootCents, intervals }
}
