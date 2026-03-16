import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'

// ============================================================================
// Scope entries — flat list of PipeStep arrays
// ============================================================================

/**
 * Append a pipe-step group to the entries array.
 *
 * Does not mutate the original array; returns a new array with `pipeSteps` as
 * the trailing element. Used by {@link ScopedBuilder}, {@link IsolateBuilder},
 * {@link StackBuilder}, and related scope builders.
 *
 * @param entries - Current list of pipe-step groups (order preserved)
 * @param pipeSteps - Steps to append as a new group

 * @returns New entries array with `pipeSteps` appended (immutable)
 */
export function appendSteps(entries: PipeStep[][], pipeSteps: PipeStep[]): PipeStep[][] {
  return [...entries, pipeSteps]
}

/**
 * Apply all scope entries to the bridge in sequence.
 *
 * Iterates entries in order; within each entry, applies each step via
 * {@link PipeStep.apply} and chains the resulting bridge to the next step.
 * Returns the final bridge after all steps have been applied.
 *
 * @param entries - Pipe-step groups to apply in order
 * @param bridge - Initial composition bridge

 * @returns Final bridge after all steps applied sequentially
 */
export function applyEntries(
  entries: PipeStep[][],
  bridge: CompositionBridge,
): CompositionBridge {
  let target = bridge

  for (let i = 0; i < entries.length; ++i) {
    const steps = entries[i]

    for (let j = 0; j < steps.length; ++j) {
      target = steps[j].apply(target)
    }
  }

  return target
}
