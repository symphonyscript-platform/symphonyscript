export interface ParsedChordCode {
  /** Root note name (e.g. 'C', 'F#', 'Bb') */
  readonly root: string
  /** Chord quality suffix (e.g. 'maj7', 'm', '7', '') */
  readonly suffix: string
}
