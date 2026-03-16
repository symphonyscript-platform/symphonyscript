import { Composable } from '../interfaces/composable'
import { LinkBuilder } from '../builders/LinkBuilder'

/**
 * Insert another clip's composed content at the current tick.
 *
 * Links the given {@link Composable} (clip or step) into the composition without
 * recomposing it. The clip's output is emitted at the current bridge tick.
 * Returns a {@link LinkBuilder} for optional weight and effects configuration.
 *
 * Use for repetition and reuse of pre-defined material (melodies, progressions,
 * patterns). Effects can wrap the linked clip (interceptors) or post-process its
 * notes (transforms).
 *
 * @param clip - {@link Composable} (e.g. {@link IClip}, frozen clip) to insert
 * @returns {@link LinkBuilder} — chain `.weight()` and `.effects()` to configure
 *
 * @example
 * ```ts
 * use(melody)                                          // Insert melody at current tick
 * use(melody).weight(0.8)                               // Configure amplitude weight
 * use(melody).effects(humanize(20, 10), swing(0.6))    // Interceptors + transforms
 * use(chordClip).effects(reverse())                      // Reverse composed output
 * clip.steps(note('C4'), use(bassline), note('G4'))    // Mix inline and linked content
 * ```
 */
export function use(clip: Composable): LinkBuilder {
  return new LinkBuilder({ clip })
}
