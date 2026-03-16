/**
 * RFC-060: Cent-Based Chord Definitions
 *
 * Each chord is an array of cent offsets from the root, replacing
 * the bitmask HarmonyMask approach. Uses Interval constants
 * for equal-tempered values.
 *
 * Extended intervals (9th, 11th, 13th) are stored within one octave
 * at their mod-1200 position (e.g. 9th = 200, 11th = 500, 13th = 900).
 * Voicing (octave placement) is the composer's responsibility.
 */

import { Interval } from './intervals'
import type { ScaleIntervals } from './scales'

// ============================================================================
// Types
// ============================================================================

/**
 * Chord as an array of cent offsets from the root.
 * Sorted ascending. First entry is always 0 (root).
 */
export type ChordIntervals = readonly number[]

// ============================================================================
// Chord Definitions
// ============================================================================

const I = Interval

/**
 * Chord definitions as cent-interval arrays.
 *
 * Mirrors the CHORD object from chords/definitions.ts but uses
 * cent values instead of bitmasks.
 */
export const CHORD_INTERVALS = {
  // --- Major Family ---

  /** Major Triad: 1-3-5 */
  MAJ: [I.Unison, I.MajorThird, I.PerfectFifth],
  /** Major Seventh: 1-3-5-7 */
  MAJ7: [I.Unison, I.MajorThird, I.PerfectFifth, I.MajorSeventh],
  /** Major Sixth: 1-3-5-6 */
  MAJ6: [I.Unison, I.MajorThird, I.PerfectFifth, I.MajorSixth],
  /** Six-Nine: 1-3-5-6-9 (9th = WholeTone in same octave) */
  SIX_NINE: [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFifth, I.MajorSixth],
  /** Major Ninth: 1-3-5-7-9 */
  MAJ9: [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFifth, I.MajorSeventh],
  /** Major Eleventh: 1-3-5-7-9-11 */
  MAJ11: [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSeventh],
  /** Major Thirteenth: 1-3-5-7-9-11-13 */
  MAJ13: [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MajorSeventh],
  /** Add Nine: 1-3-5-9 */
  ADD9: [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFifth],

  // --- Minor Family ---

  /** Minor Triad: 1-b3-5 */
  MIN: [I.Unison, I.MinorThird, I.PerfectFifth],
  /** Minor Seventh: 1-b3-5-b7 */
  MIN7: [I.Unison, I.MinorThird, I.PerfectFifth, I.MinorSeventh],
  /** Minor Sixth: 1-b3-5-6 */
  MIN6: [I.Unison, I.MinorThird, I.PerfectFifth, I.MajorSixth],
  /** Minor Ninth: 1-b3-5-b7-9 */
  MIN9: [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFifth, I.MinorSeventh],
  /** Minor Eleventh: 1-b3-5-b7-9-11 */
  MIN11: [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh],
  /** Minor Thirteenth: 1-b3-5-b7-9-11-13 */
  MIN13: [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MinorSeventh],
  /** Minor Major Seventh: 1-b3-5-7 */
  MIN_MAJ7: [I.Unison, I.MinorThird, I.PerfectFifth, I.MajorSeventh],

  // --- Dominant Family ---

  /** Dominant Seventh: 1-3-5-b7 */
  DOM7: [I.Unison, I.MajorThird, I.PerfectFifth, I.MinorSeventh],
  /** Dominant Ninth: 1-3-5-b7-9 */
  DOM9: [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFifth, I.MinorSeventh],
  /** Dominant Eleventh: 1-3-5-b7-9-11 */
  DOM11: [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh],
  /** Dominant Thirteenth: 1-3-5-b7-9-13 */
  DOM13: [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFifth, I.MajorSixth, I.MinorSeventh],
  /** Seven Sus Four: 1-4-5-b7 */
  DOM7_SUS4: [I.Unison, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh],
  /** Nine Sus Four: 1-4-5-b7-9 */
  DOM9_SUS4: [I.Unison, I.WholeTone, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh],

  // --- Suspended ---

  /** Suspended Fourth: 1-4-5 */
  SUS4: [I.Unison, I.PerfectFourth, I.PerfectFifth],
  /** Suspended Second: 1-2-5 */
  SUS2: [I.Unison, I.WholeTone, I.PerfectFifth],

  // --- Power ---

  /** Power Chord: 1-5 */
  POWER: [I.Unison, I.PerfectFifth],

  // --- Diminished Family ---

  /** Diminished Triad: 1-b3-b5 */
  DIM: [I.Unison, I.MinorThird, I.Tritone],
  /** Diminished Seventh: 1-b3-b5-bb7 (bb7 = MajorSixth enharmonic) */
  DIM7: [I.Unison, I.MinorThird, I.Tritone, I.MajorSixth],
  /** Half-Diminished (m7b5): 1-b3-b5-b7 */
  HALF_DIM: [I.Unison, I.MinorThird, I.Tritone, I.MinorSeventh],

  // --- Augmented Family ---

  /** Augmented Triad: 1-3-#5 (#5 = MinorSixth enharmonic) */
  AUG: [I.Unison, I.MajorThird, I.MinorSixth],
  /** Augmented Seventh: 1-3-#5-b7 */
  AUG7: [I.Unison, I.MajorThird, I.MinorSixth, I.MinorSeventh],
  /** Augmented Major Seventh: 1-3-#5-7 */
  AUG_MAJ7: [I.Unison, I.MajorThird, I.MinorSixth, I.MajorSeventh],

  // --- Altered Dominants ---

  /** Seven Flat Nine: 1-3-5-b7-b9 */
  DOM7_B9: [I.Unison, I.Semitone, I.MajorThird, I.PerfectFifth, I.MinorSeventh],
  /** Seven Sharp Nine: 1-3-5-b7-#9 */
  DOM7_SHARP9: [I.Unison, I.MinorThird, I.MajorThird, I.PerfectFifth, I.MinorSeventh],
  /** Seven Flat Five: 1-3-b5-b7 */
  DOM7_B5: [I.Unison, I.MajorThird, I.Tritone, I.MinorSeventh],
  /** Altered Dominant: 1-3-b5-b7-b9-#9-b13 */
  DOM7_ALT: [I.Unison, I.Semitone, I.MinorThird, I.MajorThird, I.Tritone, I.MinorSixth, I.MinorSeventh],
} as const

// ============================================================================
// Symbol Lookup Map
// ============================================================================

/**
 * Chord symbol to interval array lookup.
 * Mirrors CHORD_MAP but returns ChordIntervals instead of HarmonyMask.
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
  ['add9', CHORD_INTERVALS.ADD9],
  ['add2', CHORD_INTERVALS.ADD9],

  // Minor
  ['m', CHORD_INTERVALS.MIN],
  ['-', CHORD_INTERVALS.MIN],
  ['min', CHORD_INTERVALS.MIN],
  ['m7', CHORD_INTERVALS.MIN7],
  ['-7', CHORD_INTERVALS.MIN7],
  ['min7', CHORD_INTERVALS.MIN7],
  ['m6', CHORD_INTERVALS.MIN6],
  ['-6', CHORD_INTERVALS.MIN6],
  ['min6', CHORD_INTERVALS.MIN6],
  ['m9', CHORD_INTERVALS.MIN9],
  ['-9', CHORD_INTERVALS.MIN9],
  ['min9', CHORD_INTERVALS.MIN9],
  ['m11', CHORD_INTERVALS.MIN11],
  ['-11', CHORD_INTERVALS.MIN11],
  ['min11', CHORD_INTERVALS.MIN11],
  ['m13', CHORD_INTERVALS.MIN13],
  ['-13', CHORD_INTERVALS.MIN13],
  ['min13', CHORD_INTERVALS.MIN13],
  ['m(maj7)', CHORD_INTERVALS.MIN_MAJ7],
  ['-Δ7', CHORD_INTERVALS.MIN_MAJ7],
  ['min(maj7)', CHORD_INTERVALS.MIN_MAJ7],
  ['mM7', CHORD_INTERVALS.MIN_MAJ7],

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
