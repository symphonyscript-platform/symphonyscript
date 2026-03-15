import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { Composable } from '../interfaces/composable'

// ============================================================================
// ScopeEntry type — ordered union of steps and clips
// ============================================================================

export type ScopeEntry =
  | { readonly kind: 'steps'; readonly steps: PipeStep[] }
  | { readonly kind: 'clip'; readonly clip: Composable }

// ============================================================================
// Shared operations on ScopeEntry arrays
// ============================================================================

/**
 * Replace all 'steps' entries with a single new one at the end.
 * Preserves all 'clip' entries in their original positions.
 */
export function replaceStepsEntry(entries: ScopeEntry[], pipeSteps: PipeStep[]): ScopeEntry[] {
  const filtered: ScopeEntry[] = []

  for (let i = 0; i < entries.length; ++i) {
    if (entries[i].kind !== 'steps') {
      filtered.push(entries[i])
    }
  }

  filtered.push({ kind: 'steps', steps: pipeSteps })

  return filtered
}

/**
 * Append a clip entry to the end of the entries array.
 */
export function appendClipEntry(
  entries: ScopeEntry[],
  clip: Composable,
): ScopeEntry[] {
  return [...entries, { kind: 'clip', clip }]
}

/**
 * Iterate scope entries in user-specified order, applying steps and composing clips.
 */
export function applyEntries(
  entries: ScopeEntry[],
  bridge: CompositionBridge,
): CompositionBridge {
  let target = bridge

  for (let i = 0; i < entries.length; ++i) {
    const entry = entries[i]

    if (entry.kind === 'steps') {
      for (let j = 0; j < entry.steps.length; ++j) {
        target = entry.steps[j].apply(target)
      }
    } else {
      target = entry.clip.compose(target)
    }
  }

  return target
}
