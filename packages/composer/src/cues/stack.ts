import type { PipeStep } from '@symphonyscript/composer'
import { StackBuilder } from '../builders/StackBuilder'

/**
 * Parallel composition — all branches start at the same tick.
 *
 * Each branch forks from the same tick and runs independently; steps within a
 * branch advance that branch's tick sequentially. Output tick advances to the
 * longest branch's end. Use for polyphonic parts, layered textures, or concurrent
 * clips. See {@link StackBuilder}.
 *
 * @param branches - Arrays of {@link PipeStep}s. Each array is one parallel branch.
 *   Omit to get an empty builder; use `.branch(...)` to add branches via the fluent API.
 * @returns Immutable {@link StackBuilder} — chain `.branch()` for more voices.
 *
 * @example
 * ```ts
 * stack()                                             // Empty, add via .branch()
 * stack().branch(note('C4'), note('E4')).branch(use(drumClip))
 * stack([note('C4'), note('E4')], [kick(), snare()])   // Shorthand: two branches
 * stack([note('C4')], [note('E4')], [note('G4')])     // Three notes at tick 0
 * ```
 */
export function stack(...branches: PipeStep[][]): StackBuilder {
  let builder = new StackBuilder()

  for (let i = 0; i < branches.length; ++i) {
    builder = builder.branch(...branches[i])
  }

  return builder
}
