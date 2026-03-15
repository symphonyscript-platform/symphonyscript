import type { CompositionBridge } from '@symphonyscript/composer'
import type { PipeStep } from '@symphonyscript/composer'
import type { Composable } from '../interfaces/composable'
import {
  type ScopeEntry,
  appendStepsEntry,
  appendClipEntry,
  applyEntries,
} from '../utils/scope-entries'
import { ScopeBuilder } from '../interfaces/scope-builder'

export type { ScopeEntry } from '../utils/scope-entries'

// ============================================================================
// ScopedEffectBuilder
// ============================================================================

/**
 * Abstract base class for effect builders that support both
 * scoped and default (unscoped/downstream) modes.
 *
 * - Scoped:   `effect().steps(note('C4'))` — effect applies only to contained steps
 * - Clip:     `effect().use(clip)` — effect applies to an existing clip (accumulates)
 * - Default:  `effect().default()` or just `effect()` — effect cascades downstream
 *
 * `.steps()` and `.use()` share a single ordered `entries` array,
 * preserving the user's intended execution order.
 *
 * Subclasses implement `wrap(bridge)` to produce a decorated bridge.
 * Optionally override `cleanup(bridge)` for teardown after scoped steps (e.g. bend reset).
 */
export abstract class ScopedEffectBuilder<T extends ScopedEffectBuilder<T>> implements ScopeBuilder<T> {
  protected readonly entries: ScopeEntry[]

  protected constructor(entries: ScopeEntry[]) {
    this.entries = entries
  }

  /** Scope this effect to the given steps (overrides previous steps). */
  steps(...pipeSteps: PipeStep[]): T {
    return this.cloneWithEntries(appendStepsEntry(this.entries, pipeSteps))
  }

  /** Add a clip to the effect scope (accumulates). */
  use(clip: Composable): T {
    return this.cloneWithEntries(appendClipEntry(this.entries, clip))
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
  protected abstract cloneWithEntries(entries: ScopeEntry[]): T

  /**
   * Optional cleanup after scoped steps complete.
   * Override for effects that need teardown (e.g. bend reset).
   * Default: return bridge unchanged.
   */
  protected cleanup(bridge: CompositionBridge): CompositionBridge {
    return bridge
  }
}
