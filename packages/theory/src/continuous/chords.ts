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
 *
 * NOTE: Symbol lookup (CHORD_INTERVALS_MAP), resolveChordIntervals(),
 * and romanToChordIntervals() have been extracted to @symphonyscript/notations.
 */

import { Interval } from './intervals'

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
