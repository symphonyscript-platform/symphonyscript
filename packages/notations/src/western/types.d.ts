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
    western: 'C' | 'C#' | 'Db' | 'D'
  }
  interface DegreeRegistry {
    western: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'i' | 'ii'
  }
}
