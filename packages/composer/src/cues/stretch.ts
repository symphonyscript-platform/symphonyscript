import type { PipeStep } from '@symphonyscript/composer'
import { StretchBuilder } from '../builders/StretchBuilder'

/**
 * Time-stretch contained steps or clips by a factor.
 *
 * Multiplies each note's tick and duration by `factor` before replaying.
 * Uses capture-transform-replay: runs the scope, scales ticks/durations, then
 * emits to the bridge. See {@link StretchBuilder}.
 *
 * @param factor - Scaling factor for ticks and durations. 1 = no change, 2 = double
 *   length, 0.5 = half. Defaults to 1 when omitted.
 * @param pipeSteps - Steps or clips to stretch. When empty, returns a builder;
 *   use `.steps(...)` to add content later.
 * @returns Immutable {@link StretchBuilder} — chain `.factor()`, `.steps()`, `.default()`.
 *
 * @example
 * ```ts
 * stretch(2, note('C4'), note('E4'))       // Doubles tick and duration of both notes
 * stretch(0.5).steps(chord('Cmaj7'))       // Half the chord length
 * stretch(2).default()                     // factor=2, empty scope (pass-through)
 * stretch()                                 // factor=1, no steps
 * stretch(2).factor(3).steps(note('C4'))   // Chain to change factor
 * ```
 */
export function stretch(factor?: number, ...pipeSteps: PipeStep[]): StretchBuilder {
  const builder = new StretchBuilder({ factor })
  if (pipeSteps.length === 0) return builder
  return builder.steps(...pipeSteps)
}
