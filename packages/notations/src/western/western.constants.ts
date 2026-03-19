/**
 * Western notation lookup data.
 *
 * All maps, tables, and constants needed by WesternNotation.
 * No regex. No imports from western-legacy/.
 *
 * Scale interval arrays and drum constants are imported from @symphonyscript/theory
 * (single source of truth for the math). This file maps
 * notation-specific scale names to those arrays.
 */

import type { ChordIntervals, ScaleIntervals } from '@symphonyscript/core'

import { Scale, Drum } from '@symphonyscript/theory'

// Alias Scale intervals from theory (PascalCase → SCREAMING_SNAKE_CASE)
const IONIAN_INTERVALS = Scale.Ionian
const DORIAN_INTERVALS = Scale.Dorian
const PHRYGIAN_INTERVALS = Scale.Phrygian
const LYDIAN_INTERVALS = Scale.Lydian
const MIXOLYDIAN_INTERVALS = Scale.Mixolydian
const AEOLIAN_INTERVALS = Scale.Aeolian
const LOCRIAN_INTERVALS = Scale.Locrian
const HARMONIC_MINOR_INTERVALS = Scale.HarmonicMinor
const MELODIC_MINOR_INTERVALS = Scale.MelodicMinor
const PENTATONIC_MAJOR_INTERVALS = Scale.PentatonicMajor
const PENTATONIC_MINOR_INTERVALS = Scale.PentatonicMinor
const BLUES_INTERVALS = Scale.Blues
const CHROMATIC_INTERVALS = Scale.Chromatic
const WHOLE_TONE_INTERVALS = Scale.WholeTone
const DIMINISHED_HW_INTERVALS = Scale.DiminishedHW
const DIMINISHED_WH_INTERVALS = Scale.DiminishedWH
const BEBOP_DOMINANT_INTERVALS = Scale.BebopDominant
const BEBOP_MAJOR_INTERVALS = Scale.BebopMajor
const HIRAJOSHI_INTERVALS = Scale.Hirajoshi
const IN_SEN_INTERVALS = Scale.InSen
const HUNGARIAN_MINOR_INTERVALS = Scale.HungarianMinor
const PHRYGIAN_DOMINANT_INTERVALS = Scale.PhrygianDominant

// Alias Drum constants from theory (PascalCase → SCREAMING_SNAKE_CASE)
const ACOUSTIC_BASS_DRUM = Drum.AcousticBassDrum
const BASS_DRUM_1 = Drum.BassDrum1
const SIDE_STICK = Drum.SideStick
const ACOUSTIC_SNARE = Drum.AcousticSnare
const HAND_CLAP = Drum.HandClap
const ELECTRIC_SNARE = Drum.ElectricSnare
const LOW_FLOOR_TOM = Drum.LowFloorTom
const CLOSED_HI_HAT = Drum.ClosedHiHat
const HIGH_FLOOR_TOM = Drum.HighFloorTom
const PEDAL_HI_HAT = Drum.PedalHiHat
const LOW_TOM = Drum.LowTom
const OPEN_HI_HAT = Drum.OpenHiHat
const LOW_MID_TOM = Drum.LowMidTom
const HI_MID_TOM = Drum.HiMidTom
const CRASH_CYMBAL_1 = Drum.CrashCymbal1
const HIGH_TOM = Drum.HighTom
const RIDE_CYMBAL_1 = Drum.RideCymbal1
const CHINESE_CYMBAL = Drum.ChineseCymbal
const RIDE_BELL = Drum.RideBell
const TAMBOURINE = Drum.Tambourine
const SPLASH_CYMBAL = Drum.SplashCymbal
const COWBELL = Drum.Cowbell
const CRASH_CYMBAL_2 = Drum.CrashCymbal2
const VIBRASLAP = Drum.Vibraslap
const RIDE_CYMBAL_2 = Drum.RideCymbal2
const HI_BONGO = Drum.HiBongo
const LOW_BONGO = Drum.LowBongo
const MUTE_HI_CONGA = Drum.MuteHiConga
const OPEN_HI_CONGA = Drum.OpenHiConga
const LOW_CONGA = Drum.LowConga
const HIGH_TIMBALE = Drum.HighTimbale
const LOW_TIMBALE = Drum.LowTimbale
const HIGH_AGOGO = Drum.HighAgogo
const LOW_AGOGO = Drum.LowAgogo
const CABASA = Drum.Cabasa
const MARACAS = Drum.Maracas
const SHORT_WHISTLE = Drum.ShortWhistle
const LONG_WHISTLE = Drum.LongWhistle
const SHORT_GUIRO = Drum.ShortGuiro
const LONG_GUIRO = Drum.LongGuiro
const CLAVES = Drum.Claves
const HI_WOOD_BLOCK = Drum.HiWoodBlock
const LOW_WOOD_BLOCK = Drum.LowWoodBlock
const MUTE_CUICA = Drum.MuteCuica
const OPEN_CUICA = Drum.OpenCuica
const MUTE_TRIANGLE = Drum.MuteTriangle
const OPEN_TRIANGLE = Drum.OpenTriangle

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
  // Standard (long)
  'whole': 4,
  'half': 2,
  'quarter': 1,
  'eighth': 0.5,
  'sixteenth': 0.25,
  'thirtysecond': 0.125,
  // Standard (short)
  '1n': 4,
  '2n': 2,
  '4n': 1,
  '8n': 0.5,
  '16n': 0.25,
  '32n': 0.125,
  // Dotted (long)
  'dotted.whole': 6,
  'dotted.half': 3,
  'dotted.quarter': 1.5,
  'dotted.eighth': 0.75,
  'dotted.sixteenth': 0.375,
  'dotted.thirtysecond': 0.1875,
  // Dotted (short)
  '1n.': 6,
  '2n.': 3,
  '4n.': 1.5,
  '8n.': 0.75,
  '16n.': 0.375,
  '32n.': 0.1875,
  // Triplet (long)
  'triplet.half': 4 / 3,
  'triplet.quarter': 2 / 3,
  'triplet.eighth': 1 / 3,
  'triplet.sixteenth': 1 / 6,
  // Triplet (short)
  '2t': 4 / 3,
  '4t': 2 / 3,
  '8t': 1 / 3,
  '16t': 1 / 6,
}

/** Sorted [multiplier, name] pairs for reverse lookup (descending by multiplier). */
export const TICKS_RATIO_TO_DURATION: readonly [number, string][] = [
  [6, 'dotted.whole'],
  [4, 'whole'],
  [3, 'dotted.half'],
  [2, 'half'],
  [1.5, 'dotted.quarter'],
  [4 / 3, 'triplet.half'],
  [1, 'quarter'],
  [0.75, 'dotted.eighth'],
  [2 / 3, 'triplet.quarter'],
  [0.5, 'eighth'],
  [0.375, 'dotted.sixteenth'],
  [1 / 3, 'triplet.eighth'],
  [0.25, 'sixteenth'],
  [0.1875, 'dotted.thirtysecond'],
  [1 / 6, 'triplet.sixteenth'],
  [0.125, 'thirtysecond'],
]

// ============================================================================
// Drums — friendly name ↔ cents (values from @symphonyscript/theory)
// ============================================================================

/** Drum name → pitch in cents. */
export const DRUM_MAP: Readonly<Record<string, number>> = {
  // Core kit
  'kick': BASS_DRUM_1,
  'kick2': ACOUSTIC_BASS_DRUM,
  'snare': ACOUSTIC_SNARE,
  'snare2': ELECTRIC_SNARE,
  'clap': HAND_CLAP,
  'rimshot': SIDE_STICK,
  // Hi-hats
  'hihat': CLOSED_HI_HAT,
  'hihat.open': OPEN_HI_HAT,
  'hihat.pedal': PEDAL_HI_HAT,
  // Toms (high → low)
  'tom1': HIGH_TOM,
  'tom2': HI_MID_TOM,
  'tom3': LOW_MID_TOM,
  'tom4': LOW_TOM,
  'tom5': HIGH_FLOOR_TOM,
  'tom6': LOW_FLOOR_TOM,
  // Cymbals
  'crash': CRASH_CYMBAL_1,
  'crash2': CRASH_CYMBAL_2,
  'ride': RIDE_CYMBAL_1,
  'ride2': RIDE_CYMBAL_2,
  'ride.bell': RIDE_BELL,
  'splash': SPLASH_CYMBAL,
  'china': CHINESE_CYMBAL,
  // Auxiliary
  'tambourine': TAMBOURINE,
  'cowbell': COWBELL,
  'vibraslap': VIBRASLAP,
  'cabasa': CABASA,
  'maracas': MARACAS,
  // Bongos & congas
  'bongo.hi': HI_BONGO,
  'bongo.lo': LOW_BONGO,
  'conga.mute': MUTE_HI_CONGA,
  'conga.open': OPEN_HI_CONGA,
  'conga.lo': LOW_CONGA,
  // Timbales
  'timbale.hi': HIGH_TIMBALE,
  'timbale.lo': LOW_TIMBALE,
  // Agogo
  'agogo.hi': HIGH_AGOGO,
  'agogo.lo': LOW_AGOGO,
  // Whistles & guiros
  'whistle.short': SHORT_WHISTLE,
  'whistle.long': LONG_WHISTLE,
  'guiro.short': SHORT_GUIRO,
  'guiro.long': LONG_GUIRO,
  // Misc
  'claves': CLAVES,
  'woodblock.hi': HI_WOOD_BLOCK,
  'woodblock.lo': LOW_WOOD_BLOCK,
  'cuica.mute': MUTE_CUICA,
  'cuica.open': OPEN_CUICA,
  'triangle.mute': MUTE_TRIANGLE,
  'triangle.open': OPEN_TRIANGLE,
}

/** Cents → canonical drum name for reverse lookup. */
export const CENTS_TO_DRUM: Readonly<Record<number, string>> = {
  [ACOUSTIC_BASS_DRUM]: 'kick2',
  [BASS_DRUM_1]: 'kick',
  [SIDE_STICK]: 'rimshot',
  [ACOUSTIC_SNARE]: 'snare',
  [HAND_CLAP]: 'clap',
  [ELECTRIC_SNARE]: 'snare2',
  [LOW_FLOOR_TOM]: 'tom6',
  [CLOSED_HI_HAT]: 'hihat',
  [HIGH_FLOOR_TOM]: 'tom5',
  [PEDAL_HI_HAT]: 'hihat.pedal',
  [LOW_TOM]: 'tom4',
  [OPEN_HI_HAT]: 'hihat.open',
  [LOW_MID_TOM]: 'tom3',
  [HI_MID_TOM]: 'tom2',
  [CRASH_CYMBAL_1]: 'crash',
  [HIGH_TOM]: 'tom1',
  [RIDE_CYMBAL_1]: 'ride',
  [CHINESE_CYMBAL]: 'china',
  [RIDE_BELL]: 'ride.bell',
  [TAMBOURINE]: 'tambourine',
  [SPLASH_CYMBAL]: 'splash',
  [COWBELL]: 'cowbell',
  [CRASH_CYMBAL_2]: 'crash2',
  [VIBRASLAP]: 'vibraslap',
  [RIDE_CYMBAL_2]: 'ride2',
  [HI_BONGO]: 'bongo.hi',
  [LOW_BONGO]: 'bongo.lo',
  [MUTE_HI_CONGA]: 'conga.mute',
  [OPEN_HI_CONGA]: 'conga.open',
  [LOW_CONGA]: 'conga.lo',
  [HIGH_TIMBALE]: 'timbale.hi',
  [LOW_TIMBALE]: 'timbale.lo',
  [HIGH_AGOGO]: 'agogo.hi',
  [LOW_AGOGO]: 'agogo.lo',
  [CABASA]: 'cabasa',
  [MARACAS]: 'maracas',
  [SHORT_WHISTLE]: 'whistle.short',
  [LONG_WHISTLE]: 'whistle.long',
  [SHORT_GUIRO]: 'guiro.short',
  [LONG_GUIRO]: 'guiro.long',
  [CLAVES]: 'claves',
  [HI_WOOD_BLOCK]: 'woodblock.hi',
  [LOW_WOOD_BLOCK]: 'woodblock.lo',
  [MUTE_CUICA]: 'cuica.mute',
  [OPEN_CUICA]: 'cuica.open',
  [MUTE_TRIANGLE]: 'triangle.mute',
  [OPEN_TRIANGLE]: 'triangle.open',
}

// ============================================================================
// Scale Intervals — string-keyed, backed by theory constants
// ============================================================================

/**
 * Scale mode name → interval array (cents from root).
 * Keys are canonical Western scale names matching ScaleModeRegistry.
 * Values imported from @symphonyscript/theory (single source of truth).
 */
export const SCALE_INTERVALS_MAP: Readonly<Record<string, ScaleIntervals>> = {
  'major':             IONIAN_INTERVALS,
  'minor':             AEOLIAN_INTERVALS,
  'dorian':            DORIAN_INTERVALS,
  'phrygian':          PHRYGIAN_INTERVALS,
  'lydian':            LYDIAN_INTERVALS,
  'mixolydian':        MIXOLYDIAN_INTERVALS,
  'aeolian':           AEOLIAN_INTERVALS,
  'locrian':           LOCRIAN_INTERVALS,
  'harmonic_minor':    HARMONIC_MINOR_INTERVALS,
  'melodic_minor':     MELODIC_MINOR_INTERVALS,
  'pentatonic_major':  PENTATONIC_MAJOR_INTERVALS,
  'pentatonic_minor':  PENTATONIC_MINOR_INTERVALS,
  'blues':             BLUES_INTERVALS,
  'chromatic':         CHROMATIC_INTERVALS,
  'whole_tone':        WHOLE_TONE_INTERVALS,
  'diminished_hw':     DIMINISHED_HW_INTERVALS,
  'diminished_wh':     DIMINISHED_WH_INTERVALS,
  'bebop_dominant':    BEBOP_DOMINANT_INTERVALS,
  'bebop_major':       BEBOP_MAJOR_INTERVALS,
  'hirajoshi':         HIRAJOSHI_INTERVALS,
  'in_sen':            IN_SEN_INTERVALS,
  'hungarian_minor':   HUNGARIAN_MINOR_INTERVALS,
  'phrygian_dominant': PHRYGIAN_DOMINANT_INTERVALS,
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

/** Valid roman numeral stems in lowercase, ordered longest-first for greedy match. */
export const ROMAN_STEMS: Readonly<string[]> = ['vii', 'iii', 'iv', 'vi', 'ii', 'v', 'i']
