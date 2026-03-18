/**
 * Chord interval arrays in cents.
 * Each chord is an array of cent offsets from the root, sorted ascending.
 */

import * as I from '../interval/constants'

// --- Major Family ---

/** Major Triad: 1-3-5 */
export const Maj: readonly number[] = [I.Unison, I.MajorThird, I.PerfectFifth]
/** Major Seventh: 1-3-5-7 */
export const Maj7: readonly number[] = [I.Unison, I.MajorThird, I.PerfectFifth, I.MajorSeventh]
/** Major Sixth: 1-3-5-6 */
export const Maj6: readonly number[] = [I.Unison, I.MajorThird, I.PerfectFifth, I.MajorSixth]
/** Six-Nine: 1-3-5-6-9 */
export const SixNine: readonly number[] = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFifth, I.MajorSixth]
/** Major Ninth: 1-3-5-7-9 */
export const Maj9: readonly number[] = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFifth, I.MajorSeventh]
/** Major Eleventh: 1-3-5-7-9-11 */
export const Maj11: readonly number[] = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSeventh]
/** Major Thirteenth: 1-3-5-7-9-11-13 */
export const Maj13: readonly number[] = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MajorSeventh]
/** Add Nine: 1-3-5-9 */
export const Add9: readonly number[] = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFifth]

// --- Minor Family ---

/** Minor Triad: 1-b3-5 */
export const Min: readonly number[] = [I.Unison, I.MinorThird, I.PerfectFifth]
/** Minor Seventh: 1-b3-5-b7 */
export const Min7: readonly number[] = [I.Unison, I.MinorThird, I.PerfectFifth, I.MinorSeventh]
/** Minor Sixth: 1-b3-5-6 */
export const Min6: readonly number[] = [I.Unison, I.MinorThird, I.PerfectFifth, I.MajorSixth]
/** Minor Ninth: 1-b3-5-b7-9 */
export const Min9: readonly number[] = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFifth, I.MinorSeventh]
/** Minor Eleventh: 1-b3-5-b7-9-11 */
export const Min11: readonly number[] = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh]
/** Minor Thirteenth: 1-b3-5-b7-9-11-13 */
export const Min13: readonly number[] = [I.Unison, I.WholeTone, I.MinorThird, I.PerfectFourth, I.PerfectFifth, I.MajorSixth, I.MinorSeventh]
/** Minor Major Seventh: 1-b3-5-7 */
export const MinMaj7: readonly number[] = [I.Unison, I.MinorThird, I.PerfectFifth, I.MajorSeventh]

// --- Dominant Family ---

/** Dominant Seventh: 1-3-5-b7 */
export const Dom7: readonly number[] = [I.Unison, I.MajorThird, I.PerfectFifth, I.MinorSeventh]
/** Dominant Ninth: 1-3-5-b7-9 */
export const Dom9: readonly number[] = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFifth, I.MinorSeventh]
/** Dominant Eleventh: 1-3-5-b7-9-11 */
export const Dom11: readonly number[] = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh]
/** Dominant Thirteenth: 1-3-5-b7-9-13 */
export const Dom13: readonly number[] = [I.Unison, I.WholeTone, I.MajorThird, I.PerfectFifth, I.MajorSixth, I.MinorSeventh]
/** Seven Sus Four: 1-4-5-b7 */
export const Dom7Sus4: readonly number[] = [I.Unison, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh]
/** Nine Sus Four: 1-4-5-b7-9 */
export const Dom9Sus4: readonly number[] = [I.Unison, I.WholeTone, I.PerfectFourth, I.PerfectFifth, I.MinorSeventh]

// --- Suspended ---

/** Suspended Fourth: 1-4-5 */
export const Sus4: readonly number[] = [I.Unison, I.PerfectFourth, I.PerfectFifth]
/** Suspended Second: 1-2-5 */
export const Sus2: readonly number[] = [I.Unison, I.WholeTone, I.PerfectFifth]

// --- Power ---

/** Power Chord: 1-5 */
export const Power: readonly number[] = [I.Unison, I.PerfectFifth]

// --- Diminished Family ---

/** Diminished Triad: 1-b3-b5 */
export const Dim: readonly number[] = [I.Unison, I.MinorThird, I.Tritone]
/** Diminished Seventh: 1-b3-b5-bb7 */
export const Dim7: readonly number[] = [I.Unison, I.MinorThird, I.Tritone, I.MajorSixth]
/** Half-Diminished (m7b5): 1-b3-b5-b7 */
export const HalfDim: readonly number[] = [I.Unison, I.MinorThird, I.Tritone, I.MinorSeventh]

// --- Augmented Family ---

/** Augmented Triad: 1-3-#5 */
export const Aug: readonly number[] = [I.Unison, I.MajorThird, I.MinorSixth]
/** Augmented Seventh: 1-3-#5-b7 */
export const Aug7: readonly number[] = [I.Unison, I.MajorThird, I.MinorSixth, I.MinorSeventh]
/** Augmented Major Seventh: 1-3-#5-7 */
export const AugMaj7: readonly number[] = [I.Unison, I.MajorThird, I.MinorSixth, I.MajorSeventh]

// --- Altered Dominants ---

/** Seven Flat Nine: 1-3-5-b7-b9 */
export const Dom7b9: readonly number[] = [I.Unison, I.Semitone, I.MajorThird, I.PerfectFifth, I.MinorSeventh]
/** Seven Sharp Nine: 1-3-5-b7-#9 */
export const Dom7Sharp9: readonly number[] = [I.Unison, I.MinorThird, I.MajorThird, I.PerfectFifth, I.MinorSeventh]
/** Seven Flat Five: 1-3-b5-b7 */
export const Dom7b5: readonly number[] = [I.Unison, I.MajorThird, I.Tritone, I.MinorSeventh]
/** Altered Dominant: 1-3-b5-b7-b9-#9-b13 */
export const Dom7Alt: readonly number[] = [I.Unison, I.Semitone, I.MinorThird, I.MajorThird, I.Tritone, I.MinorSixth, I.MinorSeventh]
