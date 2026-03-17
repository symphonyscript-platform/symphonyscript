/**
 * Western notation lookup data.
 *
 * All maps, tables, and constants needed by WesternNotation.
 * No regex. No imports from western-legacy/.
 *
 * All data (chord intervals, scale intervals, ScaleMode values) is inlined
 * to avoid circular dependency with @symphonyscript/theory.
 */

import type { ChordIntervals } from '@symphonyscript/core'

// ScaleMode enum values, inlined to avoid western-legacy import.
// Values match western-legacy/scale-mode.ts exactly.
const SM = {
  NONE: 0,
  MAJOR: 1, MINOR: 2, HARMONIC_MINOR: 3, MELODIC_MINOR: 4,
  DORIAN: 5, PHRYGIAN: 6, LYDIAN: 7, MIXOLYDIAN: 8, LOCRIAN: 9,
  PENTATONIC_MAJOR: 10, PENTATONIC_MINOR: 11,
  BLUES: 12, CHROMATIC: 13, WHOLE_TONE: 14,
  DIMINISHED_HW: 15, DIMINISHED_WH: 16,
  BEBOP_DOMINANT: 17, BEBOP_MAJOR: 18,
  HIRAJOSHI: 19, IN_SEN: 20, HUNGARIAN_MINOR: 21, PHRYGIAN_DOMINANT: 22,
} as const

// ============================================================================
// Note ↔ Semitone
// ============================================================================

/** Letter (with optional accidental) → semitone offset from C. */
export const NOTE_TO_SEMITONE: Readonly<Record<string, number>> = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4, 'E#': 5,
  'F': 5, 'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11, 'B#': 0,
}

/** Semitone index → sharp note name. */
export const SEMITONE_TO_NOTE_SHARP: readonly string[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
]

/** Semitone index → flat note name. */
export const SEMITONE_TO_NOTE_FLAT: readonly string[] = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
]

// ============================================================================
// Intervals
// ============================================================================

/** Interval name → cents. */
export const INTERVAL_MAP: Readonly<Record<string, number>> = {
  'P1': 0,
  'm2': 100,
  'M2': 200,
  'm3': 300,
  'M3': 400,
  'P4': 500,
  'tritone': 600, 'A4': 600, 'd5': 600,
  'P5': 700,
  'm6': 800,
  'M6': 900,
  'm7': 1000,
  'M7': 1100,
  'P8': 1200,
}

/** Cents → canonical interval name. */
export const CENTS_TO_INTERVAL: Readonly<Record<number, string>> = {
  0: 'P1',
  100: 'm2',
  200: 'M2',
  300: 'm3',
  400: 'M3',
  500: 'P4',
  600: 'tritone',
  700: 'P5',
  800: 'm6',
  900: 'M6',
  1000: 'm7',
  1100: 'M7',
  1200: 'P8',
}

// ============================================================================
// Durations (quarter-note multipliers)
// ============================================================================

/** Duration name → quarter-note multiplier. */
export const DURATION_MAP: Readonly<Record<string, number>> = {
  'whole': 4,
  'half': 2,
  'quarter': 1,
  'eighth': 0.5,
  'sixteenth': 0.25,
  'thirtysecond': 0.125,
  'dotted.whole': 6,
  'dotted.half': 3,
  'dotted.quarter': 1.5,
  'dotted.eighth': 0.75,
  'triplet.quarter': 2 / 3,
  'triplet.eighth': 1 / 3,
}

/** Sorted [multiplier, name] pairs for reverse lookup (descending by multiplier). */
export const TICKS_RATIO_TO_DURATION: readonly [number, string][] = [
  [6, 'dotted.whole'],
  [4, 'whole'],
  [3, 'dotted.half'],
  [2, 'half'],
  [1.5, 'dotted.quarter'],
  [1, 'quarter'],
  [0.75, 'dotted.eighth'],
  [2 / 3, 'triplet.quarter'],
  [0.5, 'eighth'],
  [1 / 3, 'triplet.eighth'],
  [0.25, 'sixteenth'],
  [0.125, 'thirtysecond'],
]

// ============================================================================
// Scale Mode Map
// ============================================================================

/** Lowercase mode name → ScaleMode integer. */
export const SCALE_MODE_MAP: Readonly<Record<string, number>> = {
  'major': SM.MAJOR,
  'minor': SM.MINOR,
  'harmonic_minor': SM.HARMONIC_MINOR,
  'melodic_minor': SM.MELODIC_MINOR,
  'dorian': SM.DORIAN,
  'phrygian': SM.PHRYGIAN,
  'lydian': SM.LYDIAN,
  'mixolydian': SM.MIXOLYDIAN,
  'aeolian': SM.MINOR,
  'locrian': SM.LOCRIAN,
  'pentatonic_major': SM.PENTATONIC_MAJOR,
  'pentatonic_minor': SM.PENTATONIC_MINOR,
  'blues': SM.BLUES,
  'chromatic': SM.CHROMATIC,
  'whole_tone': SM.WHOLE_TONE,
  'diminished_hw': SM.DIMINISHED_HW,
  'diminished_wh': SM.DIMINISHED_WH,
  'bebop_dominant': SM.BEBOP_DOMINANT,
  'bebop_major': SM.BEBOP_MAJOR,
  'hirajoshi': SM.HIRAJOSHI,
  'in_sen': SM.IN_SEN,
  'hungarian_minor': SM.HUNGARIAN_MINOR,
  'phrygian_dominant': SM.PHRYGIAN_DOMINANT,
}

// ============================================================================
// Scale Intervals — inlined cent arrays
// ============================================================================

/**
 * Scale interval definitions as cent-offset arrays.
 * Inlined to avoid circular dependency with @symphonyscript/theory.
 * Values match theory/src/continuous/scales.ts exactly.
 */
export const SCALE_INTERVALS_MAP: Readonly<Record<number, readonly number[]>> = {
  [SM.MAJOR]:             [0, 200, 400, 500, 700, 900, 1100],
  [SM.MINOR]:             [0, 200, 300, 500, 700, 800, 1000],
  [SM.HARMONIC_MINOR]:    [0, 200, 300, 500, 700, 800, 1100],
  [SM.MELODIC_MINOR]:     [0, 200, 300, 500, 700, 900, 1100],
  [SM.DORIAN]:            [0, 200, 300, 500, 700, 900, 1000],
  [SM.PHRYGIAN]:          [0, 100, 300, 500, 700, 800, 1000],
  [SM.LYDIAN]:            [0, 200, 400, 600, 700, 900, 1100],
  [SM.MIXOLYDIAN]:        [0, 200, 400, 500, 700, 900, 1000],
  [SM.LOCRIAN]:           [0, 100, 300, 500, 600, 800, 1000],
  [SM.PENTATONIC_MAJOR]:  [0, 200, 400, 700, 900],
  [SM.PENTATONIC_MINOR]:  [0, 300, 500, 700, 1000],
  [SM.BLUES]:             [0, 300, 500, 600, 700, 1000],
  [SM.CHROMATIC]:         [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100],
  [SM.WHOLE_TONE]:        [0, 200, 400, 600, 800, 1000],
  [SM.DIMINISHED_HW]:     [0, 100, 300, 400, 600, 700, 900, 1000],
  [SM.DIMINISHED_WH]:     [0, 200, 300, 500, 600, 800, 900, 1100],
  [SM.BEBOP_DOMINANT]:    [0, 200, 400, 500, 700, 900, 1000, 1100],
  [SM.BEBOP_MAJOR]:       [0, 200, 400, 500, 700, 800, 900, 1100],
  [SM.HIRAJOSHI]:         [0, 200, 300, 700, 800],
  [SM.IN_SEN]:            [0, 100, 500, 700, 1000],
  [SM.HUNGARIAN_MINOR]:   [0, 200, 300, 600, 700, 800, 1100],
  [SM.PHRYGIAN_DOMINANT]: [0, 100, 400, 500, 700, 800, 1000],
}

// ============================================================================
// Key Signatures
// ============================================================================

/** Key string 'root:mode' → array of accidental note names. */
export const KEY_SIGNATURE_TABLE: Readonly<Record<string, readonly string[]>> = {
  // Major — sharps
  'C:major':  [],
  'G:major':  ['F#'],
  'D:major':  ['F#', 'C#'],
  'A:major':  ['F#', 'C#', 'G#'],
  'E:major':  ['F#', 'C#', 'G#', 'D#'],
  'B:major':  ['F#', 'C#', 'G#', 'D#', 'A#'],
  'F#:major': ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'],
  'C#:major': ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'],

  // Major — flats
  'F:major':  ['Bb'],
  'Bb:major': ['Bb', 'Eb'],
  'Eb:major': ['Bb', 'Eb', 'Ab'],
  'Ab:major': ['Bb', 'Eb', 'Ab', 'Db'],
  'Db:major': ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
  'Gb:major': ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
  'Cb:major': ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'],

  // Minor — sharps
  'A:minor':  [],
  'E:minor':  ['F#'],
  'B:minor':  ['F#', 'C#'],
  'F#:minor': ['F#', 'C#', 'G#'],
  'C#:minor': ['F#', 'C#', 'G#', 'D#'],
  'G#:minor': ['F#', 'C#', 'G#', 'D#', 'A#'],
  'D#:minor': ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'],
  'A#:minor': ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'],

  // Minor — flats
  'D:minor':  ['Bb'],
  'G:minor':  ['Bb', 'Eb'],
  'C:minor':  ['Bb', 'Eb', 'Ab'],
  'F:minor':  ['Bb', 'Eb', 'Ab', 'Db'],
  'Bb:minor': ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
  'Eb:minor': ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
  'Ab:minor': ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'],
}

// ============================================================================
// Chord Intervals — inlined cent arrays
// ============================================================================

/**
 * Chord interval definitions as cent-offset arrays.
 * Inlined to avoid circular dependency with @symphonyscript/theory.
 * Values match theory/src/continuous/chords.ts exactly.
 */
const CI = {
  MAJ:       [0, 400, 700] as ChordIntervals,
  MAJ7:      [0, 400, 700, 1100] as ChordIntervals,
  MAJ6:      [0, 400, 700, 900] as ChordIntervals,
  SIX_NINE:  [0, 200, 400, 700, 900] as ChordIntervals,
  MAJ9:      [0, 200, 400, 700, 1100] as ChordIntervals,
  MAJ11:     [0, 200, 400, 500, 700, 1100] as ChordIntervals,
  MAJ13:     [0, 200, 400, 500, 700, 900, 1100] as ChordIntervals,
  ADD9:      [0, 200, 400, 700] as ChordIntervals,

  MIN:       [0, 300, 700] as ChordIntervals,
  MIN7:      [0, 300, 700, 1000] as ChordIntervals,
  MIN6:      [0, 300, 700, 900] as ChordIntervals,
  MIN9:      [0, 200, 300, 700, 1000] as ChordIntervals,
  MIN11:     [0, 200, 300, 500, 700, 1000] as ChordIntervals,
  MIN13:     [0, 200, 300, 500, 700, 900, 1000] as ChordIntervals,
  MIN_MAJ7:  [0, 300, 700, 1100] as ChordIntervals,

  DOM7:      [0, 400, 700, 1000] as ChordIntervals,
  DOM9:      [0, 200, 400, 700, 1000] as ChordIntervals,
  DOM11:     [0, 200, 400, 500, 700, 1000] as ChordIntervals,
  DOM13:     [0, 200, 400, 700, 900, 1000] as ChordIntervals,
  DOM7_SUS4: [0, 500, 700, 1000] as ChordIntervals,
  DOM9_SUS4: [0, 200, 500, 700, 1000] as ChordIntervals,

  SUS4:      [0, 500, 700] as ChordIntervals,
  SUS2:      [0, 200, 700] as ChordIntervals,

  POWER:     [0, 700] as ChordIntervals,

  DIM:       [0, 300, 600] as ChordIntervals,
  DIM7:      [0, 300, 600, 900] as ChordIntervals,
  HALF_DIM:  [0, 300, 600, 1000] as ChordIntervals,

  AUG:       [0, 400, 800] as ChordIntervals,
  AUG7:      [0, 400, 800, 1000] as ChordIntervals,
  AUG_MAJ7:  [0, 400, 800, 1100] as ChordIntervals,

  DOM7_B9:      [0, 100, 400, 700, 1000] as ChordIntervals,
  DOM7_SHARP9:  [0, 300, 400, 700, 1000] as ChordIntervals,
  DOM7_B5:      [0, 400, 600, 1000] as ChordIntervals,
  DOM7_ALT:     [0, 100, 300, 400, 600, 800, 1000] as ChordIntervals,
} as const

/** Chord symbol suffix → intervals in cents from root. */
export const CHORD_INTERVALS_MAP: ReadonlyMap<string, ChordIntervals> = new Map<string, ChordIntervals>([
  // Major
  ['maj', CI.MAJ],
  ['', CI.MAJ],
  ['M', CI.MAJ],
  ['maj7', CI.MAJ7],
  ['M7', CI.MAJ7],
  ['6', CI.MAJ6],
  ['M6', CI.MAJ6],
  ['6/9', CI.SIX_NINE],
  ['69', CI.SIX_NINE],
  ['6add9', CI.SIX_NINE],
  ['maj9', CI.MAJ9],
  ['M9', CI.MAJ9],
  ['maj11', CI.MAJ11],
  ['M11', CI.MAJ11],
  ['maj13', CI.MAJ13],
  ['M13', CI.MAJ13],
  ['add9', CI.ADD9],

  // Minor
  ['m', CI.MIN],
  ['min', CI.MIN],
  ['-', CI.MIN],
  ['m7', CI.MIN7],
  ['min7', CI.MIN7],
  ['-7', CI.MIN7],
  ['m6', CI.MIN6],
  ['min6', CI.MIN6],
  ['mM7', CI.MIN_MAJ7],
  ['m(M7)', CI.MIN_MAJ7],
  ['minMaj7', CI.MIN_MAJ7],
  ['m9', CI.MIN9],
  ['min9', CI.MIN9],
  ['m11', CI.MIN11],
  ['min11', CI.MIN11],
  ['m13', CI.MIN13],
  ['min13', CI.MIN13],

  // Dominant
  ['7', CI.DOM7],
  ['dom7', CI.DOM7],
  ['9', CI.DOM9],
  ['dom9', CI.DOM9],
  ['11', CI.DOM11],
  ['dom11', CI.DOM11],
  ['13', CI.DOM13],
  ['dom13', CI.DOM13],
  ['7sus4', CI.DOM7_SUS4],
  ['7sus', CI.DOM7_SUS4],
  ['9sus4', CI.DOM9_SUS4],
  ['9sus', CI.DOM9_SUS4],

  // Suspended
  ['sus4', CI.SUS4],
  ['sus', CI.SUS4],
  ['sus2', CI.SUS2],
  ['2', CI.SUS2],

  // Power
  ['5', CI.POWER],
  ['(no3)', CI.POWER],

  // Diminished
  ['dim', CI.DIM],
  ['dim7', CI.DIM7],
  ['m7b5', CI.HALF_DIM],

  // Augmented
  ['aug', CI.AUG],
  ['+', CI.AUG],
  ['aug7', CI.AUG7],
  ['+7', CI.AUG7],
  ['7#5', CI.AUG7],
  ['maj7#5', CI.AUG_MAJ7],

  // Altered
  ['7b9', CI.DOM7_B9],
  ['7-9', CI.DOM7_B9],
  ['7#9', CI.DOM7_SHARP9],
  ['7+9', CI.DOM7_SHARP9],
  ['7b5', CI.DOM7_B5],
  ['7-5', CI.DOM7_B5],
  ['7alt', CI.DOM7_ALT],
])

/** Reverse lookup: JSON.stringify(intervals) → first matching chord suffix. */
export const INTERVALS_TO_CHORD_MAP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>()
  for (const [suffix, intervals] of CHORD_INTERVALS_MAP) {
    const key = JSON.stringify(intervals)
    if (!map.has(key)) {
      map.set(key, suffix)
    }
  }
  return map
})()

// ============================================================================
// Roman Numerals
// ============================================================================

/** Roman numeral stem → 0-indexed degree. Both cases map to same value. */
export const ROMAN_TO_DEGREE: Readonly<Record<string, number>> = {
  'I': 0, 'i': 0,
  'II': 1, 'ii': 1,
  'III': 2, 'iii': 2,
  'IV': 3, 'iv': 3,
  'V': 4, 'v': 4,
  'VI': 5, 'vi': 5,
  'VII': 6, 'vii': 6,
}
