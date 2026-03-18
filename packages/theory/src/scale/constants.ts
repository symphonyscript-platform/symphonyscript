/**
 * Scale interval arrays in cents.
 * Each scale is an array of cent offsets from the root.
 */

import * as I from '../interval/constants'

import type { ScaleIntervals } from '@symphonyscript/core'

// --- Diatonic Modes (Church Modes) ---

/** Ionian / Major: W-W-H-W-W-W-H */
export const Ionian: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MajorSeventh]
/** Dorian: W-H-W-W-W-H-W */
export const Dorian: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MinorSeventh]
/** Phrygian: H-W-W-W-H-W-W */
export const Phrygian: ScaleIntervals = [I.Unison, I.Semitone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MinorSeventh]
/** Lydian: W-W-W-H-W-W-H */
export const Lydian: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.Tritone, I.PerfectFifth, I.MajorSixth, I.MajorSeventh]
/** Mixolydian: W-W-H-W-W-H-W */
export const Mixolydian: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MinorSeventh]
/** Aeolian / Natural Minor: W-H-W-W-H-W-W */
export const Aeolian: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MinorSeventh]
/** Locrian: H-W-W-H-W-W-W */
export const Locrian: ScaleIntervals = [I.Unison, I.Semitone, I.MinorThird, I.PerfectFourth, I.Tritone, I.MinorSixth, I.MinorSeventh]

// --- Harmonic & Melodic Minor ---

/** Harmonic Minor: W-H-W-W-H-WH-H */
export const HarmonicMinor: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MajorSeventh]
/** Melodic Minor (ascending): W-H-W-W-W-W-H */
export const MelodicMinor: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MajorSeventh]

// --- Pentatonic ---

/** Major Pentatonic: 1-2-3-5-6 */
export const PentatonicMajor: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFifth, I.MajorSixth]
/** Minor Pentatonic: 1-b3-4-5-b7 */
export const PentatonicMinor: ScaleIntervals = [I.Unison, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh]
/** Blues: 1-b3-4-b5-5-b7 */
export const Blues: ScaleIntervals = [I.Unison, I.MinorThird, I.PerfectFourth, I.Tritone, I.PerfectFifth, I.MinorSeventh]

// --- Symmetric ---

/** Chromatic: all 12 semitones */
export const Chromatic: ScaleIntervals = [
  I.Unison, I.Semitone, I.WholeTone, I.MinorThird,
  I.MajorThird, I.PerfectFourth, I.Tritone, I.PerfectFifth,
  I.MinorSixth, I.MajorSixth, I.MinorSeventh, I.MajorSeventh,
]
/** Whole Tone: W-W-W-W-W-W */
export const WholeTone: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.Tritone, I.MinorSixth, I.MinorSeventh]
/** Diminished Half-Whole: H-W-H-W-H-W-H-W */
export const DiminishedHW: ScaleIntervals = [I.Unison, I.Semitone, I.MinorThird, I.MajorThird, I.Tritone, I.PerfectFifth, I.MajorSixth, I.MinorSeventh]
/** Diminished Whole-Half: W-H-W-H-W-H-W-H */
export const DiminishedWH: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.Tritone, I.MinorSixth, I.MajorSixth, I.MajorSeventh]

// --- Bebop ---

/** Bebop Dominant: Major scale + b7 */
export const BebopDominant: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MinorSeventh, I.MajorSeventh]
/** Bebop Major: Major scale + #5 */
export const BebopMajor: ScaleIntervals = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MajorSixth, I.MajorSeventh]

// --- World ---

/** Hirajoshi (Japanese): 1-2-b3-5-b6 */
export const Hirajoshi: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFifth, I.MinorSixth]
/** In-Sen (Japanese): 1-b2-4-5-b7 */
export const InSen: ScaleIntervals = [I.Unison, I.Semitone, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh]
/** Hungarian Minor: 1-2-b3-#4-5-b6-7 */
export const HungarianMinor: ScaleIntervals = [I.Unison, I.WholeTone, I.MinorThird, I.Tritone, I.PerfectFifth, I.MinorSixth, I.MajorSeventh]
/** Phrygian Dominant (Spanish): 1-b2-3-4-5-b6-b7 */
export const PhrygianDominant: ScaleIntervals = [I.Unison, I.Semitone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSixth, I.MinorSeventh]

// --- Aliases ---

export const Major: ScaleIntervals = Ionian
export const Minor: ScaleIntervals = Aeolian
