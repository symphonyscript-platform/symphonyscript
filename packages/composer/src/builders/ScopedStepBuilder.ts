import type { CompositionBridge } from '@symphonyscript/composer'
import type { PipeStep } from '@symphonyscript/composer'
import { appendSteps, applyEntries } from '../utils/scope-entries'
import { ScopeBuilder } from '../interfaces/scope-builder'

// ============================================================================
// ScopedStepBuilder
// ============================================================================

/**
 * Abstract base class for scoped steps that support both
 * scoped and default (unscoped/downstream) modes.
 *
 * - Scoped:   `effect().steps(note('C4'))` — applies only to contained steps
 * - Default:  `effect().default()` or just `effect()` — cascades downstream
 *
 * Subclasses implement:
 * - `onEnter(bridge)` — modify bridge before steps (wrap in decorator, set field, etc.)
 * - `onExit(result, parent)` — restore/cleanup after steps complete
 *
 * This replaces both ScopedEffectBuilder and ScopedSetterBuilder with one class.
 */
export abstract class ScopedStepBuilder<T extends ScopedStepBuilder<T>> implements ScopeBuilder<T> {
  protected readonly entries: PipeStep[][]

  protected constructor(entries: PipeStep[][]) {
    this.entries = entries
  }

  /** Add steps to this scope (accumulates). */
  steps(...pipeSteps: PipeStep[]): T {
    return this.cloneWithEntries(appendSteps(this.entries, pipeSteps))
  }

  /** Explicitly mark as a downstream default. Semantic no-op. */
  default(): T {
    return this.cloneWithEntries([])
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const modified = this.onEnter(bridge)

    if (this.entries.length === 0) {
      // Default mode: apply and cascade downstream
      return modified
    }

    // Scoped mode: run inner steps, then restore/cleanup
    const result = applyEntries(this.entries, modified)
    return this.onExit(result, bridge)
  }

  /**
   * Modify the bridge before inner steps run.
   * For effects: wrap in a decorator bridge.
   * For setters: set a field value.
   */
  protected abstract onEnter(bridge: CompositionBridge): CompositionBridge

  /**
   * Restore/cleanup after scoped steps complete.
   * `result` is the bridge after inner steps ran,
   * `parent` is the original bridge before this step.
   *
   * For effects: unwrap decorator, restore parent state from `parent`.
   * For setters: restore original field value from `parent`.
   */
  protected abstract onExit(result: CompositionBridge, parent: CompositionBridge): CompositionBridge

  /** Clone with updated entries. */
  protected abstract cloneWithEntries(entries: PipeStep[][]): T
}
