import { DegreeChordBuilder } from '../builders/DegreeChordBuilder'

import { NoteDuration } from '@symphonyscript/core'

/**
 * Create a {@link DegreeChordBuilder} that emits a chord from explicit scale degrees.
 *
 * Resolves each degree to MIDI pitch via `degreeToPitch` using the bridge's scale
 * context (scaleRoot, scaleMode). Emits all chord tones simultaneously at the current
 * tick. Unlike {@link roman}, degrees are explicit (e.g. [1, 3, 5] or [4, 6, 8] for
 * IV). Use this when you need custom voicings or non-standard degree sets.
 *
 * Called without arguments or with an empty array, creates a builder that returns
 * the bridge unchanged on apply.
 *
 * @param degrees - Scale degrees defining the chord (e.g. [1, 3, 5] triad, [4, 6, 8] for IV).
 * @param duration - Note duration in ticks. `undefined` = bridge default.

 * @returns Immutable {@link DegreeChordBuilder}
 *
 * @example
 * ```ts
 * degreeChord([1, 3, 5])                    // Tonic triad (C, E, G in C major)
 * degreeChord([1, 3, 5, 7]).duration(480)    // Major 7th chord, half-note
 * degreeChord([4, 6, 8])                    // IV chord (F, A, C)
 * degreeChord([2, 4, 6], 240)              // ii chord, quarter-note
 * degreeChord([]).apply(bridge)             // No-op (empty degrees)
 * ```
 */
export function degreeChord(degrees?: number[], duration?: NoteDuration): DegreeChordBuilder {
  return new DegreeChordBuilder({ degrees, duration })
}
