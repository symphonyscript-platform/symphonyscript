import { DegreeBuilder } from '../builders/DegreeBuilder'

import { NoteDuration } from '@symphonyscript/core'

/**
 * Create a {@link DegreeBuilder} that emits a single pitch from a scale degree.
 *
 * Resolves the degree to MIDI pitch using the bridge's scale context (scaleRoot,
 * scaleMode) via `degreeToPitch`. Inherits velocity, duration, accidentals,
 * octave shift, transpose, repeat, and articulations from {@link PitchStepBuilder}.
 * Degrees 1–7 map to scale tones; 8 = tonic octave above; 0 = 7th degree one octave below (e.g. B3 in C major).
 *
 * Called without arguments, uses default degree 1 (tonic).
 *
 * @param degree - Scale degree (1–7 typical; 8 = tonic above; 0 = 7th below). `undefined` = 1.
 * @param duration - Note duration in beats. `undefined` = bridge default.

 * @returns Immutable {@link DegreeBuilder} — chain `.velocity()`, `.up()`, `.repeat()`, `.sharp()`, etc.
 *
 * @example
 * ```ts
 * degree(1)                           // Tonic (C4 in C major)
 * degree(5).velocity(1000)             // Dominant, louder
 * degree(3).up(1).duration(480)        // Mediant an octave up, half-note
 * degree(1).repeat(3)                  // Emit tonic three times
 * degree(7).sharp().apply(bridge)      // Leading tone with accidental
 * ```
 */
export function degree(degree?: number, duration?: NoteDuration): DegreeBuilder {
  return new DegreeBuilder({ degree, duration })
}
