import type { CompositionBridge } from '@symphonyscript/composer'
import type { PipeStep } from '@symphonyscript/composer'
import { appendSteps, applyEntries } from '../utils/scope-entries'
import { ScopeBuilder } from '../interfaces/scope-builder'

// ============================================================================
// ScopedEffectBuilder
// ============================================================================

/**
 * Abstract base class for effect builders that support both
 * scoped and default (unscoped/downstream) modes.
 *
 * - Scoped:   `effect().steps(note('C4'))` — effect applies only to contained steps
 * - Default:  `effect().default()` or just `effect()` — effect cascades downstream
 *
 * Subclasses implement `wrap(bridge)` to produce a decorated bridge.
 * Optionally override `cleanup(bridge)` for teardown after scoped steps.
 */
export abstract class ScopedEffectBuilder<T extends ScopedEffectBuilder<T>> implements ScopeBuilder<T> {
  protected readonly entries: PipeStep[][]

  protected constructor(entries: PipeStep[][]) {
    this.entries = entries
  }

  /** Add steps to this effect's scope (accumulates). */
  steps(...pipeSteps: PipeStep[]): T {
    return this.cloneWithEntries(appendSteps(this.entries, pipeSteps))
  }

  /** Explicitly mark as a downstream default. Semantic no-op. */
  default(): T {
    return this.cloneWithEntries([])
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const outer = bridge
    const decorated = this.wrap(outer)

    if (this.entries.length === 0) {
      return decorated
    }

    const target = applyEntries(this.entries, decorated)

    return this.cleanup(outer.withTick(target.tick))
  }

  /** Decorate the bridge with this effect. */
  protected abstract wrap(bridge: CompositionBridge): CompositionBridge

  /** Clone with updated entries. */
  protected abstract cloneWithEntries(entries: PipeStep[][]): T

  /**
   * Optional cleanup after scoped steps complete.
   * Override for effects that need teardown (e.g. bend reset).
   * Default: return bridge unchanged.
   */
  protected cleanup(bridge: CompositionBridge): CompositionBridge {
    return bridge
  }
}
