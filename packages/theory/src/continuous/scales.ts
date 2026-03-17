/**
 * RFC-060: Cent-Based Scale Definitions
 *
 * Each scale is an array of cent offsets from the root, replacing
 * the bitmask HarmonyMask approach. Uses Interval constants
 * for equal-tempered values.
 *
 * Degree resolution: index into the array (1-indexed), with
 * octave wrapping for degrees beyond the scale length.
 */

import { Interval } from './intervals'
import { ScaleMode } from '@symphonyscript/notations'

// ============================================================================
// Types
// ============================================================================

/**
 * Scale as an array of cent offsets from the root.
 * All values are within one octave (0 ≤ cents < 1200), sorted ascending.
 * First entry is always 0 (unison/root).
 */
export type ScaleIntervals = readonly number[]

// ============================================================================
// Scale Definitions
// ============================================================================

const I = Interval

/**
 * Cent-interval arrays for all ScaleMode values.
 *
 * Each entry maps a ScaleMode enum to its scale degrees as cent offsets.
 * `undefined` for ScaleMode.NONE (no scale context).
 */
export const SCALE_INTERVALS: Readonly<Record<ScaleMode, ScaleIntervals | undefined>> = {
  [ScaleMode.NONE]: undefined,

  // --- Diatonic Modes (Church Modes) ---

  /** Major (Ionian): W-W-H-W-W-W-H */
  [ScaleMode.MAJOR]: [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MajorSeventh],
  /** Dorian: W-H-W-W-W-H-W */
  [ScaleMode.DORIAN]: [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MinorSeventh],
  /** Phrygian: H-W-W-W-H-W-W */
  [ScaleMode.PHRYGIAN]: [I.Unison, I.Semitone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MinorSeventh],
  /** Lydian: W-W-W-H-W-W-H */
  [ScaleMode.LYDIAN]: [I.Unison, I.WholeTone, I.MajorThird, I.Tritone, I.PerfectFifth, I.MajorSixth, I.MajorSeventh],
  /** Mixolydian: W-W-H-W-W-H-W */
  [ScaleMode.MIXOLYDIAN]: [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MinorSeventh],
  /** Natural Minor (Aeolian): W-H-W-W-H-W-W */
  [ScaleMode.MINOR]: [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MinorSeventh],
  /** Locrian: H-W-W-H-W-W-W */
  [ScaleMode.LOCRIAN]: [I.Unison, I.Semitone, I.MinorThird, I.PerfectFourth, I.Tritone, I.MinorSixth, I.MinorSeventh],

  // --- Harmonic & Melodic Minor ---

  /** Harmonic Minor: W-H-W-W-H-WH-H */
  [ScaleMode.HARMONIC_MINOR]: [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MajorSeventh],
  /** Melodic Minor (ascending): W-H-W-W-W-W-H */
  [ScaleMode.MELODIC_MINOR]: [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MajorSeventh],

  // --- Pentatonic Scales ---

  /** Major Pentatonic: 1-2-3-5-6 */
  [ScaleMode.PENTATONIC_MAJOR]: [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFifth, I.MajorSixth],
  /** Minor Pentatonic: 1-b3-4-5-b7 */
  [ScaleMode.PENTATONIC_MINOR]: [I.Unison, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh],
  /** Blues Scale: 1-b3-4-b5-5-b7 */
  [ScaleMode.BLUES]: [I.Unison, I.MinorThird, I.PerfectFourth, I.Tritone, I.PerfectFifth, I.MinorSeventh],

  // --- Symmetric Scales ---

  /** Chromatic: All 12 semitones */
  [ScaleMode.CHROMATIC]: [
    I.Unison, I.Semitone, I.WholeTone, I.MinorThird,
    I.MajorThird, I.PerfectFourth, I.Tritone, I.PerfectFifth,
    I.MinorSixth, I.MajorSixth, I.MinorSeventh, I.MajorSeventh,
  ],
  /** Whole Tone: W-W-W-W-W-W */
  [ScaleMode.WHOLE_TONE]: [I.Unison, I.WholeTone, I.MajorThird, I.Tritone, I.MinorSixth, I.MinorSeventh],
  /** Diminished Half-Whole: H-W-H-W-H-W-H-W */
  [ScaleMode.DIMINISHED_HW]: [I.Unison, I.Semitone, I.MinorThird, I.MajorThird, I.Tritone, I.PerfectFifth, I.MajorSixth, I.MinorSeventh],
  /** Diminished Whole-Half: W-H-W-H-W-H-W-H */
  [ScaleMode.DIMINISHED_WH]: [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.Tritone, I.MinorSixth, I.MajorSixth, I.MajorSeventh],

  // --- Bebop Scales ---

  /** Bebop Dominant: Major scale + b7 */
  [ScaleMode.BEBOP_DOMINANT]: [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MinorSeventh, I.MajorSeventh],
  /** Bebop Major: Major scale + #5 */
  [ScaleMode.BEBOP_MAJOR]: [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MajorSixth, I.MajorSeventh],

  // --- World Scales ---

  /** Hirajoshi (Japanese): 1-2-b3-5-b6 */
  [ScaleMode.HIRAJOSHI]: [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFifth, I.MinorSixth],
  /** In-Sen (Japanese): 1-b2-4-5-b7 */
  [ScaleMode.IN_SEN]: [I.Unison, I.Semitone, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh],
  /** Hungarian Minor: 1-2-b3-#4-5-b6-7 */
  [ScaleMode.HUNGARIAN_MINOR]: [I.Unison, I.WholeTone, I.MinorThird, I.Tritone, I.PerfectFifth, I.MinorSixth, I.MajorSeventh],
  /** Phrygian Dominant (Spanish): 1-b2-3-4-5-b6-b7 */
  [ScaleMode.PHRYGIAN_DOMINANT]: [I.Unison, I.Semitone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MinorSeventh],
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Look up the cent-interval array for a ScaleMode.
 *
 * @param mode - ScaleMode enum value
 *
 * @returns The scale's interval array, or undefined for ScaleMode.NONE
 */
export function resolveScaleIntervals(mode: ScaleMode): ScaleIntervals | undefined {
  return SCALE_INTERVALS[mode]
}

/**
 * Resolve a 1-indexed scale degree to a cent offset from the root.
 *
 * Handles octave wrapping: degree 8 in a 7-note scale returns 1200 (octave),
 * degree 9 returns 1200 + intervals[1], etc. Negative degrees wrap downward.
 *
 * @param intervals - Scale interval array (from SCALE_INTERVALS)
 * @param degree - 1-indexed scale degree (1 = root)
 *
 * @returns Cent offset from root
 *
 * @example
 * ```ts
 * const major = SCALE_INTERVALS[ScaleMode.MAJOR]!
 * degreeToCents(major, 1)  // 0     (root)
 * degreeToCents(major, 3)  // 400   (major third)
 * degreeToCents(major, 5)  // 700   (perfect fifth)
 * degreeToCents(major, 8)  // 1200  (octave)
 * degreeToCents(major, 9)  // 1400  (ninth = octave + whole tone)
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
