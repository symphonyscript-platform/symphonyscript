import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'

// ============================================================================
// Scope entries — flat list of PipeStep arrays
// ============================================================================

/**
 * Append pipe steps to the entries array.
 */
export function appendSteps(entries: PipeStep[][], pipeSteps: PipeStep[]): PipeStep[][] {
  return [...entries, pipeSteps]
}

/**
 * Iterate scope entries in user-specified order, applying steps sequentially.
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
