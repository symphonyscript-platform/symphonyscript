import { ChordIntervals } from '../types'

/**
 * Result of resolving a chord within a scale context.
 * Returned by `Notation.resolveProgression()`.
 */
export interface ChordResolution {
  /** Root pitch of the chord in cents from the scale root. */
  readonly rootCents: number
  /** Chord intervals in cents from the chord root. */
  readonly intervals: ChordIntervals
}
