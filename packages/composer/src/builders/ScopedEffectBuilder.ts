import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

/**
 * Abstract base class for effect builders that support both
 * scoped and default (unscoped/downstream) modes.
 *
 * - Scoped:   `effect().steps(note('C4'))` — effect applies only to contained steps
 * - Default:  `effect().default()` or just `effect()` — effect cascades downstream
 *
 * Subclasses implement `wrap(bridge)` to produce a decorated bridge.
 * Optionally override `cleanup(bridge)` for teardown after scoped steps (e.g. bend reset).
 */
export abstract class ScopedEffectBuilder<T extends ScopedEffectBuilder<T>> implements PipeStep {
  protected readonly pipeSteps: PipeStep[]

  protected constructor(pipeSteps: PipeStep[]) {
    this.pipeSteps = pipeSteps
  }

  /** Scope this effect to the given steps. */
  steps(...pipeSteps: PipeStep[]): T {
    return this.cloneWithSteps(pipeSteps)
  }

  /** Explicitly mark as a downstream default. Semantic no-op. */
  default(): T {
    return this.cloneWithSteps([])
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const outer = bridge
    const decorated = this.wrap(outer)

    if (this.pipeSteps.length === 0) {
      // Unscoped — decorate bridge, cascade downstream
      return decorated
    }

    // Scoped — apply steps through decorated bridge, then return clean bridge
    let target = decorated
    for (let i = 0; i < this.pipeSteps.length; ++i) {
      target = this.pipeSteps[i].apply(target)
    }

    // Return the outer (undecorated) bridge at the new tick position.
    // Events are already committed through the decorator.
    return this.cleanup(outer.withTick(target.tick))
  }

  /** Decorate the bridge with this effect. */
  protected abstract wrap(bridge: CompositionBridge): CompositionBridge

  /** Clone with updated pipeSteps. */
  protected abstract cloneWithSteps(pipeSteps: PipeStep[]): T

  /**
   * Optional cleanup after scoped steps complete.
   * Override for effects that need teardown (e.g. bend reset).
   * Default: return bridge unchanged.
   */
  protected cleanup(bridge: CompositionBridge): CompositionBridge {
    return bridge
  }
}
