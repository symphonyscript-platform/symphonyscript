import type { CompositionBridge } from '@symphonyscript/composer'
import type { PipeStep } from '@symphonyscript/composer'
import { appendSteps, applyEntries } from '../utils/scope-entries'
import { ScopeBuilder } from '../interfaces/scope-builder'

// ============================================================================
// ScopedStepBuilder
// ============================================================================

/**
 * Abstract base for scoped effect and setter builders that support both scoped
 * and default (cascade) modes via onEnter/onExit lifecycle.
 *
 * Implements {@link ScopeBuilder}. In **scoped mode**, the effect/setter
 * applies only to contained steps passed to `steps()`. In **default mode**
 * (no steps or after `default()`), the modification cascades downstream for
 * subsequent pipeline steps.
 *
 * Subclasses implement:
 * - `onEnter(bridge)` — modify bridge before inner steps (e.g. wrap in decorator, set field)
 * - `onExit(result, parent)` — restore/cleanup after inner steps complete
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * // Scoped: swing applies only to inner notes
 * swing(0.5).steps(note('C4'), note('D4'))
 * dynamics(400, 1000).steps(note('C4'), note('C4'))
 *
 * // Default: cascade downstream for subsequent steps
 * swing(0.5).default()
 * dynamics(400, 1000)
 *
 * // Chaining order — steps before or after other setters
 * swing(0.5).amount(0.6).steps(note('C4'))
 * ```
 */
export abstract class ScopedStepBuilder<T extends ScopedStepBuilder<T>> implements ScopeBuilder<T> {
  /**
   * Pipe-step groups to apply within this scope. Each element is an array of
   * steps; groups are applied in order via {@link applyEntries}.
   * Empty when in default (cascade) mode.
   */
  protected readonly entries: PipeStep[][]

  protected constructor(entries: PipeStep[][]) {
    this.entries = entries
  }

  /**
   * Add pipe steps to this scope. Appends the given steps as a new group;
   * previous groups are preserved.
   *
   * @param pipeSteps - One or more {@link PipeStep}s to run within this scope

   * @returns New builder instance with the additional steps appended
   */
  steps(...pipeSteps: PipeStep[]): T {
    return this.cloneWithEntries(appendSteps(this.entries, pipeSteps))
  }

  /**
   * Mark as downstream default. Clears scoped entries so that when `apply()` runs,
   * the modification (from `onEnter`) cascades to subsequent pipeline steps
   * instead of being scoped to inner content.
   *
   * @returns New builder instance with empty entries
   */
  default(): T {
    return this.cloneWithEntries([])
  }

  /**
   * Apply this step to the bridge. Runs `onEnter` to modify the bridge, then
   * either applies inner steps (scoped mode) or returns the modified bridge
   * (default mode). In scoped mode, runs `onExit` to restore/cleanup after
   * inner steps complete.
   *
   * @param bridge - Current composition state

   * @returns Updated bridge (after onEnter; after inner steps + onExit when scoped)
   */
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
   * Modify the bridge before inner steps run. Called by `apply()` before
   * running scoped steps or returning (default mode).
   *
   * Effects (e.g. {@link SwingBuilder}, {@link DynamicsBuilder}): wrap the
   * bridge in a decorator that intercepts note emission.
   * Setters (e.g. {@link FieldSetter}): set a bridge field value.
   *
   * @param bridge - Current composition state before scoped content

   * @returns Modified bridge (decorator or field-updated)
   */
  protected abstract onEnter(bridge: CompositionBridge): CompositionBridge

  /**
   * Restore or cleanup after scoped steps complete. Called by `apply()` only
   * in scoped mode, after inner steps have been applied.
   *
   * Effects: unwrap the decorator and restore parent state from `parent`.
   * Setters: restore the original field value from `parent`.
   *
   * @param result - Bridge state after inner steps were applied
   * @param parent - Original bridge before this step (pre-onEnter)

   * @returns Restored bridge (typically unwrapped or with original field)
   */
  protected abstract onExit(result: CompositionBridge, parent: CompositionBridge): CompositionBridge

  /**
   * Clone the builder with updated entries. Subclasses must return an instance
   * of the concrete builder type preserving all builder-specific state.
   *
   * @param entries - New pipe-step groups to use

   * @returns New builder instance with the given entries
   * @internal
   */
  protected abstract cloneWithEntries(entries: PipeStep[][]): T
}
