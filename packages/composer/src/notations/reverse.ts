import type { PipeStep } from '@symphonyscript/composer'
import { ReverseBuilder } from '../builders/ReverseBuilder'

/**
 * Reverse the temporal order of contained steps or clips.
 *
 * Uses capture-transform-replay: runs the scope, collects emitted notes, then
 * replays them with reversed tick positions (last note becomes first). Total
 * duration is preserved. See {@link ReverseBuilder}.
 *
 * @param pipeSteps - Steps or clips to reverse. When empty, returns a builder that
 *   passes through when applied; use `.steps(...)` or pass steps directly.
 * @returns Immutable {@link ReverseBuilder} — chain `.steps()` or `.default()`.
 *
 * @example
 * ```ts
 * reverse()                                    // No steps (pass-through when applied)
 * reverse().steps(note('C4'), note('E4'))     // Emits E4 then C4
 * reverse(note('C4'), note('D4'), note('E4')) // Same as .steps(...) via variadic args
 * reverse().steps(chord('Cmaj7'))             // Chord tones reversed
 * ```
 */
export function reverse(...pipeSteps: PipeStep[]): ReverseBuilder {
  if (pipeSteps.length === 0) return new ReverseBuilder()
  return new ReverseBuilder().steps(...pipeSteps)
}
