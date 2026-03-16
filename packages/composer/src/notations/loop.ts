import { LoopBuilder } from '../builders/LoopBuilder'
import { PipeStep } from '@symphonyscript/composer'

/**
 * Loop a sequence of steps N times sequentially.
 *
 * Applies all pipe steps in order for each iteration; bridge state accumulates
 * across iterations so tick advances naturally. For single-step shorthand, use
 * {@link repeat}. See {@link LoopBuilder}.
 *
 * @param count - Number of iterations. Defaults to 1 when omitted.
 * @param pipeSteps - Steps to run in order each iteration. When empty, returns
 *   a builder; use `.steps()` and `.count()` to configure.
 * @returns Immutable {@link LoopBuilder} — chain `.count()`, `.steps()`.
 *
 * @example
 * ```ts
 * loop(3, note('C4'))                           // C4 three times
 * loop(2, note('C4'), note('E4'), note('G4'))   // C4, E4, G4, C4, E4, G4
 * loop().steps(note('C4')).count(4)              // C4 four times
 * loop(1, note('C4'))                           // Single pass (count=1)
 * ```
 */
export function loop(count?: number, ...pipeSteps: PipeStep[]): LoopBuilder {
  return new LoopBuilder({ count, pipeSteps })
}
