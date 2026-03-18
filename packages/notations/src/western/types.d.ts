export {}

declare module '@symphonyscript/core' {
  interface ScaleModeRegistry {
    western:
      | 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian'
      | 'aeolian' | 'locrian'
      | 'harmonic_minor' | 'melodic_minor'
      | 'pentatonic_major' | 'pentatonic_minor'
      | 'blues' | 'chromatic' | 'whole_tone'
      | 'diminished_hw' | 'diminished_wh'
      | 'bebop_dominant' | 'bebop_major'
      | 'hirajoshi' | 'in_sen' | 'hungarian_minor' | 'phrygian_dominant'
  }
  interface PitchClassRegistry {
    western:
      | 'C' | 'C#' | 'Db'
      | 'D' | 'D#' | 'Eb'
      | 'E'
      | 'F' | 'F#' | 'Gb'
      | 'G' | 'G#' | 'Ab'
      | 'A' | 'A#' | 'Bb'
      | 'B'
  }
  interface DegreeRegistry {
    western:
      | 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII'
      | 'i' | 'ii' | 'iii' | 'iv' | 'v' | 'vi' | 'vii'
      | 'I7' | 'II7' | 'III7' | 'IV7' | 'V7' | 'VI7' | 'VII7'
      | 'i7' | 'ii7' | 'iii7' | 'iv7' | 'v7' | 'vi7' | 'vii7'
      | 'bI' | 'bII' | 'bIII' | 'bIV' | 'bV' | 'bVI' | 'bVII'
      | '#I' | '#II' | '#III' | '#IV' | '#V' | '#VI' | '#VII'
  }
  interface IntervalNameRegistry {
    western:
      | 'P1' | 'm2' | 'M2' | 'm3' | 'M3'
      | 'P4' | 'tritone' | 'A4' | 'd5'
      | 'P5' | 'm6' | 'M6' | 'm7' | 'M7' | 'P8'
  }
  interface ChordSymbolRegistry {
    western:
      // Major
      | 'maj' | '' | 'M'
      | 'maj7' | 'M7' | '6' | 'M6' | '6/9' | '69' | '6add9'
      | 'maj9' | 'M9' | 'maj11' | 'M11' | 'maj13' | 'M13' | 'add9'
      // Minor
      | 'm' | 'min' | '-'
      | 'm7' | 'min7' | '-7' | 'm6' | 'min6'
      | 'mM7' | 'm(M7)' | 'minMaj7'
      | 'm9' | 'min9' | 'm11' | 'min11' | 'm13' | 'min13'
      // Dominant
      | '7' | 'dom7' | '9' | 'dom9' | '11' | 'dom11' | '13' | 'dom13'
      | '7sus4' | '7sus' | '9sus4' | '9sus'
      // Suspended
      | 'sus4' | 'sus' | 'sus2' | '2'
      // Power
      | '5' | '(no3)'
      // Diminished
      | 'dim' | 'dim7' | 'm7b5'
      // Augmented
      | 'aug' | '+' | 'aug7' | '+7' | '7#5' | 'maj7#5'
      // Altered
      | '7b9' | '7-9' | '7#9' | '7+9' | '7b5' | '7-5' | '7alt'
  }
  interface DurationRegistry {
    western:
      // Standard (long)
      | 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | 'thirtysecond'
      // Standard (short)
      | '1n' | '2n' | '4n' | '8n' | '16n' | '32n'
      // Dotted (long)
      | 'dotted.whole' | 'dotted.half' | 'dotted.quarter' | 'dotted.eighth'
      // Dotted (short)
      | '1n.' | '2n.' | '4n.' | '8n.' | '16n.'
      // Triplet (long)
      | 'triplet.quarter' | 'triplet.eighth'
      // Triplet (short)
      | '2t' | '4t' | '8t' | '16t'
  }
}
