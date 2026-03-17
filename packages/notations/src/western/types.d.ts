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
  }
}
