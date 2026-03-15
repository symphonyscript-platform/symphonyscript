import type { PipeStep } from '@symphonyscript/composer'
import { StackBuilder } from '../builders/StackBuilder'

/**
 * Parallel composition — all branches start at the same tick.
 *
 * Builder usage:
 *   stack()
 *     .branch(note('C4'), note('E4'))
 *     .branch(use(drumClip))
 *
 * Shorthand (flat arrays):
 *   stack(
 *     [note('C4'), note('E4')],
 *     [kick(), snare()],
 *   )
 */
export function stack(...branches: PipeStep[][]): StackBuilder {
  let builder = new StackBuilder()

  for (let i = 0; i < branches.length; ++i) {
    builder = builder.branch(...branches[i])
  }

  return builder
}
