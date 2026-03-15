import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { appendSteps, applyEntries } from '../utils/scope-entries'
import { ScopeBuilder } from '../interfaces/scope-builder'

// ============================================================================
// ScopedSetterBuilder
// ============================================================================

/**
 * Abstract base class for setter builders that support both
 * scoped and default (unscoped/downstream) modes.
 *
 * - Scoped:   `setter(value).steps(note('C4'))` — value applies only to contained steps
 * - Default:  `setter(value)` — value cascades downstream
 *
 * Unlike ScopedEffectBuilder which wraps bridges in decorators,
 * ScopedSetterBuilder modifies a bridge field and restores it after the scope.
 *
 * Subclasses implement `set(bridge)` to apply the value and `read(bridge)` / `restore(bridge, parentValue)`
 * to save/restore the parent's original value.
 */
export abstract class ScopedSetterBuilder<T extends ScopedSetterBuilder<T>> implements ScopeBuilder<T> {
  protected readonly entries: PipeStep[][]

  protected constructor(entries: PipeStep[][] = []) {
    this.entries = entries
  }

  /** Add steps to this setter's scope (accumulates). */
  steps(...pipeSteps: PipeStep[]): T {
    return this.cloneWithEntries(appendSteps(this.entries, pipeSteps))
  }

  /** Explicitly mark as a downstream default. Semantic no-op. */
  default(): T {
    return this.cloneWithEntries([])
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const modified = this.set(bridge)

    if (this.entries.length === 0) {
      // Default mode: set value and cascade downstream
      return modified
    }

    // Scoped mode: run inner steps, then restore parent's value
    const result = applyEntries(this.entries, modified)
    return this.restore(result, bridge)
  }

  /** Apply this setter's value to the bridge. */
  protected abstract set(bridge: CompositionBridge): CompositionBridge

  /**
   * Restore the parent's original state after scoped steps complete.
   * `result` is the bridge after inner steps ran, `parent` is the original bridge before the setter.
   */
  protected abstract restore(result: CompositionBridge, parent: CompositionBridge): CompositionBridge

  /** Clone with updated entries. */
  protected abstract cloneWithEntries(entries: PipeStep[][]): T
}
