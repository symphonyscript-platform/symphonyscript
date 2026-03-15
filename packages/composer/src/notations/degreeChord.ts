import { DegreeChordBuilder } from '../builders/DegreeChordBuilder'

/**
 * Emit a chord built from scale degrees.
 * Resolves degrees to pitches using the bridge's scale context.
 */
export function degreeChord(degrees?: number[], duration?: number): DegreeChordBuilder {
  return new DegreeChordBuilder({ degrees, duration })
}
