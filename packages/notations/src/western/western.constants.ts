/**
 * Western notation lookup data.
 *
 * All maps, tables, and constants needed by WesternNotation.
 * No regex. Theory math imported from @symphonyscript/theory.
 */

import type { ScaleIntervals } from '@symphonyscript/core'

import { Scale, Drum, Chord, Duration } from '@symphonyscript/theory'

// ============================================================================
// Note ↔ Semitone (re-exported from theory)
// ============================================================================

export { NoteToSemitone as NOTE_TO_SEMITONE } from '@symphonyscript/theory'
export { SemitoneToNoteSharp as SEMITONE_TO_NOTE_SHARP } from '@symphonyscript/theory'
export { SemitoneToNoteFlat as SEMITONE_TO_NOTE_FLAT } from '@symphonyscript/theory'

// ============================================================================
// Intervals (re-exported from theory)
// ============================================================================

export { IntervalNameToCents as INTERVAL_MAP } from '@symphonyscript/theory'
export { CentsToIntervalName as CENTS_TO_INTERVAL } from '@symphonyscript/theory'

// ============================================================================
// Durations (quarter-note multipliers)
// ============================================================================

const D = Duration

/** Duration name → quarter-note multiplier. */
export const DURATION_MAP: Readonly<Record<string, number>> = {
  // Standard (long)
  'whole': D.Whole,
  'half': D.Half,
  'quarter': D.Quarter,
  'eighth': D.Eighth,
  'sixteenth': D.Sixteenth,
  'thirtysecond': D.ThirtySecond,
  // Standard (short)
  '1n': D.Whole,
  '2n': D.Half,
  '4n': D.Quarter,
  '8n': D.Eighth,
  '16n': D.Sixteenth,
  '32n': D.ThirtySecond,
  // Dotted (long)
  'dotted.whole': D.DottedWhole,
  'dotted.half': D.DottedHalf,
  'dotted.quarter': D.DottedQuarter,
  'dotted.eighth': D.DottedEighth,
  'dotted.sixteenth': D.DottedSixteenth,
  'dotted.thirtysecond': D.ThirtySecond * 1.5,
  // Dotted (short)
  '1n.': D.DottedWhole,
  '2n.': D.DottedHalf,
  '4n.': D.DottedQuarter,
  '8n.': D.DottedEighth,
  '16n.': D.DottedSixteenth,
  '32n.': D.ThirtySecond * 1.5,
  // Triplet (long)
  'triplet.half': D.HalfTriplet,
  'triplet.quarter': D.QuarterTriplet,
  'triplet.eighth': D.EighthTriplet,
  'triplet.sixteenth': D.SixteenthTriplet,
  // Triplet (short)
  '2t': D.HalfTriplet,
  '4t': D.QuarterTriplet,
  '8t': D.EighthTriplet,
  '16t': D.SixteenthTriplet,
}

/** Sorted [multiplier, name] pairs for reverse lookup (descending by multiplier). */
export const TICKS_RATIO_TO_DURATION: readonly [number, string][] = [
  [D.DottedWhole, 'dotted.whole'],
  [D.Whole, 'whole'],
  [D.DottedHalf, 'dotted.half'],
  [D.Half, 'half'],
  [D.DottedQuarter, 'dotted.quarter'],
  [D.HalfTriplet, 'triplet.half'],
  [D.Quarter, 'quarter'],
  [D.DottedEighth, 'dotted.eighth'],
  [D.QuarterTriplet, 'triplet.quarter'],
  [D.Eighth, 'eighth'],
  [D.DottedSixteenth, 'dotted.sixteenth'],
  [D.EighthTriplet, 'triplet.eighth'],
  [D.Sixteenth, 'sixteenth'],
  [D.ThirtySecond * 1.5, 'dotted.thirtysecond'],
  [D.SixteenthTriplet, 'triplet.sixteenth'],
  [D.ThirtySecond, 'thirtysecond'],
]

// ============================================================================
// Drums — friendly name ↔ cents (values from @symphonyscript/theory)
// ============================================================================

/** Drum name → pitch in cents. */
export const DRUM_MAP: Readonly<Record<string, number>> = {
  // Core kit
  'kick': Drum.BassDrum1,
  'kick2': Drum.AcousticBassDrum,
  'snare': Drum.AcousticSnare,
  'snare2': Drum.ElectricSnare,
  'clap': Drum.HandClap,
  'rimshot': Drum.SideStick,
  // Hi-hats
  'hihat': Drum.ClosedHiHat,
  'hihat.open': Drum.OpenHiHat,
  'hihat.pedal': Drum.PedalHiHat,
  // Toms (high → low)
  'tom1': Drum.HighTom,
  'tom2': Drum.HiMidTom,
  'tom3': Drum.LowMidTom,
  'tom4': Drum.LowTom,
  'tom5': Drum.HighFloorTom,
  'tom6': Drum.LowFloorTom,
  // Cymbals
  'crash': Drum.CrashCymbal1,
  'crash2': Drum.CrashCymbal2,
  'ride': Drum.RideCymbal1,
  'ride2': Drum.RideCymbal2,
  'ride.bell': Drum.RideBell,
  'splash': Drum.SplashCymbal,
  'china': Drum.ChineseCymbal,
  // Auxiliary
  'tambourine': Drum.Tambourine,
  'cowbell': Drum.Cowbell,
  'vibraslap': Drum.Vibraslap,
  'cabasa': Drum.Cabasa,
  'maracas': Drum.Maracas,
  // Bongos & congas
  'bongo.hi': Drum.HiBongo,
  'bongo.lo': Drum.LowBongo,
  'conga.mute': Drum.MuteHiConga,
  'conga.open': Drum.OpenHiConga,
  'conga.lo': Drum.LowConga,
  // Timbales
  'timbale.hi': Drum.HighTimbale,
  'timbale.lo': Drum.LowTimbale,
  // Agogo
  'agogo.hi': Drum.HighAgogo,
  'agogo.lo': Drum.LowAgogo,
  // Whistles & guiros
  'whistle.short': Drum.ShortWhistle,
  'whistle.long': Drum.LongWhistle,
  'guiro.short': Drum.ShortGuiro,
  'guiro.long': Drum.LongGuiro,
  // Misc
  'claves': Drum.Claves,
  'woodblock.hi': Drum.HiWoodBlock,
  'woodblock.lo': Drum.LowWoodBlock,
  'cuica.mute': Drum.MuteCuica,
  'cuica.open': Drum.OpenCuica,
  'triangle.mute': Drum.MuteTriangle,
  'triangle.open': Drum.OpenTriangle,
}

/** Cents → canonical drum name for reverse lookup. */
export const CENTS_TO_DRUM: Readonly<Record<number, string>> = {
  [Drum.AcousticBassDrum]: 'kick2',
  [Drum.BassDrum1]: 'kick',
  [Drum.SideStick]: 'rimshot',
  [Drum.AcousticSnare]: 'snare',
  [Drum.HandClap]: 'clap',
  [Drum.ElectricSnare]: 'snare2',
  [Drum.LowFloorTom]: 'tom6',
  [Drum.ClosedHiHat]: 'hihat',
  [Drum.HighFloorTom]: 'tom5',
  [Drum.PedalHiHat]: 'hihat.pedal',
  [Drum.LowTom]: 'tom4',
  [Drum.OpenHiHat]: 'hihat.open',
  [Drum.LowMidTom]: 'tom3',
  [Drum.HiMidTom]: 'tom2',
  [Drum.CrashCymbal1]: 'crash',
  [Drum.HighTom]: 'tom1',
  [Drum.RideCymbal1]: 'ride',
  [Drum.ChineseCymbal]: 'china',
  [Drum.RideBell]: 'ride.bell',
  [Drum.Tambourine]: 'tambourine',
  [Drum.SplashCymbal]: 'splash',
  [Drum.Cowbell]: 'cowbell',
  [Drum.CrashCymbal2]: 'crash2',
  [Drum.Vibraslap]: 'vibraslap',
  [Drum.RideCymbal2]: 'ride2',
  [Drum.HiBongo]: 'bongo.hi',
  [Drum.LowBongo]: 'bongo.lo',
  [Drum.MuteHiConga]: 'conga.mute',
  [Drum.OpenHiConga]: 'conga.open',
  [Drum.LowConga]: 'conga.lo',
  [Drum.HighTimbale]: 'timbale.hi',
  [Drum.LowTimbale]: 'timbale.lo',
  [Drum.HighAgogo]: 'agogo.hi',
  [Drum.LowAgogo]: 'agogo.lo',
  [Drum.Cabasa]: 'cabasa',
  [Drum.Maracas]: 'maracas',
  [Drum.ShortWhistle]: 'whistle.short',
  [Drum.LongWhistle]: 'whistle.long',
  [Drum.ShortGuiro]: 'guiro.short',
  [Drum.LongGuiro]: 'guiro.long',
  [Drum.Claves]: 'claves',
  [Drum.HiWoodBlock]: 'woodblock.hi',
  [Drum.LowWoodBlock]: 'woodblock.lo',
  [Drum.MuteCuica]: 'cuica.mute',
  [Drum.OpenCuica]: 'cuica.open',
  [Drum.MuteTriangle]: 'triangle.mute',
  [Drum.OpenTriangle]: 'triangle.open',
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
  'major':             Scale.Ionian,
  'minor':             Scale.Aeolian,
  'dorian':            Scale.Dorian,
  'phrygian':          Scale.Phrygian,
  'lydian':            Scale.Lydian,
  'mixolydian':        Scale.Mixolydian,
  'aeolian':           Scale.Aeolian,
  'locrian':           Scale.Locrian,
  'harmonic_minor':    Scale.HarmonicMinor,
  'melodic_minor':     Scale.MelodicMinor,
  'pentatonic_major':  Scale.PentatonicMajor,
  'pentatonic_minor':  Scale.PentatonicMinor,
  'blues':             Scale.Blues,
  'chromatic':         Scale.Chromatic,
  'whole_tone':        Scale.WholeTone,
  'diminished_hw':     Scale.DiminishedHW,
  'diminished_wh':     Scale.DiminishedWH,
  'bebop_dominant':    Scale.BebopDominant,
  'bebop_major':       Scale.BebopMajor,
  'hirajoshi':         Scale.Hirajoshi,
  'in_sen':            Scale.InSen,
  'hungarian_minor':   Scale.HungarianMinor,
  'phrygian_dominant': Scale.PhrygianDominant,
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
// Chord Intervals — backed by @symphonyscript/theory
// ============================================================================

const C = Chord

/** Chord symbol suffix → intervals in cents from root. */
export const CHORD_INTERVALS_MAP: ReadonlyMap<string, readonly number[]> = new Map<string, readonly number[]>([
  // Major
  ['maj', C.Maj],
  ['', C.Maj],
  ['M', C.Maj],
  ['maj7', C.Maj7],
  ['M7', C.Maj7],
  ['6', C.Maj6],
  ['M6', C.Maj6],
  ['6/9', C.SixNine],
  ['69', C.SixNine],
  ['6add9', C.SixNine],
  ['maj9', C.Maj9],
  ['M9', C.Maj9],
  ['maj11', C.Maj11],
  ['M11', C.Maj11],
  ['maj13', C.Maj13],
  ['M13', C.Maj13],
  ['add9', C.Add9],

  // Minor
  ['m', C.Min],
  ['min', C.Min],
  ['-', C.Min],
  ['m7', C.Min7],
  ['min7', C.Min7],
  ['-7', C.Min7],
  ['m6', C.Min6],
  ['min6', C.Min6],
  ['mM7', C.MinMaj7],
  ['m(M7)', C.MinMaj7],
  ['minMaj7', C.MinMaj7],
  ['m9', C.Min9],
  ['min9', C.Min9],
  ['m11', C.Min11],
  ['min11', C.Min11],
  ['m13', C.Min13],
  ['min13', C.Min13],

  // Dominant
  ['7', C.Dom7],
  ['dom7', C.Dom7],
  ['9', C.Dom9],
  ['dom9', C.Dom9],
  ['11', C.Dom11],
  ['dom11', C.Dom11],
  ['13', C.Dom13],
  ['dom13', C.Dom13],
  ['7sus4', C.Dom7Sus4],
  ['7sus', C.Dom7Sus4],
  ['9sus4', C.Dom9Sus4],
  ['9sus', C.Dom9Sus4],

  // Suspended
  ['sus4', C.Sus4],
  ['sus', C.Sus4],
  ['sus2', C.Sus2],
  ['2', C.Sus2],

  // Power
  ['5', C.Power],
  ['(no3)', C.Power],

  // Diminished
  ['dim', C.Dim],
  ['dim7', C.Dim7],
  ['m7b5', C.HalfDim],

  // Augmented
  ['aug', C.Aug],
  ['+', C.Aug],
  ['aug7', C.Aug7],
  ['+7', C.Aug7],
  ['7#5', C.Aug7],
  ['maj7#5', C.AugMaj7],

  // Altered
  ['7b9', C.Dom7b9],
  ['7-9', C.Dom7b9],
  ['7#9', C.Dom7Sharp9],
  ['7+9', C.Dom7Sharp9],
  ['7b5', C.Dom7b5],
  ['7-5', C.Dom7b5],
  ['7alt', C.Dom7Alt],
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
