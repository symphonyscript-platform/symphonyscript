/**
 * RFC-060: Cent-Based Scale Definitions
 *
 * Each scale is an array of cent offsets from the root, using
 * Interval constants for equal-tempered values.
 *
 * Exported as individual named constants so notations can import
 * and map them to notation-specific scale names.
 *
 * Degree resolution: index into the array (1-indexed), with
 * octave wrapping for degrees beyond the scale length.
 */

import { Interval } from './intervals'

import type { ScaleIntervals } from '@symphonyscript/core'

// ============================================================================
// Scale Interval Constants
// ============================================================================

const I = Interval

// --- Diatonic Modes (Church Modes) ---

/** Ionian / Major: W-W-H-W-W-W-H */
export const IONIAN_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MajorSeventh]
/** Dorian: W-H-W-W-W-H-W */
export const DORIAN_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MinorSeventh]
/** Phrygian: H-W-W-W-H-W-W */
export const PHRYGIAN_INTERVALS: ScaleIntervals = [I.Unison, I.Semitone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MinorSeventh]
/** Lydian: W-W-W-H-W-W-H */
export const LYDIAN_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.Tritone, I.PerfectFifth, I.MajorSixth, I.MajorSeventh]
/** Mixolydian: W-W-H-W-W-H-W */
export const MIXOLYDIAN_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MinorSeventh]
/** Aeolian / Natural Minor: W-H-W-W-H-W-W */
export const AEOLIAN_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MinorSeventh]
/** Locrian: H-W-W-H-W-W-W */
export const LOCRIAN_INTERVALS: ScaleIntervals = [I.Unison, I.Semitone, I.MinorThird, I.PerfectFourth, I.Tritone, I.MinorSixth, I.MinorSeventh]

// --- Harmonic & Melodic Minor ---

/** Harmonic Minor: W-H-W-W-H-WH-H */
export const HARMONIC_MINOR_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MajorSeventh]
/** Melodic Minor (ascending): W-H-W-W-W-W-H */
export const MELODIC_MINOR_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MajorSeventh]

// --- Pentatonic Scales ---

/** Major Pentatonic: 1-2-3-5-6 */
export const PENTATONIC_MAJOR_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFifth, I.MajorSixth]
/** Minor Pentatonic: 1-b3-4-5-b7 */
export const PENTATONIC_MINOR_INTERVALS: ScaleIntervals = [I.Unison, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh]
/** Blues Scale: 1-b3-4-b5-5-b7 */
export const BLUES_INTERVALS: ScaleIntervals = [I.Unison, I.MinorThird, I.PerfectFourth, I.Tritone, I.PerfectFifth, I.MinorSeventh]

// --- Symmetric Scales ---

/** Chromatic: All 12 semitones */
export const CHROMATIC_INTERVALS: ScaleIntervals = [
  I.Unison, I.Semitone, I.WholeTone, I.MinorThird,
  I.MajorThird, I.PerfectFourth, I.Tritone, I.PerfectFifth,
  I.MinorSixth, I.MajorSixth, I.MinorSeventh, I.MajorSeventh,
]
/** Whole Tone: W-W-W-W-W-W */
export const WHOLE_TONE_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.Tritone, I.MinorSixth, I.MinorSeventh]
/** Diminished Half-Whole: H-W-H-W-H-W-H-W */
export const DIMINISHED_HW_INTERVALS: ScaleIntervals = [I.Unison, I.Semitone, I.MinorThird, I.MajorThird, I.Tritone, I.PerfectFifth, I.MajorSixth, I.MinorSeventh]
/** Diminished Whole-Half: W-H-W-H-W-H-W-H */
export const DIMINISHED_WH_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.Tritone, I.MinorSixth, I.MajorSixth, I.MajorSeventh]

// --- Bebop Scales ---

/** Bebop Dominant: Major scale + b7 */
export const BEBOP_DOMINANT_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MinorSeventh, I.MajorSeventh]
/** Bebop Major: Major scale + #5 */
export const BEBOP_MAJOR_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MajorSixth, I.MajorSeventh]

// --- World Scales ---

/** Hirajoshi (Japanese): 1-2-b3-5-b6 */
export const HIRAJOSHI_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFifth, I.MinorSixth]
/** In-Sen (Japanese): 1-b2-4-5-b7 */
export const IN_SEN_INTERVALS: ScaleIntervals = [I.Unison, I.Semitone, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh]
/** Hungarian Minor: 1-2-b3-#4-5-b6-7 */
export const HUNGARIAN_MINOR_INTERVALS: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.Tritone, I.PerfectFifth, I.MinorSixth, I.MajorSeventh]
/** Phrygian Dominant (Spanish): 1-b2-3-4-5-b6-b7 */
export const PHRYGIAN_DOMINANT_INTERVALS: ScaleIntervals = [I.Unison, I.Semitone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MinorSeventh]

// ============================================================================
// Functions
// ============================================================================

/**
 * Resolve a 1-indexed scale degree to a cent offset from the root.
 *
 * Handles octave wrapping: degree 8 in a 7-note scale returns 1200 (octave),
 * degree 9 returns 1200 + intervals[1], etc. Negative degrees wrap downward.
 *
 * @param intervals - Scale interval array
 * @param degree - 1-indexed scale degree (1 = root)
 *
 * @returns Cent offset from root
 *
 * @example
 * ```ts
 * degreeToCents(IONIAN_INTERVALS, 1)  // 0     (root)
 * degreeToCents(IONIAN_INTERVALS, 3)  // 400   (major third)
 * degreeToCents(IONIAN_INTERVALS, 5)  // 700   (perfect fifth)
 * degreeToCents(IONIAN_INTERVALS, 8)  // 1200  (octave)
 * degreeToCents(IONIAN_INTERVALS, 9)  // 1400  (ninth = octave + whole tone)
 * ```
 */
export function degreeToCents(intervals: ScaleIntervals, degree: number): number {
  const len = intervals.length
  const idx = degree - 1 // convert to 0-indexed

  // Compute octave offset and array index (handles negative degrees)
  const baseIdx = ((idx % len) + len) % len
  const octaves = Math.floor(idx / len)

  return octaves * Interval.Octave + intervals[baseIdx]
}
