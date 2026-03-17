declare module '@symphonyscript/core' {
  interface ScaleModeRegistry {
    western: 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian'
  }
  interface PitchClassRegistry {
    western: 'C' | 'C#' | 'Db' | 'D'
  }
  interface DegreeRegistry {
    western: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'i' | 'ii'
  }
}
