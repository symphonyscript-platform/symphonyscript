/** Voice leading style. */
export type VoiceLeadingStyle = 'close' | 'open' | 'drop2'

/** Voice leading options. */
export interface VoiceLeadOptions {
  /** Number of voices (default: 4) */
  readonly voices?: number
  /** Voicing style */
  readonly style?: VoiceLeadingStyle
  /** Center octave (default: 4) */
  readonly centerOctave?: number
}

/** Voice movement from one pitch to another. */
export interface VoiceMovement {
  /** Starting pitch in cents */
  readonly from: number
  /** Target pitch in cents */
  readonly to: number
  /** Movement distance in cents */
  readonly distance: number
}
